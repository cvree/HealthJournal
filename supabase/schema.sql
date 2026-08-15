-- Health Journal — cross-device sync schema.
--
-- Run this once against a fresh Supabase project (SQL Editor → New query →
-- paste → Run). It is idempotent: running it again on an existing project
-- changes nothing.
--
-- What the server can see, stated plainly, because it is the whole security
-- argument: the columns below hold a record's *kind*, its *id*, a timestamp, a
-- device id, and a deleted flag. The contents — every answer, note, meal,
-- symptom and photo — arrive as AES-256-GCM ciphertext encrypted on the user's
-- device with a key derived from a passphrase this server never receives. A
-- full dump of these tables is a list of dates and opaque blobs.
--
-- What that is NOT: it is not zero-knowledge in the strong sense (the app is
-- served over the web, so whoever controls the host controls the code that
-- handles the passphrase), and it is not a compliance posture of any kind. No
-- HIPAA claim is made or implied anywhere in this project.

-- ---------------------------------------------------------------------------
-- Records
-- ---------------------------------------------------------------------------

create table if not exists public.sync_records (
  user_id     uuid        not null references auth.users(id) on delete cascade,
  kind        text        not null,
  id          text        not null,
  updated_at  timestamptz not null,
  rev         bigint      not null default 0,
  device_id   text        not null,
  deleted     boolean     not null default false,
  ciphertext  text,
  iv          text,
  -- Strictly increasing per write, and the reason pulls are reliable. A
  -- timestamp cursor silently skips rows written inside the same millisecond
  -- or by a server whose clock stepped backwards; a sequence cannot.
  server_seq  bigint      not null,
  primary key (user_id, kind, id)
);

create sequence if not exists public.sync_seq;

-- The pull query is "everything above my cursor, oldest first", per user.
create index if not exists sync_records_seq_idx
  on public.sync_records (user_id, server_seq);

alter table public.sync_records enable row level security;

-- One rule, four verbs: you can only ever touch rows that are yours. `to
-- authenticated` matters — without it the anon role is included, and the anon
-- key is public by design.
drop policy if exists "own records" on public.sync_records;
create policy "own records" on public.sync_records
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Key material metadata (none of it secret)
-- ---------------------------------------------------------------------------

create table if not exists public.sync_meta (
  user_id      uuid    primary key references auth.users(id) on delete cascade,
  -- Base64, 16 random bytes. Salts are public by design; their job is to make a
  -- precomputed attack against many users at once worthless.
  salt         text    not null,
  iterations   integer not null,
  -- A fixed probe string sealed under the user's key. Lets a device tell
  -- "wrong passphrase" from "damaged data" without touching journal contents.
  verifier     text    not null,
  verifier_iv  text    not null,
  schema       integer not null default 1,
  created_at   timestamptz not null default now()
);

alter table public.sync_meta enable row level security;

-- Insert-once, never update: a salt that changes under a live journal makes
-- every record already uploaded permanently unreadable. There is deliberately
-- no UPDATE policy, so no client can do that even by accident.
drop policy if exists "own meta read" on public.sync_meta;
create policy "own meta read" on public.sync_meta
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "own meta insert" on public.sync_meta;
create policy "own meta insert" on public.sync_meta
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "own meta delete" on public.sync_meta;
create policy "own meta delete" on public.sync_meta
  for delete to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Push: the conflict rule, enforced server-side
-- ---------------------------------------------------------------------------

-- The client applies the same rule (src/lib/sync/merge.ts) so it can show the
-- right thing immediately, but the client is not the enforcement point. A
-- device that has been offline for a week must not be able to overwrite a
-- fortnight of newer edits just because it asked last.
--
-- Ordering is (updated_at, rev, device_id). Only the first is meaningful; the
-- other two exist so two devices independently comparing the same pair of
-- versions always reach the same answer.
create or replace function public.sync_push(payload jsonb)
returns void
language plpgsql
security invoker              -- runs as the caller, so RLS still applies
set search_path = public
as $$
begin
  insert into public.sync_records
    (user_id, kind, id, updated_at, rev, device_id, deleted, ciphertext, iv, server_seq)
  select
    auth.uid(),               -- never trust a user_id sent by a client
    r->>'kind',
    r->>'id',
    (r->>'updated_at')::timestamptz,
    coalesce((r->>'rev')::bigint, 0),
    r->>'device_id',
    coalesce((r->>'deleted')::boolean, false),
    r->>'ciphertext',
    r->>'iv',
    nextval('public.sync_seq')
  from jsonb_array_elements(payload) as r
  on conflict (user_id, kind, id) do update
    set updated_at = excluded.updated_at,
        rev        = excluded.rev,
        device_id  = excluded.device_id,
        deleted    = excluded.deleted,
        ciphertext = excluded.ciphertext,
        iv         = excluded.iv,
        server_seq = nextval('public.sync_seq')
    where (excluded.updated_at, excluded.rev, excluded.device_id)
        > (sync_records.updated_at, sync_records.rev, sync_records.device_id);
end;
$$;

revoke all on function public.sync_push(jsonb) from public, anon;
grant execute on function public.sync_push(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Purge: "stop syncing and delete the cloud copy" has to actually do that
-- ---------------------------------------------------------------------------

create or replace function public.sync_purge()
returns void
language sql
security invoker
set search_path = public
as $$
  delete from public.sync_records where user_id = auth.uid();
  delete from public.sync_meta    where user_id = auth.uid();
$$;

revoke all on function public.sync_purge() from public, anon;
grant execute on function public.sync_purge() to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

-- Row-level security applies to realtime too, so a subscriber only ever
-- receives their own rows — and those rows are ciphertext.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'sync_records'
  ) then
    alter publication supabase_realtime add table public.sync_records;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Photo storage (optional)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('journal-photos', 'journal-photos', false)
on conflict (id) do nothing;

-- The first path segment is the owner's user id, which is what these policies
-- key on: a path outside your own folder is refused by the server, not by the
-- client. Objects are themselves encrypted before upload.
drop policy if exists "own photos read" on storage.objects;
create policy "own photos read" on storage.objects
  for select to authenticated
  using (bucket_id = 'journal-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "own photos write" on storage.objects;
create policy "own photos write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'journal-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "own photos update" on storage.objects;
create policy "own photos update" on storage.objects
  for update to authenticated
  using (bucket_id = 'journal-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "own photos delete" on storage.objects;
create policy "own photos delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'journal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
