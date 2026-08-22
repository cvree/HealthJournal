/* What this person actually does — counted, and offered back to them.

   Quick Add shipped as a fixed grid in a fixed order, which is fine for the
   first week and wrong forever after: somebody logging four meals a day and a
   cream twice a day does not need Bowel in the top-left corner every morning,
   and the tap they take forty times a week should be the one nearest their
   thumb. Two answers to that turned out to be very different in the hand, and
   both are here.

   So two things live here, both pure.

   **Ordering.** Every action the app can perform carries a use count and a
   last-used date, and the tiles *can* sort by a score that is frequency decayed
   by recency — because "what I did a hundred times last spring" and "what I did
   twice yesterday" are different kinds of relevant, and only the second one
   predicts the next tap.

   That is now something somebody switches on rather than the default, and the
   reason is worth writing down where the code is. A learned order is a good
   idea on paper and a bad one in the hand: the whole value of a button on a
   phone is that after a week the thumb goes there without the eyes, and a row
   that re-sorts itself overnight spends that every time it guesses right. So
   the default is `manual` — the arrangement holds still, and it changes when
   somebody changes it, by holding a tile and dragging it (see
   src/lib/dragOrder.ts) or with the arrows in the editor.

   The counts are still kept either way: they are what the one-tap repeats
   below are ranked on, and what the switch has to have in order to mean
   anything the day it is turned on.

   **Repeats.** The second time you log a thing is the tap worth saving, so
   anything the journal already knows — a food, a dose, a body spot you
   photograph, a number you record — can be offered as one tap that does it
   again. They compete on the same score, so the row is the person's own habits
   in their own order rather than a menu of everything the app supports. */

const DAY = 86400000;

/** How long it takes for a use to count half as much. Ten days is a
    compromise: short enough that last week's habit outranks last spring's,
    long enough that a fortnight of illness does not wipe out the ordering
    somebody had built up. */
export const HALF_LIFE_DAYS = 10;

export interface UseStat {
  /** How many times this action has been taken. */
  n: number;
  /** YYYY-MM-DD of the last time, when it is known. */
  at?: string;
}

export type ActionStats = Record<string, UseStat>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TRACKED = 60;

export function sanitizeActionStats(raw: unknown): ActionStats {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: ActionStats = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof k !== "string" || !k || k.length > 80) continue;
    if (!v || typeof v !== "object") continue;
    const n = Number((v as UseStat).n);
    if (!Number.isFinite(n) || n <= 0) continue;
    const at = (v as UseStat).at;
    out[k] = { n: Math.min(9999, Math.round(n)), at: typeof at === "string" && DATE_RE.test(at) ? at : undefined };
  }
  /* An unbounded map would grow one key per food ever logged. Keep the ones
     that could plausibly be ranked next and drop the tail — scored against the
     most recent day the map knows about, since this runs on load and has no
     clock of its own. */
  const keys = Object.keys(out);
  if (keys.length <= MAX_TRACKED) return out;
  let newest = "0000-01-01";
  for (const k of keys) if (out[k].at && out[k].at! > newest) newest = out[k].at!;
  const kept = keys
    .sort((a, b) => scoreOf(out[b], newest) - scoreOf(out[a], newest) || (out[b].n - out[a].n))
    .slice(0, MAX_TRACKED);
  const trimmed: ActionStats = {};
  for (const k of kept) trimmed[k] = out[k];
  return trimmed;
}

const daysBetween = (from: string, to: string): number => {
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) return 0;
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  return Math.max(0, Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / DAY));
};

/** 1 today, ½ after ten days, ¼ after twenty. Never zero — an old habit is
    still evidence, just weaker than a new one. */
export function recencyWeight(lastAt: string | undefined, today: string): number {
  if (!lastAt) return 0.35; // used, but we don't know when: assume stale
  return Math.pow(0.5, daysBetween(lastAt, today) / HALF_LIFE_DAYS);
}

export function scoreOf(stat: UseStat | undefined, today: string): number {
  if (!stat || !stat.n) return 0;
  return stat.n * recencyWeight(stat.at, today);
}

/** Record one use. Same-day repeats still count — logging three meals is three
    uses of the food tile, and that is exactly the signal worth having. */
export function noteUse(stats: ActionStats, id: string, today: string): ActionStats {
  if (!id) return stats;
  const cur = stats[id];
  return sanitizeActionStats({ ...stats, [id]: { n: (cur?.n || 0) + 1, at: today } });
}

export type OrderMode = "auto" | "manual";

/**
 * Put the ids in the order this person is most likely to want them.
 *
 * `manual` returns them untouched: somebody who arranged their own screen has
 * said what they want, and re-sorting it behind their back is the app knowing
 * better. `auto` sorts by score, and — this is the part that matters — it is a
 * *stable* sort, so two actions that have never been used stay in the order the
 * catalogue gave them rather than shuffling on every render.
 *
 * The mode is the caller's to state — this ranks when asked to. Which of the
 * two the *app* defaults to is a product decision and lives with the profile,
 * in resolveQuickAdd; it is `manual`.
 */
export function rankIds(
  ids: string[], stats: ActionStats, today: string, mode: OrderMode = "auto"
): string[] {
  if (mode === "manual") return [...ids];
  return ids
    .map((id, i) => ({ id, i, s: scoreOf(stats[id], today) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.id);
}

/* ---------- one-tap repeats ---------- */

export type RepeatKind = "food" | "routine" | "photo" | "measurement" | "note";

export interface RepeatItem {
  /** Stable id for the stats map: `${kind}:${refId}`. */
  id: string;
  kind: RepeatKind;
  /** The thing itself — a food id, a routine item id, a field key. */
  refId: string;
  label: string;
  sub: string;
  icon: string;
  score: number;
}

export interface RepeatSource {
  today: string;
  foods?: { id: string; name: string; serving?: string; useCount?: number; lastUsedAt?: string; favorite?: boolean }[];
  routineItems?: { id: string; name: string; dose?: string; kind?: string; archived?: boolean; useCount?: number; lastUsedAt?: string }[];
  /** Photo questions, with the last date each was photographed. */
  photoFields?: { k: string; label: string; lastAt?: string }[];
  /** Number questions, with the last value recorded and when. */
  numberFields?: { k: string; label: string; unit?: string; lastValue?: number | null; lastAt?: string }[];
  /** True when today already has a note — the offer disappears rather than
      inviting somebody to overwrite what they wrote this morning. */
  hasNoteToday?: boolean;
  /** Any note at all in the journal: the row does not advertise a habit
      somebody has never had. */
  hasEverNoted?: boolean;
  stats?: ActionStats;
  max?: number;
}

const iso10 = (s: string | undefined): string | undefined =>
  typeof s === "string" && s.length >= 10 ? s.slice(0, 10) : undefined;

/**
 * The things worth offering as one tap, ranked together.
 *
 * Foods and routine items carry their own counts, so they are ranked on those
 * rather than on the action-stats map — the map records "the food tile was
 * used", which is a different fact from "this particular breakfast was". A
 * favourite gets a deliberate thumb on the scale, because marking one is an
 * explicit "I will want this again" and outranks arithmetic.
 */
export function repeatSuggestions(src: RepeatSource): RepeatItem[] {
  const { today } = src;
  const out: RepeatItem[] = [];

  for (const f of src.foods || []) {
    const n = f.useCount || 0;
    if (!n) continue;
    out.push({
      id: `food:${f.id}`, kind: "food", refId: f.id,
      label: f.name, sub: f.serving || "", icon: "food",
      score: scoreOf({ n: n + (f.favorite ? 3 : 0), at: iso10(f.lastUsedAt) }, today),
    });
  }

  for (const r of src.routineItems || []) {
    if (r.archived) continue;
    const n = r.useCount || 0;
    if (!n) continue;
    out.push({
      id: `routine:${r.id}`, kind: "routine", refId: r.id,
      label: r.name, sub: r.dose || "one dose", icon: "pill",
      score: scoreOf({ n, at: iso10(r.lastUsedAt) }, today),
    });
  }

  /* A body spot photographed before, not photographed today. The score is
     built from the gap rather than a count: the value of another shot goes
     *up* the longer it has been, which is the opposite of everything else
     here. */
  for (const p of src.photoFields || []) {
    const last = iso10(p.lastAt);
    if (!last || last === today) continue;
    const gap = daysBetween(last, today);
    out.push({
      id: `photo:${p.k}`, kind: "photo", refId: p.k,
      label: p.label, sub: gap === 1 ? "1 day since the last" : `${gap} days since the last`,
      icon: "camera",
      score: Math.min(3, gap / 7) * (scoreOf(src.stats?.[`photo:${p.k}`], today) || 1),
    });
  }

  for (const nf of src.numberFields || []) {
    if (nf.lastValue == null) continue;
    const last = iso10(nf.lastAt);
    if (last === today) continue;
    out.push({
      id: `measure:${nf.k}`, kind: "measurement", refId: nf.k,
      label: nf.label,
      sub: `last ${nf.lastValue}${nf.unit ? ` ${nf.unit}` : ""}`,
      icon: "target",
      score: scoreOf(src.stats?.[`measure:${nf.k}`], today) || (last ? recencyWeight(last, today) : 0.3),
    });
  }

  if (src.hasEverNoted && !src.hasNoteToday) {
    out.push({
      id: "note", kind: "note", refId: "note",
      label: "Note", sub: "a line about today", icon: "note",
      score: scoreOf(src.stats?.note, today) || 0.4,
    });
  }

  return out.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label)).slice(0, src.max ?? 8);
}
