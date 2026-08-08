/* Optional AI-assisted pattern analysis.

   Everything in this file is off unless the user turns it on. The app ships
   with no key, makes no request at import time, and the locally-computed
   "possible patterns" on the dashboard keep working exactly as before whether
   or not any of this is configured.

   Which services are reachable, and how to talk to them, lives in
   ./aiProviders — including why OpenAI is not among them. This file owns the
   parts that are the same whoever is answering: what leaves the device, how
   the credential is held, and how untrusted output is made safe to render.

   Design rules this module exists to enforce:

   1. **No key in the source, ever.** The key comes from the user at runtime.
      There is no fallback key, no build-time env var, no default endpoint
      credential. `grep` this repo and you will find no key-shaped string.
   2. **The key never touches the journal.** It is stored under its own storage
      key, outside the `fhj_v1` blob, so it cannot ride along in a JSON backup,
      a CSV export, or the report model. Same reasoning as the PIN record.
   3. **The key never gets logged.** Nothing here console-logs, and error paths
      scrub the key out of any message before it is surfaced, because provider
      error envelopes echo request context.
   4. **Only the minimum leaves the device.** `buildAnalysisInput` reduces the
      journal to daily numeric/boolean answers plus field labels for the
      requested window. No free-text notes, no photos, no name, no dates of
      birth, no device information. `summariseInput` describes that payload in
      plain words so the user can see what is about to be sent before it goes.
   5. **Correlation is not cause.** The prompt forbids causal and diagnostic
      language, and `scrubCausalLanguage` re-checks the model's output on the
      way back in — a model that ignores the instruction gets softened rather
      than shown as-is.
   6. **No model ID is load-bearing.** Hard-coding one is what broke this
      feature for every new user when Google retired `gemini-2.5-flash` early:
      a build that worked last week started returning 404. Models are
      discovered from the user's own key and re-resolved if one disappears. */

import {
  PROVIDERS, providerOf, listModels, chat, pickModel, isModelGone,
  type Connection, type ProviderId,
} from "./aiProviders";

export {
  PROVIDERS, providerOf, pickModel, scoreModel, OPENAI_NOTE,
  type Connection, type ProviderId, type ProviderDef,
} from "./aiProviders";

export type StoredKeyMode = "persist" | "session";

/* Kept so older callers and saved journals still resolve; the label shown in
   the UI now comes from the live connection, not a constant. */
export const AI_MODEL_LABEL = "your chosen AI";

const CONN_STORAGE = "fhj_ai_conn_v1";
/** Pre-provider installs stored a bare Gemini key here. Read once, migrated. */
const LEGACY_KEY_STORAGE = "fhj_ai_key_v1";

/* ---------- connection storage ----------

   Persisted connections go to the same IndexedDB store the journal uses, under
   their own key. That is genuinely better than localStorage (it is not
   readable by a stray synchronous script, and it is not in the export path)
   and genuinely *not* encryption — there is no secret on a local-first device
   to encrypt it with that an attacker with the same device access wouldn't
   also have. The Settings copy says exactly that rather than implying a vault.

   "Session" mode keeps it in a module variable only: it dies with the tab and
   is the honest choice on a shared computer. */

let sessionConn: Connection | null = null;
const mem: Record<string, string> = {};

const store = {
  async get(k: string): Promise<string | null> {
    const w = typeof window === "undefined" ? null : (window as any);
    if (w?.storage) {
      try {
        const r = await w.storage.get(k);
        return r ? r.value : null;
      } catch {
        return mem[k] ?? null;
      }
    }
    return mem[k] ?? null;
  },
  async set(k: string, v: string): Promise<void> {
    const w = typeof window === "undefined" ? null : (window as any);
    if (w?.storage) {
      try {
        await w.storage.set(k, v);
        return;
      } catch {
        /* fall through to memory */
      }
    }
    mem[k] = v;
  },
  async del(k: string): Promise<void> {
    const w = typeof window === "undefined" ? null : (window as any);
    if (w?.storage) {
      try {
        await w.storage.delete(k);
      } catch {
        /* fall through */
      }
    }
    delete mem[k];
  },
};

/** Shape check only — this never contacts anyone. Deliberately lenient: key
    formats change (Google moved from `AIza…` to `AQ.…` mid-life and the strict
    check would have locked those users out), so this rejects only what is
    obviously not a credential. */
export function looksLikeKey(raw: string): boolean {
  const k = raw.trim();
  return k.length >= 20 && k.length <= 400 && !/\s/.test(k);
}

/** `AQ.A…4kQ8` — enough to tell two keys apart, not enough to use one. */
export function maskKey(raw: string): string {
  const k = String(raw || "").trim();
  if (k.length <= 10) return "•".repeat(Math.max(4, k.length));
  return `${k.slice(0, 5)}…${k.slice(-4)}`;
}

export async function saveConnection(conn: Connection, mode: StoredKeyMode): Promise<void> {
  const clean: Connection = { ...conn, key: conn.key.trim() };
  sessionConn = clean;
  if (mode === "persist") await store.set(CONN_STORAGE, JSON.stringify(clean));
  else await store.del(CONN_STORAGE);
  await store.del(LEGACY_KEY_STORAGE);
}

export async function loadConnection(): Promise<Connection | null> {
  if (sessionConn) return sessionConn;
  const raw = await store.get(CONN_STORAGE);
  if (raw) {
    try {
      const c = JSON.parse(raw);
      if (c && typeof c.key === "string" && c.key.trim()) {
        return { provider: (c.provider as ProviderId) || "gemini", key: c.key, baseUrl: c.baseUrl, model: c.model };
      }
    } catch {
      /* corrupt record — fall through to the legacy path, then to null */
    }
  }
  // Installs from before providers existed stored a bare Gemini key.
  const legacy = await store.get(LEGACY_KEY_STORAGE);
  if (legacy && legacy.trim()) return { provider: "gemini", key: legacy.trim() };
  return null;
}

/** Remember a model choice without re-prompting for anything else. */
export async function rememberModel(model: string): Promise<void> {
  const conn = await loadConnection();
  if (!conn) return;
  const next = { ...conn, model };
  if (sessionConn) sessionConn = next;
  if (await store.get(CONN_STORAGE)) await store.set(CONN_STORAGE, JSON.stringify(next));
}

export async function hasStoredKey(): Promise<boolean> {
  return !!(await store.get(CONN_STORAGE)) || !!(await store.get(LEGACY_KEY_STORAGE));
}

export async function clearKey(): Promise<void> {
  sessionConn = null;
  await store.del(CONN_STORAGE);
  await store.del(LEGACY_KEY_STORAGE);
}

/* Back-compat wrappers over the connection API, for callers that only ever
   cared about a Gemini key. */
export const saveKey = (raw: string, mode: StoredKeyMode) =>
  saveConnection({ provider: "gemini", key: raw }, mode);
export const loadKey = async (): Promise<string | null> => (await loadConnection())?.key ?? null;

/** Strip anything credential-shaped out of text headed for a UI surface.
    Providers quote request metadata in error bodies, and this app should never
    be the thing that puts a credential on screen. */
export function redact(text: string, key?: string | null): string {
  let out = String(text ?? "");
  if (key) out = out.split(key).join("[key hidden]");
  return out
    .replace(/AIza[0-9A-Za-z_\-]{10,}/g, "[key hidden]")   // Google, legacy
    .replace(/AQ\.[0-9A-Za-z_\-]{10,}/g, "[key hidden]")   // Google, current
    .replace(/sk-[0-9A-Za-z_\-]{10,}/g, "[key hidden]")     // OpenAI-compatible
    .replace(/Bearer\s+[0-9A-Za-z._\-]{16,}/gi, "Bearer [key hidden]");
}

/* ---------- the payload ---------- */

export type AnalysisField = {
  k: string;
  label: string;
  /** "scale" | "toggle" | "number" — anything the model can reason over. */
  type: string;
  /** "sym" = higher is worse, "pos" = higher is better, "neutral" = neither. */
  dir?: string;
  unit?: string | null;
};

export type AnalysisInput = {
  /** Days are ordinals (day 1 = start of window), not calendar dates, so the
      payload cannot be tied back to a real person's timeline on its own. */
  windowDays: number;
  startDate: string;
  endDate: string;
  fields: AnalysisField[];
  /** One row per logged day: { day: 1-based index, weekday, values }. */
  days: { day: number; weekday: string; values: Record<string, number> }[];
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function weekdayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return WEEKDAYS[new Date(y, m - 1, d).getDay()] || "";
}

function dayIndex(start: string, date: string): number {
  return Math.round((Date.parse(date) - Date.parse(start)) / 86400000) + 1;
}

/** Reduce the journal to the smallest thing that can still answer the question.

    Included: field labels/types/direction, and per-day numeric or boolean
    answers inside the window.
    Excluded, deliberately: notes and any other free text, photos, the profile
    name, calendar dates on the rows themselves, anything outside the window,
    and any field the user marked as not chartable. */
export function buildAnalysisInput(
  fields: { k: string; label: string; type: string; dir?: string; unit?: string; chart?: boolean }[],
  entries: { date: string; answers?: Record<string, unknown> }[],
  start: string,
  end: string
): AnalysisInput {
  const usable = fields.filter(
    (f) => (f.type === "scale" || f.type === "toggle" || f.type === "number") && f.chart !== false
  );
  const keys = new Set(usable.map((f) => f.k));

  const rows: AnalysisInput["days"] = [];
  for (const e of entries) {
    if (!e.date || e.date < start || e.date > end) continue;
    const values: Record<string, number> = {};
    for (const [k, v] of Object.entries(e.answers || {})) {
      if (!keys.has(k)) continue;
      if (typeof v === "number" && isFinite(v)) values[k] = Math.round(v * 100) / 100;
      else if (typeof v === "boolean") values[k] = v ? 1 : 0;
      // strings, arrays (chips), objects: never sent
    }
    if (Object.keys(values).length === 0) continue;
    rows.push({ day: dayIndex(start, e.date), weekday: weekdayOf(e.date), values });
  }
  rows.sort((a, b) => a.day - b.day);

  // Only describe fields that actually appear in the rows — sending labels for
  // questions with no answers leaks the shape of someone's setup for nothing.
  const present = new Set<string>();
  rows.forEach((r) => Object.keys(r.values).forEach((k) => present.add(k)));

  return {
    windowDays: Math.max(1, dayIndex(start, end)),
    startDate: start,
    endDate: end,
    fields: usable
      .filter((f) => present.has(f.k))
      .map((f) => ({ k: f.k, label: f.label, type: f.type, dir: f.dir, unit: f.unit ?? null })),
    days: rows,
  };
}

/** Plain-language description of the payload, for the confirmation sheet. */
export function summariseInput(input: AnalysisInput): {
  days: number;
  metrics: number;
  values: number;
  approxKB: number;
  metricLabels: string[];
} {
  const values = input.days.reduce((n, d) => n + Object.keys(d.values).length, 0);
  return {
    days: input.days.length,
    metrics: input.fields.length,
    values,
    approxKB: Math.max(1, Math.round(JSON.stringify(input).length / 1024)),
    metricLabels: input.fields.map((f) => f.label),
  };
}

/* ---------- results ---------- */

export type AiPattern = {
  id: string;
  /** Cautious headline, e.g. "Your entries show itch running higher after…". */
  title: string;
  /** One or two sentences of detail, still hedged. */
  detail: string;
  /** Why the model thinks so, in the user's terms — shown behind a disclosure. */
  evidence: string;
  /** Field labels involved, for the chips on the card. */
  metrics: string[];
  /** "weak" | "moderate" | "strong" — described in words in the UI, never as
      a percentage, because a language model's confidence is not a p-value. */
  strength: "weak" | "moderate" | "strong";
  /** Human range this observation covers. */
  range: string;
  kind:
    | "co-occurrence"
    | "after-activity"
    | "sleep-mood"
    | "timing"
    | "trend"
    | "association"
    | "deviation"
    | "other";
};

export type AiAnalysis = {
  generatedAt: string;
  model: string;
  /** Copied from the input so the UI can show what the run actually covered. */
  startDate: string;
  endDate: string;
  daysAnalysed: number;
  patterns: AiPattern[];
  /** Set when the model found nothing worth reporting. */
  note?: string;
};

const SYSTEM_PROMPT = `You are helping someone read their own health self-tracking journal. You are not a clinician and this is not a clinical setting.

You receive a compact table: a list of tracked metrics (with a label, a type, and a direction where "sym" means higher is worse and "pos" means higher is better) and one row per logged day. Days are numbered from the start of the window; weekday names are given. Values are numbers; booleans are 0 or 1. Days the person did not log are simply absent.

Find longitudinal observations that a person would find genuinely useful, such as:
- metrics that repeatedly move together or appear together on the same days
- changes that show up on the days after a particular activity or flag
- relationships between sleep, mood, and symptom metrics
- recurring timing patterns (particular weekdays, clusters of consecutive days)
- metrics that are trending better or worse across the window
- factors that frequently accompany the person's worse or better days
- unusual deviations from this person's own baseline

Hard rules:
- Never diagnose, name a condition, or suggest a treatment, supplement, medication, test, or diet change.
- Never claim causation. These are co-occurrences in one person's self-reported log, nothing more.
- Phrase every finding cautiously. Use openings like "Your entries show...", "There may be a pattern between...", "You may want to look into...". Never "X causes Y", "X is triggering Y", "because of X", or "due to X".
- Only report something you can point at in the data. In "evidence", say concretely what you counted or compared — how many days, what the averages were, which days. Do not invent numbers.
- Ignore anything supported by fewer than 5 logged days, and say so by simply not reporting it.
- Set "strength" to how much data stands behind the observation: "weak" for a thin or noisy signal, "moderate" for a consistent one across a decent number of days, "strong" only for a clear pattern across most of the window. Most findings are weak or moderate.
- Set dayFrom/dayTo to the span of day numbers the observation draws on.
- Return at most 6 patterns, best first. If nothing meets the bar, return an empty list and explain why in "note" — that is a good answer, not a failure.
- Write for the person themselves: short, warm, concrete, no jargon, no hedging words stacked on hedging words.`;

/** Softens output that slipped past the prompt. Cheaper and more predictable
    than a second model call, and it fails safe: worst case a sentence reads
    slightly more tentative than the model intended. */
export function scrubCausalLanguage(text: string): string {
  return String(text ?? "")
    .replace(/\b(causes|caused|causing)\b/gi, "coincides with")
    .replace(/\bis triggering\b/gi, "often appears alongside")
    .replace(/\btriggered by\b/gi, "seen alongside")
    .replace(/\b(triggers|trigger)\b/gi, "co-occurs with")
    .replace(/\b(because of|due to|as a result of)\b/gi, "alongside")
    .replace(/\b(leads to|led to)\b/gi, "is often followed by")
    .replace(/\b(proves|proven|confirms)\b/gi, "suggests");
}

function dayToDate(start: string, day: number): string {
  const [y, m, d] = start.split("-").map(Number);
  const dt = new Date(y, m - 1, d + Math.max(0, day - 1));
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

function prettyDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export class AiError extends Error {
  kind: "no-key" | "auth" | "rate" | "network" | "response" | "not-enough-data";
  constructor(kind: AiError["kind"], message: string) {
    super(message);
    this.kind = kind;
    this.name = "AiError";
  }
}

/** One cheap round-trip that proves the key works, without sending journal
    data. Used by the "Test key" button in Settings. */
/** Turn a provider's failure into something the user can act on. Never
    includes the key: provider error bodies quote request context. */
function describeFailure(status: number, body: string, key: string): { kind: AiError["kind"]; message: string } {
  const clean = redact(body, key);
  if (status === 401 || status === 403) {
    return {
      kind: "auth",
      message: "The provider rejected that key. Check you copied all of it, and that the key hasn't been revoked.",
    };
  }
  if (status === 429) {
    return { kind: "rate", message: "You've hit the provider's rate limit. Try again in a minute." };
  }
  if (status === 402) {
    return { kind: "auth", message: "The provider says this key has no credit or quota left." };
  }
  if (status === 404) {
    return {
      kind: "response",
      message: "The provider couldn't find that model. It may have been retired — try again and a current one will be picked.",
    };
  }
  return { kind: "response", message: `The provider returned an error (${status}). ${clean.slice(0, 160)}` };
}

/** A browser CORS refusal and a dead network both surface as a bare TypeError,
    so this can't tell them apart — but for a custom endpoint the former is by
    far the likelier of the two, and saying so saves a long hunt. */
function networkMessage(conn: Connection): string {
  if (conn.provider === "custom") {
    return "Couldn't reach that endpoint from the browser. Either the address is wrong, or the service doesn't allow requests directly from a web page (CORS) — which this app needs, since it has no server to relay through.";
  }
  return "Couldn't reach the provider. Check your connection — this is the one part of the app that needs one.";
}

/** Verify a connection and choose a model for it, in one round trip.

    Listing models proves four things at once: the endpoint is reachable, the
    browser is allowed to call it, the key is accepted, and something usable is
    actually available to it. That last one is what the first version of this
    feature missed — the key was fine, the hard-coded model had been retired. */
/* One shape rather than a discriminated union: this project compiles with
   `strict: false`, and without strictNullChecks TypeScript will not narrow a
   `{ok:true}|{ok:false}` union, so every read of `.message` would error. */
export interface ConnectionCheck {
  ok: boolean;
  /** Set when ok — the model chosen for this connection. */
  model?: string;
  /** Set when ok — everything the key can reach, for diagnostics. */
  models?: string[];
  /** Set when not ok — already redacted, safe to show. */
  message?: string;
}

export async function testConnection(conn: Connection): Promise<ConnectionCheck> {
  if (!looksLikeKey(conn.key)) {
    return { ok: false, message: "That doesn't look like a full API key yet." };
  }
  if (providerOf(conn.provider).needsBaseUrl && !String(conn.baseUrl || "").trim()) {
    return { ok: false, message: "This provider needs an endpoint address as well as a key." };
  }
  let models: string[];
  try {
    models = await listModels(conn);
  } catch (e: any) {
    if (typeof e?.status === "number") {
      return { ok: false, message: describeFailure(e.status, String(e.message || ""), conn.key).message };
    }
    return { ok: false, message: networkMessage(conn) };
  }
  const model = pickModel(models);
  if (!model) {
    return {
      ok: false,
      message: "That key works, but no usable chat model is available to it. If the provider has a model list, check one is enabled.",
    };
  }
  return { ok: true, model, models };
}

/** Back-compat: verify a bare Gemini key. */
export async function testApiKey(key: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const res = await testConnection({ provider: "gemini", key });
  return res.ok ? { ok: true } : { ok: false, message: res.message || "That key didn't work." };
}

export async function runPatternAnalysis(
  connOrKey: Connection | string,
  input: AnalysisInput,
  opts: { signal?: AbortSignal } = {}
): Promise<AiAnalysis> {
  const conn: Connection = typeof connOrKey === "string"
    ? { provider: "gemini", key: connOrKey }
    : { ...connOrKey };

  if (!conn.key || !conn.key.trim()) throw new AiError("no-key", "No API key is set.");
  if (input.days.length < 5) {
    throw new AiError(
      "not-enough-data",
      "There are fewer than 5 logged days in this window — not enough for an observation to mean anything."
    );
  }

  const userText =
    "Here is the journal window. Metrics, then one row per logged day.\n\n" +
    JSON.stringify({ windowDays: input.windowDays, metrics: input.fields, days: input.days });

  /* One retry, and only for "that model is gone" — the exact failure that took
     this feature down for every new user when a hard-coded model was retired.
     Re-resolving from the live list fixes it without anyone touching Settings. */
  const attempt = async (c: Connection, allowRetry: boolean): Promise<string> => {
    if (!c.model) {
      const picked = await testConnection(c);
      if (!picked.ok || !picked.model) throw new AiError("auth", picked.message || "No usable model.");
      c.model = picked.model;
      await rememberModel(picked.model).catch(() => {});
    }

    try {
      return await chat(c, { system: SYSTEM_PROMPT, user: userText, signal: opts.signal });
    } catch (e: any) {
      if (e?.name === "AbortError") throw e;
      if (typeof e?.status !== "number") throw new AiError("network", networkMessage(c));
      if (allowRetry && isModelGone(e.status, String(e.body || e.message || ""))) {
        c.model = undefined;
        return attempt(c, false);
      }
      const { kind, message } = describeFailure(e.status, String(e.body || e.message || ""), c.key);
      throw new AiError(kind, message);
    }
  };

  const text = await attempt(conn, true);

  let parsed: any;
  try {
    parsed = JSON.parse(stripFence(text));
  } catch {
    throw new AiError("response", "The analysis came back in an unexpected shape. Try regenerating.");
  }
  return normaliseAnalysis(parsed, input, conn.model);
}

/** Some OpenAI-compatible models wrap JSON in a markdown fence despite being
    asked not to. Cheaper to unwrap than to fail the run over punctuation. */
function stripFence(text: string): string {
  const t = String(text ?? "").trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(t);
  return fenced ? fenced[1] : t;
}

/** Validate + soften + shape the model's reply. Exported for tests: this is
    the boundary where untrusted output becomes something the UI renders. */
export function normaliseAnalysis(parsed: any, input: AnalysisInput, model?: string): AiAnalysis {
  const labelFor = new Map(input.fields.map((f) => [f.label.toLowerCase(), f.label]));
  const raw = Array.isArray(parsed?.patterns) ? parsed.patterns : [];

  const patterns: AiPattern[] = raw.slice(0, 6).map((p: any, i: number) => {
    const from = Number.isFinite(p?.dayFrom) ? Math.max(1, Math.round(p.dayFrom)) : 1;
    const to = Number.isFinite(p?.dayTo) ? Math.min(input.windowDays, Math.round(p.dayTo)) : input.windowDays;
    const lo = Math.min(from, to);
    const hi = Math.max(from, to);
    const strength: AiPattern["strength"] =
      p?.strength === "strong" || p?.strength === "moderate" ? p.strength : "weak";
    return {
      id: `ai_${i}_${String(p?.title || "").slice(0, 24).replace(/\W+/g, "_").toLowerCase()}`,
      title: scrubCausalLanguage(String(p?.title || "").trim()).slice(0, 160),
      detail: scrubCausalLanguage(String(p?.detail || "").trim()).slice(0, 600),
      evidence: scrubCausalLanguage(String(p?.evidence || "").trim()).slice(0, 600),
      // Keep only metric names we actually sent, so the card can't invent a
      // question the person doesn't track.
      metrics: (Array.isArray(p?.metrics) ? p.metrics : [])
        .map((m: any) => labelFor.get(String(m).toLowerCase()) || null)
        .filter((m: string | null): m is string => !!m)
        .slice(0, 4),
      strength,
      range: `${prettyDate(dayToDate(input.startDate, lo))} – ${prettyDate(dayToDate(input.startDate, hi))}`,
      kind: (p?.kind as AiPattern["kind"]) || "other",
    };
  }).filter((p: AiPattern) => p.title && p.detail);

  return {
    generatedAt: new Date().toISOString(),
    model: model || AI_MODEL_LABEL,
    startDate: input.startDate,
    endDate: input.endDate,
    daysAnalysed: input.days.length,
    patterns,
    note: typeof parsed?.note === "string" && parsed.note.trim()
      ? scrubCausalLanguage(parsed.note.trim()).slice(0, 400)
      : undefined,
  };
}

/** Words, not numbers — a language model's "confidence" is not a statistic. */
export function strengthLabel(s: AiPattern["strength"]): { label: string; help: string } {
  if (s === "strong") {
    return {
      label: "Seen often",
      help: "This showed up across most of the days in the window.",
    };
  }
  if (s === "moderate") {
    return {
      label: "Seen repeatedly",
      help: "This showed up on a fair number of days, but not consistently.",
    };
  }
  return {
    label: "Seen a few times",
    help: "Only a handful of days support this. Treat it as something to watch, not a finding.",
  };
}
