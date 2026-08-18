/* The routine — medications, supplements, creams, products, daily drivers.

   Everything here exists to make one interaction cheap: **it is one tap to say
   "took it", and one tap to undo that.** Every other decision follows from
   protecting that tap.

   Three rules this module keeps.

   1. **The item is the plan; the log is the history.** Editing "Vitamin D" to
      2000 IU changes what today's checklist asks for and nothing about what
      last Tuesday says happened — a log carries its own copy of the name, kind
      and dose, written at the moment it was logged. Deleting an item leaves
      its history intact and readable for the same reason.
   2. **An absent log means nothing was said.** It is not a missed dose. A
      *deliberate* miss is a log with `skipped: true`, because "I decided not to
      take it" and "I never opened the app" are different facts and adherence
      built on conflating them is worse than no adherence number at all.
   3. **A dose is whatever the person calls it.** "500 mg", "2 pumps",
      "pea-sized", "1 scoop". Free text, kept as typed. A number-and-unit picker
      would serve tidiness at the cost of the only interaction that matters.

   Nothing here talks to a network, and nothing here is medical. The app does
   not know interactions, does not know maximum doses, and will not warn, rate
   or advise. It writes down what the person tells it. */

import type { RoutineItem, RoutineKind, RoutineLog, RoutineTime } from "../types/models";
import type { DerivedMetric } from "./tracking";
import { localDate, localTime, prettyTime } from "./tracking";

export type { RoutineItem, RoutineKind, RoutineLog, RoutineTime };

const rand = () => Math.random().toString(36).slice(2, 9);
const stamp = () => new Date().toISOString();

/* ---------- catalogues ---------- */

/** The kinds, in the order they are offered. `dosePlaceholder` is the example
    shown in the dose field — a cream prompting for "500 mg" is how a form
    tells someone it wasn't built for them. */
export const ROUTINE_KINDS: {
  id: RoutineKind;
  label: string;
  icon: string;
  dosePlaceholder: string;
  /** Plural noun for empty states and summaries. */
  plural: string;
}[] = [
  { id: "med", label: "Medication", icon: "pill", dosePlaceholder: "e.g. 10 mg", plural: "medications" },
  { id: "supplement", label: "Supplement", icon: "bottle", dosePlaceholder: "e.g. 2 capsules", plural: "supplements" },
  { id: "topical", label: "Cream", icon: "drop", dosePlaceholder: "e.g. 2 pumps", plural: "creams" },
  { id: "product", label: "Product", icon: "tube", dosePlaceholder: "e.g. one wash", plural: "products" },
  { id: "food", label: "Food or drink", icon: "drink", dosePlaceholder: "e.g. 1 scoop", plural: "foods" },
  { id: "other", label: "Other", icon: "star", dosePlaceholder: "e.g. 20 minutes", plural: "things" },
];

export const kindDef = (k: RoutineKind | string) =>
  ROUTINE_KINDS.find((x) => x.id === k) || ROUTINE_KINDS[ROUTINE_KINDS.length - 1];

export const kindLabel = (k: RoutineKind | string): string => kindDef(k).label;

/** The four slots, in clock order, each with the hour it is centred on. The
    hours are only used to guess which slot a fresh log belongs to. */
export const ROUTINE_TIMES: { id: RoutineTime; label: string; icon: string; hour: number }[] = [
  { id: "morning", label: "Morning", icon: "sunrise", hour: 8 },
  { id: "midday", label: "Midday", icon: "sun", hour: 13 },
  { id: "evening", label: "Evening", icon: "moon", hour: 19 },
  { id: "bed", label: "Bedtime", icon: "clock", hour: 22 },
];

export const timeLabel = (t: RoutineTime | string | undefined): string =>
  ROUTINE_TIMES.find((x) => x.id === t)?.label || "Anytime";

/** Which slot a clock time falls in. Only ever a pre-selection. */
export function slotForTime(hhmm: string): RoutineTime {
  const h = Number(String(hhmm).slice(0, 2));
  if (!isFinite(h)) return "morning";
  if (h < 11) return "morning";
  if (h < 16) return "midday";
  if (h < 21) return "evening";
  return "bed";
}

/* ---------- constructors ---------- */

const defined = <T extends object>(o: T): Partial<T> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

export function newRoutineItem(partial: Partial<RoutineItem> & { name: string }): RoutineItem {
  const { name, brand, dose, ...rest } = partial;
  return {
    id: `ri_${Date.now().toString(36)}${rand()}`,
    kind: "supplement",
    times: [],
    daily: true,
    useCount: 0,
    createdAt: stamp(),
    updatedAt: stamp(),
    ...defined(rest as Partial<RoutineItem>),
    // After the spread: these come straight from input fields, and a stray
    // space in a name is a duplicate waiting to happen.
    name: name.trim(),
    brand: brand?.trim() || undefined,
    dose: dose?.trim() || undefined,
  } as RoutineItem;
}

export function newRoutineLog(partial: Partial<RoutineLog> & { itemId: string; name: string }): RoutineLog {
  const now = new Date();
  const given = defined(partial);
  return {
    id: `rl_${Date.now().toString(36)}${rand()}`,
    date: localDate(now),
    time: localTime(now),
    kind: "supplement",
    createdAt: stamp(),
    updatedAt: stamp(),
    ...given,
  } as RoutineLog;
}

/** Log one use of an item. The snapshot is taken here, once, and nothing
    downstream reads back through `itemId` for a name or a dose. */
export function logFromItem(
  item: RoutineItem,
  opts: { date: string; time?: string; slot?: RoutineTime; dose?: string; skipped?: boolean } = { date: localDate() }
): RoutineLog {
  const time = opts.time || localTime();
  return newRoutineLog({
    itemId: item.id,
    name: item.name,
    kind: item.kind,
    date: opts.date,
    time,
    dose: (opts.dose ?? item.dose) || undefined,
    slot: opts.slot,
    skipped: opts.skipped || undefined,
  });
}

/** Count a use against the item it came from. Separate from the log write so
    "logged it" and "the library learned something" stay legible apart. */
export function bumpItemUse(items: RoutineItem[], itemId: string): RoutineItem[] {
  return items.map((it) =>
    it.id === itemId
      ? { ...it, useCount: (it.useCount || 0) + 1, lastUsedAt: stamp(), updatedAt: stamp() }
      : it
  );
}

/* ---------- reading a day ---------- */

const byTime = <T extends { time: string }>(rows: T[]): T[] =>
  rows.slice().sort((a, b) => String(a.time).localeCompare(String(b.time)));

export const routineOn = (logs: RoutineLog[], date: string): RoutineLog[] =>
  byTime((logs || []).filter((r) => r && r.date === date));

/** Everything logged for one item on one day, oldest first. */
export const logsForItem = (logs: RoutineLog[], date: string, itemId: string, slot?: RoutineTime): RoutineLog[] =>
  routineOn(logs, date).filter((r) => r.itemId === itemId && (slot === undefined || r.slot === slot));

/** The items the checklist asks for, in the order they are shown. Archived
    items are never scheduled; as-needed items are offered but not asked for. */
export const scheduledItems = (items: RoutineItem[]): RoutineItem[] =>
  (items || []).filter((i) => i && i.daily && !i.archived);

export const asNeededItems = (items: RoutineItem[]): RoutineItem[] =>
  (items || []).filter((i) => i && !i.daily && !i.archived)
    .sort((a, b) => (b.useCount || 0) - (a.useCount || 0) || a.name.localeCompare(b.name));

/** One line of the checklist: an item, the slot it is being asked for in, and
    the log that answers it — if any. */
export interface RoutineRow {
  item: RoutineItem;
  slot?: RoutineTime;
  log?: RoutineLog;
  done: boolean;
  skipped: boolean;
}

/** One group of checklist rows, headed by a slot (or "Anytime"). */
export interface RoutineGroup {
  slot?: RoutineTime;
  label: string;
  icon: string;
  rows: RoutineRow[];
}

/** The day's checklist, grouped by slot in clock order.

    An item scheduled for morning *and* evening produces two rows, each with
    its own log — which is the whole reason `slot` exists on a log at all.
    An item with no slots produces one row in the "Anytime" group. */
export function routineChecklist(
  items: RoutineItem[],
  logs: RoutineLog[],
  date: string
): RoutineGroup[] {
  const scheduled = scheduledItems(items);
  const groups: RoutineGroup[] = [];

  for (const t of ROUTINE_TIMES) {
    const rows = scheduled
      .filter((i) => (i.times || []).includes(t.id))
      .map((item) => rowFor(item, t.id, logs, date));
    if (rows.length) groups.push({ slot: t.id, label: t.label, icon: t.icon, rows });
  }

  const anytime = scheduled
    .filter((i) => !(i.times || []).length)
    .map((item) => rowFor(item, undefined, logs, date));
  if (anytime.length) groups.push({ label: "Anytime", icon: "clock", rows: anytime });

  return groups;
}

function rowFor(item: RoutineItem, slot: RoutineTime | undefined, logs: RoutineLog[], date: string): RoutineRow {
  /* A log with no slot answers any row for its item — a use logged from the
     as-needed row or an older version of the app still counts as taken, and a
     checklist that ignored it would be asking for a dose already recorded. */
  const mine = logsForItem(logs, date, item.id).filter((r) => r.slot === slot || r.slot == null);
  const log = mine.find((r) => !r.skipped) || mine[0];
  return { item, slot, log, done: !!log && !log.skipped, skipped: !!log?.skipped };
}

export interface RoutineProgress {
  done: number;
  skipped: number;
  total: number;
  /** 0–1 over everything asked for, or null when nothing is scheduled. */
  ratio: number | null;
}

/** How much of the day's plan has been answered. Skips count as answered — the
    question is "did you deal with this", not "did you swallow it". */
export function routineProgress(items: RoutineItem[], logs: RoutineLog[], date: string): RoutineProgress {
  const rows = routineChecklist(items, logs, date).flatMap((g) => g.rows);
  const done = rows.filter((r) => r.done).length;
  const skipped = rows.filter((r) => r.skipped).length;
  return {
    done,
    skipped,
    total: rows.length,
    ratio: rows.length ? (done + skipped) / rows.length : null,
  };
}

/* ---------- summaries ---------- */

/** "2 pumps · Morning" — the one-line description under a timeline row. */
export function routineSummary(log: RoutineLog): string {
  return [
    log.skipped ? "Skipped" : null,
    log.dose?.trim() || null,
    log.slot ? timeLabel(log.slot) : null,
  ].filter(Boolean).join(" · ");
}

/** "CeraVe · 2 pumps · Morning, Evening" — the line under an item in the
    manage list. Says what it is and when it is asked for, in that order. */
export function itemSummary(item: RoutineItem): string {
  const when = item.daily
    ? ((item.times || []).length
      ? ROUTINE_TIMES.filter((t) => item.times.includes(t.id)).map((t) => t.label).join(", ")
      : "Anytime")
    : "As needed";
  return [item.brand?.trim() || null, item.dose?.trim() || null, when].filter(Boolean).join(" · ");
}

/** "8:15 am · 2 pumps" for a use already logged. */
export const logLine = (log: RoutineLog): string =>
  [prettyTime(log.time), log.dose?.trim() || null].filter(Boolean).join(" · ");

/* ---------- searching the item list ---------- */

/** Fold a name for matching: case, spacing and punctuation don't count. */
export const itemKey = (name: string, brand?: string): string =>
  `${String(name || "").trim().toLowerCase()}|${String(brand || "").trim().toLowerCase()}`
    .replace(/[^a-z0-9|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function itemScore(item: RoutineItem, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const name = item.name.toLowerCase();
  const brand = (item.brand || "").toLowerCase();
  if (name.startsWith(q)) return 100;
  if (name.split(/\s+/).some((w) => w.startsWith(q))) return 80;
  if (name.includes(q)) return 60;
  if (brand.includes(q)) return 30;
  return -1;
}

export function searchItems(items: RoutineItem[], query: string): RoutineItem[] {
  if (!query.trim()) return (items || []).slice();
  return (items || [])
    .map((i) => ({ i, s: itemScore(i, query) }))
    .filter((r) => r.s >= 0)
    .sort((a, b) => b.s - a.s || a.i.name.localeCompare(b.i.name))
    .map((r) => r.i);
}

/* ---------- derived daily metrics ----------

   Routine logs are many-per-day; the trend chart is one-value-per-day. These
   are the bridge, in the same shape the food and bowel metrics already use.

   `dir` is "neutral" on both, deliberately. There is no healthy number of
   doses, and colouring adherence red would be this app telling somebody they
   are failing at their prescription — which is precisely the line it does not
   cross. It plots what happened and leaves the reading to the person and their
   doctor. */

export const ROUTINE_METRICS: DerivedMetric[] = [
  {
    k: "rt_taken",
    label: "Doses taken",
    dir: "neutral" as const,
    sec: "Routine",
    value: ({ routine = [], date }) => {
      const rows = routineOn(routine, date).filter((r) => !r.skipped);
      return rows.length ? rows.length : null;
    },
  },
  {
    k: "rt_done",
    label: "Routine completed",
    unit: "%",
    dir: "neutral" as const,
    sec: "Routine",
    value: ({ routine = [], routineItems = [], date }) => {
      const rows = routineChecklist(routineItems, routine, date).flatMap((g) => g.rows);
      if (!rows.length) return null;
      return Math.round((rows.filter((r) => r.done).length / rows.length) * 100);
    },
  },
];

/* ---------- sanitising restored / imported rows ----------

   Backups are user-editable files, and one bad row must not cost the other
   three hundred. Same contract as the food and bowel sanitisers: drop what
   cannot be understood, keep everything that can. */

const str = (v: unknown, max = 400): string => (typeof v === "string" ? v.slice(0, max) : "");
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const KIND_IDS = ROUTINE_KINDS.map((k) => k.id);
const TIME_IDS = ROUTINE_TIMES.map((t) => t.id);

const kindOf = (v: unknown): RoutineKind =>
  (KIND_IDS.includes(v as RoutineKind) ? v : "other") as RoutineKind;

export function sanitizeRoutineItems(rows: unknown): RoutineItem[] {
  if (!Array.isArray(rows)) return [];
  const out: RoutineItem[] = [];
  const seen = new Set<string>();
  for (const r of rows as any[]) {
    if (!r || typeof r !== "object") continue;
    const name = str(r.name, 120).trim();
    if (!name) continue;
    const id = str(r.id, 64) || `ri_${Date.now().toString(36)}${rand()}`;
    // Two rows for the same thing split its history and show twice on the
    // checklist, which reads as a bug in the app rather than in the file.
    if (seen.has(id)) continue;
    seen.add(id);
    const times = Array.isArray(r.times)
      ? (r.times as unknown[]).filter((t): t is RoutineTime => TIME_IDS.includes(t as RoutineTime))
      : [];
    out.push({
      id,
      name,
      kind: kindOf(r.kind),
      brand: str(r.brand, 80).trim() || undefined,
      dose: str(r.dose, 80).trim() || undefined,
      times: [...new Set(times)],
      daily: r.daily !== false,
      notes: str(r.notes, 2000) || undefined,
      archived: r.archived === true || undefined,
      useCount: Math.max(0, Math.round(typeof r.useCount === "number" && isFinite(r.useCount) ? r.useCount : 0)),
      lastUsedAt: str(r.lastUsedAt, 40) || undefined,
      createdAt: str(r.createdAt, 40) || stamp(),
      updatedAt: str(r.updatedAt, 40) || stamp(),
    });
  }
  return out;
}

export function sanitizeRoutineLogs(rows: unknown): RoutineLog[] {
  if (!Array.isArray(rows)) return [];
  const out: RoutineLog[] = [];
  for (const r of rows as any[]) {
    if (!r || typeof r !== "object") continue;
    if (!DATE_RE.test(r.date)) continue;
    const name = str(r.name, 120).trim();
    const itemId = str(r.itemId, 64);
    // A use with neither a name nor an item is a row nothing can render.
    if (!name && !itemId) continue;
    out.push({
      id: str(r.id, 64) || `rl_${Date.now().toString(36)}${rand()}`,
      date: r.date,
      time: TIME_RE.test(r.time) ? r.time : "12:00",
      itemId,
      name: name || "Routine item",
      kind: kindOf(r.kind),
      dose: str(r.dose, 80).trim() || undefined,
      slot: TIME_IDS.includes(r.slot) ? r.slot : undefined,
      skipped: r.skipped === true || undefined,
      notes: str(r.notes, 2000) || undefined,
      createdAt: str(r.createdAt, 40) || stamp(),
      updatedAt: str(r.updatedAt, 40) || stamp(),
    });
  }
  return out;
}
