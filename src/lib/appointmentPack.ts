/* The Appointment Pack.

   Ten minutes with a specialist, once every few months, is the moment this
   whole journal is *for*. What it has to survive is the question "so how have
   you been?" — asked while the person is nervous, on a paper gown, trying to
   summarise a hundred and twenty days from memory. Memory answers with the
   last bad week, because that is what memory does.

   So the pack is not another export. An export hands over rows and asks the
   reader to do the arithmetic; this does the arithmetic and hands over the
   answer, on paper, in the order a consultation actually runs: how it has been,
   what the days were like, what the bad stretches were, what changed, what is
   being taken, what it looks like, what happened, and — last, because it is the
   part that is *theirs* — what they want to ask.

   Everything here is pure and takes the day it should call today. Four rules
   govern the numbers:

   1. **Nothing is invented.** A figure with nothing behind it is omitted with
      its reason recorded, never printed as a zero. "No flares recorded" and
      "no flares happened" are different sentences and only the first one is
      knowable.
   2. **A comparison needs both sides.** The previous window is the same number
      of days immediately before the range. If either side is too thin, the
      change is null — a "+2.1" built on three days against thirty is a lie
      with a decimal point in it.
   3. **Coverage travels with every average.** Any clinician reading "5.8" is
      entitled to know it came from 22 days out of 30, and the pack never makes
      them ask.
   4. **The app does not grade anybody.** Adherence is a count of what was
      recorded against what the plan asks for. It is not a score, it carries no
      colour, and the reading of it belongs to the two people in the room. */

import { CALM_AT, HARD_AT, badness, distribution, type Direction } from "./distribution";
import {
  addDays, daySpan, episodeStats, lastDay,
  type EpisodeStats, type HealthEpisode,
} from "./episodes";
import { convertValue } from "./labs";
import { asNeededItems, kindLabel, routineChecklist, routineOn } from "./routine";
import type { RoutineItem, RoutineLog } from "../types/models";

/* ---------- inputs ---------- */

/** Anything with a date and answers — a DailyEntry, or the merged rows the
    charts build with derived metrics folded in. */
export interface PackEntry {
  date: string;
  answers?: Record<string, unknown>;
  notes?: string;
}

/** A metric as the pack needs to talk about it. `dir` decides which way is
    better; "neutral" means the pack will report movement and refuse to call it
    an improvement. */
export interface PackMetric {
  key: string;
  label: string;
  dir?: Direction;
  unit?: string;
  /** True for a 1–10 rating. Only these get the best/hardest/usual block. */
  scale?: boolean;
}

export type PackSectionKey =
  | "summary" | "scores" | "flares" | "changes"
  | "labs" | "sun" | "routine" | "photos" | "notes" | "questions";

export interface PackSectionDef {
  key: PackSectionKey;
  label: string;
  hint: string;
}

/** The order they print in, which is the order a consultation runs in. */
export const PACK_SECTIONS: PackSectionDef[] = [
  { key: "summary", label: "How it's been", hint: "The average, the change since last time, and how many days it rests on" },
  { key: "scores", label: "Best, hardest, usual", hint: "The shape of the days behind that average" },
  { key: "flares", label: "Flares", hint: "How many, how long they ran, how bad they got" },
  { key: "changes", label: "Biggest changes", hint: "The three metrics that moved the most" },
  /* Labs come directly after the changes and before the routine, which is the
     order the conversation actually runs in: how it's been, what moved, what
     the bloods said, what you're taking. */
  { key: "labs", label: "Measurements", hint: "Blood work and measurements, with the range your lab printed" },
  { key: "sun", label: "Time outside", hint: "Daylight and sun, and the estimated vitamin D beside it" },
  { key: "routine", label: "Routine", hint: "What was taken or applied, against what the plan asks for" },
  { key: "photos", label: "Photos", hint: "One before-and-after pair" },
  { key: "notes", label: "Notes", hint: "The days you pick out yourself" },
  { key: "questions", label: "Questions for my appointment", hint: "Yours to write — printed with room to answer" },
];

export const PACK_SECTION_KEYS: PackSectionKey[] = PACK_SECTIONS.map((s) => s.key);

export const DEFAULT_PACK_SECTIONS: Record<PackSectionKey, boolean> =
  PACK_SECTION_KEYS.reduce((acc, k) => { acc[k] = true; return acc; },
    {} as Record<PackSectionKey, boolean>);

/** What the pack remembers between appointments. Lives on the profile, so the
    questions somebody spent a fortnight collecting are still there when they
    open the app in the waiting room. */
export interface PackPrefs {
  /** YYYY-MM-DD of the last appointment, when the person has told us. */
  lastAppointment?: string | null;
  sections: Record<PackSectionKey, boolean>;
  questions: string[];
  /** Dates of the notes ticked for the pack. */
  noteDates: string[];
  /** Which photo field the before-and-after pair comes from. */
  photoField?: string | null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_QUESTIONS = 10;
const MAX_QUESTION_LEN = 200;
const MAX_NOTES = 6;

export const DEFAULT_PACK_PREFS: PackPrefs = {
  lastAppointment: null,
  sections: { ...DEFAULT_PACK_SECTIONS },
  questions: [],
  noteDates: [],
  photoField: null,
};

/** Prefs arrive from local storage, a hand-editable backup and a sync pull, so
    they are repaired on every read rather than trusted on any of them. */
export function sanitizePackPrefs(raw: unknown): PackPrefs {
  const r = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const sections = { ...DEFAULT_PACK_SECTIONS };
  const rs = r.sections;
  if (rs && typeof rs === "object" && !Array.isArray(rs)) {
    for (const k of PACK_SECTION_KEYS) {
      const v = (rs as Record<string, unknown>)[k];
      if (typeof v === "boolean") sections[k] = v;
    }
  }
  const questions = (Array.isArray(r.questions) ? r.questions : [])
    .filter((q): q is string => typeof q === "string")
    .map((q) => q.trim().slice(0, MAX_QUESTION_LEN))
    .filter(Boolean)
    .slice(0, MAX_QUESTIONS);
  const noteDates = (Array.isArray(r.noteDates) ? r.noteDates : [])
    .filter((d): d is string => typeof d === "string" && DATE_RE.test(d))
    .slice(0, MAX_NOTES);
  return {
    lastAppointment: typeof r.lastAppointment === "string" && DATE_RE.test(r.lastAppointment)
      ? r.lastAppointment : null,
    sections,
    questions,
    noteDates,
    photoField: typeof r.photoField === "string" && r.photoField ? r.photoField.slice(0, 80) : null,
  };
}

/* ---------- the range ---------- */

export type PackRangeSource = "appointment" | "days" | "custom" | "all";

export interface PackRange {
  start: string;
  end: string;
  /** Calendar days it covers, inclusive. */
  days: number;
  label: string;
  source: PackRangeSource;
}

const fmtDay = (date: string): string => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

/** The last `n` days, ending today. */
export function rangeOfDays(n: number, today: string): PackRange {
  const start = addDays(today, -(Math.max(1, n) - 1));
  return { start, end: today, days: daySpan(start, today), label: `Last ${Math.max(1, n)} days`, source: "days" };
}

/** Everything since the last appointment, that day included — it is the visit
    the person is comparing against, and clipping it off loses the one day both
    sides of the conversation remember. */
export function rangeSinceAppointment(last: string, today: string): PackRange {
  const start = last <= today ? last : today;
  return {
    start, end: today, days: daySpan(start, today),
    label: `Since ${fmtDay(start)}`,
    source: "appointment",
  };
}

export function rangeCustom(start: string, end: string): PackRange {
  const [a, b] = start <= end ? [start, end] : [end, start];
  return { start: a, end: b, days: daySpan(a, b), label: `${fmtDay(a)} – ${fmtDay(b)}`, source: "custom" };
}

/** The same number of days immediately before the range. Everything the pack
    calls a "change" is measured against this and nothing else. */
export function previousWindow(range: PackRange): { start: string; end: string; days: number } {
  const end = addDays(range.start, -1);
  const start = addDays(end, -(range.days - 1));
  return { start, end, days: range.days };
}

/* ---------- the model ---------- */

export type ChangeVerdict = "better" | "worse" | "same" | "unknown";

export interface PackHeadline {
  key: string;
  label: string;
  unit?: string;
  average: number | null;
  previousAverage: number | null;
  /** average − previousAverage. Null unless both windows clear the floor. */
  change: number | null;
  verdict: ChangeVerdict;
  /** Days in range carrying a score for this metric, out of days in range. */
  loggedDays: number;
  rangeDays: number;
  coverage: number;
  /** Days carrying any entry at all — a day with a photo and no rating is
      still a day somebody showed up. */
  entryDays: number;
  previousLabel: string;
  previousLoggedDays: number;
}

export interface PackScores {
  best: number | null;
  hardest: number | null;
  mostCommon: number | null;
  mostCommonDays: number;
  hardDays: number;
  calmDays: number;
  total: number;
  /** The thresholds the two counts used, said the way a reader would say them. */
  hardAt: string;
  calmAt: string;
}

export interface PackFlare {
  id: string;
  title: string;
  start: string;
  end: string | null;
  open: boolean;
  days: number;
  average: number | null;
  peak: number | null;
}

export interface PackFlares {
  count: number;
  /** Days inside a flare, clipped to the range — a flare that started before it
      contributes only the part that happened in the window. */
  flareDays: number;
  ongoing: number;
  avgDuration: number | null;
  longestDuration: number | null;
  longestTitle: string | null;
  avgSeverity: number | null;
  peakSeverity: number | null;
  peakDate: string | null;
  peakTitle: string | null;
  items: PackFlare[];
}

export interface PackChange {
  key: string;
  label: string;
  unit?: string;
  current: number;
  previous: number;
  delta: number;
  /** |delta| as a share of the previous average — the only fair way to rank a
      1–10 rating against a step count. */
  relative: number;
  verdict: ChangeVerdict;
  days: number;
  previousDays: number;
}

export interface PackRoutineItem {
  id: string;
  name: string;
  kind: string;
  kindLabel: string;
  dose?: string;
  /** Doses the plan asked for across the range, from the day the item existed. */
  planned: number;
  taken: number;
  skipped: number;
  /** taken / planned, or null for an as-needed item, which has no plan to miss. */
  adherence: number | null;
  asNeeded: boolean;
}

export interface PackRoutine {
  items: PackRoutineItem[];
  planned: number;
  taken: number;
  skipped: number;
  adherence: number | null;
  /** Days in range where the plan asked for anything at all. */
  daysWithPlan: number;
}

export interface PackPhotoSide {
  photoId: string;
  date: string;
  rating?: number | null;
}

export interface PackPhotoPair {
  fieldKey: string;
  label: string;
  spot: string;
  ratingLabel?: string;
  before: PackPhotoSide;
  after: PackPhotoSide;
  /** Days between the two shots. */
  apart: number;
}

/** One test's history, as the pack prints it. Everything here comes off the
    stored result — including the reference range, which is the laboratory's own
    and never this app's. */
export interface PackLab {
  test: string;
  name: string;
  unit: string;
  /** Oldest first. */
  points: { date: string; value: string; status: string; fasting?: boolean }[];
  /** "24 → 31 → 38 ng/mL" */
  series: string;
  /** The lab's own range, printed once under the row. */
  range?: string;
  latestOn: string;
  provider?: string;
}

/** Time outside across the range, and the estimate beside it — labelled, in
    its own units, and never in the same column as a blood result. */
export interface PackSun {
  days: number;
  sessions: number;
  minutes: number;
  /** Average minutes on the days there was a session at all. */
  averageMinutes: number;
  estimatedLow: number;
  estimatedHigh: number;
  /** The sentence that keeps the two kinds of number apart on paper. */
  estimateNote: string;
}

export interface PackNote {
  date: string;
  text: string;
}

export interface PackOmission {
  key: PackSectionKey;
  reason: string;
}

export interface AppointmentPack {
  range: PackRange;
  previous: { start: string; end: string; days: number };
  sections: Record<PackSectionKey, boolean>;
  headline: PackHeadline | null;
  scores: PackScores | null;
  flares: PackFlares | null;
  changes: PackChange[];
  labs: PackLab[];
  sun: PackSun | null;
  routine: PackRoutine | null;
  photo: PackPhotoPair | null;
  notes: PackNote[];
  questions: string[];
  /** Sections asked for that had nothing to say, and why. Printed nowhere —
      shown in the app, so somebody who logs irregularly learns what the pack
      needs instead of concluding it is broken. */
  omitted: PackOmission[];
}

export interface PackInput {
  today: string;
  range: PackRange;
  entries: PackEntry[];
  primary: PackMetric;
  /** Everything comparable, primary included. The changes block skips the
      primary metric because the headline already is it. */
  metrics?: PackMetric[];
  episodes?: HealthEpisode[];
  routineItems?: RoutineItem[];
  routineLogs?: RoutineLog[];
  /** Lab results and sun sessions, already sanitised. Shapes are structural
      rather than imported so this module keeps its "imports nothing heavy"
      property — see the header. */
  labs?: {
    id: string; test: string; name: string; value: number; value2?: number;
    unit: string; date: string; refLow?: number; refHigh?: number;
    fasting?: boolean; provider?: string;
  }[];
  sun?: { date: string; minutes: number; iuLow: number; iuHigh: number }[];
  sections?: Partial<Record<PackSectionKey, boolean>>;
  /** Dates of the notes the person ticked. */
  noteDates?: string[];
  questions?: string[];
  photo?: PackPhotoPair | null;
}

/* Floors. A pack that prints a change off two days is worse than one that
   prints nothing, because the second is obviously incomplete and the first is
   confidently wrong. */
export const MIN_AVERAGE_DAYS = 3;
export const MIN_CHANGE_DAYS = 5;

const round1 = (x: number): number => Math.round(x * 10) / 10;

function valuesIn(entries: PackEntry[], key: string, start: string, end: string): { date: string; v: number }[] {
  const out: { date: string; v: number }[] = [];
  for (const e of entries) {
    if (!e || e.date < start || e.date > end) continue;
    const v = e.answers?.[key];
    if (typeof v === "number" && Number.isFinite(v)) out.push({ date: e.date, v });
  }
  return out;
}

const mean = (xs: number[]): number | null =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

/** Which way a move counts. A metric with no direction moves and is not judged. */
export function verdictFor(delta: number, dir: Direction): ChangeVerdict {
  if (dir === "neutral") return "unknown";
  if (Math.abs(delta) < 0.05) return "same";
  const better = dir === "pos" ? delta > 0 : delta < 0;
  return better ? "better" : "worse";
}

/* ---------- the parts ---------- */

function buildHeadline(input: PackInput): PackHeadline | null {
  const { entries, range, primary } = input;
  const prev = previousWindow(range);
  const now = valuesIn(entries, primary.key, range.start, range.end);
  const before = valuesIn(entries, primary.key, prev.start, prev.end);
  const entryDays = new Set(
    entries.filter((e) => e && e.date >= range.start && e.date <= range.end).map((e) => e.date)
  ).size;
  if (!now.length && !entryDays) return null;

  const average = now.length >= MIN_AVERAGE_DAYS ? mean(now.map((p) => p.v)) : null;
  const previousAverage = before.length >= MIN_CHANGE_DAYS ? mean(before.map((p) => p.v)) : null;
  const change = average != null && previousAverage != null && now.length >= MIN_CHANGE_DAYS
    ? average - previousAverage
    : null;

  return {
    key: primary.key,
    label: primary.label,
    unit: primary.unit,
    average,
    previousAverage,
    change,
    verdict: change == null ? "unknown" : verdictFor(change, primary.dir),
    loggedDays: now.length,
    rangeDays: range.days,
    coverage: range.days ? now.length / range.days : 0,
    entryDays,
    previousLabel: `${fmtDay(prev.start)} – ${fmtDay(prev.end)}`,
    previousLoggedDays: before.length,
  };
}

function buildScores(input: PackInput): PackScores | null {
  const { entries, range, primary } = input;
  if (primary.scale === false) return null;
  const stats = distribution({
    entries, key: primary.key, dir: primary.dir, start: range.start, end: range.end,
  });
  if (!stats.total) return null;
  return {
    best: stats.best,
    hardest: stats.worst,
    mostCommon: stats.mode,
    mostCommonDays: stats.modeDays,
    hardDays: stats.hardDays,
    calmDays: stats.calmDays,
    total: stats.total,
    hardAt: primary.dir === "pos" ? `${11 - HARD_AT} or lower` : `${HARD_AT} or higher`,
    calmAt: primary.dir === "pos" ? `${11 - CALM_AT} or higher` : `${CALM_AT} or lower`,
  };
}

/** Days of an episode that fall inside the range. */
function daysInRange(ep: HealthEpisode, range: PackRange, today: string): number {
  const a = ep.start > range.start ? ep.start : range.start;
  const last = lastDay(ep, today);
  const b = last < range.end ? last : range.end;
  return a > b ? 0 : daySpan(a, b);
}

function buildFlares(input: PackInput): PackFlares | null {
  const { episodes = [], entries, range, today, primary } = input;
  const overlapping = episodes.filter((ep) => daysInRange(ep, range, today) > 0);
  if (!overlapping.length) return null;

  const dirOf = (key: string): Direction =>
    (input.metrics || []).find((m) => m.key === key)?.dir ?? primary.dir;

  const stats: EpisodeStats[] = overlapping
    .map((ep) => episodeStats(ep, { entries, today, dir: dirOf(ep.metric), all: episodes }))
    .sort((a, b) => (a.start < b.start ? 1 : -1)); // newest first

  const flareDays = overlapping.reduce((a, ep) => a + daysInRange(ep, range, today), 0);
  const durations = stats.map((s) => s.days);
  const averages = stats.map((s) => s.average).filter((v): v is number => v != null);

  let longest: EpisodeStats | null = null;
  let worst: EpisodeStats | null = null;
  for (const s of stats) {
    if (!longest || s.days > longest.days) longest = s;
    if (s.peak != null && (!worst || worst.peak == null ||
      badness(s.peak, dirOf(s.metric)) > badness(worst.peak, dirOf(worst.metric)))) worst = s;
  }

  return {
    count: stats.length,
    flareDays,
    ongoing: stats.filter((s) => s.open).length,
    avgDuration: mean(durations),
    longestDuration: longest ? longest.days : null,
    longestTitle: longest ? longest.title : null,
    avgSeverity: mean(averages),
    peakSeverity: worst?.peak ?? null,
    peakDate: worst?.peakDate ?? null,
    peakTitle: worst?.title ?? null,
    items: stats.slice(0, 4).map((s) => ({
      id: s.id, title: s.title, start: s.start, end: s.end, open: s.open,
      days: s.days, average: s.average, peak: s.peak,
    })),
  };
}

/**
 * The three metrics that moved the most.
 *
 * Ranked by *relative* movement, not absolute: a step count that fell by 900
 * and an itch rating that rose by 1.5 cannot be compared on the raw number, and
 * sorting on it would fill every pack with whichever metric happens to have the
 * biggest units. Both figures are carried so the printed line says the real one.
 */
export function buildChanges(input: PackInput): PackChange[] {
  const { entries, range, primary } = input;
  const prev = previousWindow(range);
  const out: PackChange[] = [];
  const seen = new Set<string>([primary.key]);

  for (const m of input.metrics || []) {
    if (seen.has(m.key)) continue;
    seen.add(m.key);
    const now = valuesIn(entries, m.key, range.start, range.end);
    const before = valuesIn(entries, m.key, prev.start, prev.end);
    if (now.length < MIN_CHANGE_DAYS || before.length < MIN_CHANGE_DAYS) continue;
    const current = mean(now.map((p) => p.v))!;
    const previous = mean(before.map((p) => p.v))!;
    const delta = current - previous;
    if (Math.abs(delta) < 0.05) continue;
    const base = Math.abs(previous);
    out.push({
      key: m.key, label: m.label, unit: m.unit,
      current, previous, delta,
      relative: base > 0.0001 ? Math.abs(delta) / base : Math.abs(delta),
      verdict: verdictFor(delta, m.dir),
      days: now.length, previousDays: before.length,
    });
  }

  return out.sort((a, b) => b.relative - a.relative).slice(0, 3);
}

/**
 * What was taken, against what the plan asks for.
 *
 * The plan is only knowable as it stands *today* — the app does not keep a
 * history of schedules — so an item counts from the day it was created and no
 * earlier. Without that, adding a medication on Monday would print four weeks
 * of missed doses that were never asked for.
 */
export function buildRoutine(input: PackInput): PackRoutine | null {
  const items = input.routineItems || [];
  const logs = input.routineLogs || [];
  if (!items.length) return null;
  const { range } = input;

  const acc = new Map<string, PackRoutineItem>();
  const born = new Map<string, string>();
  for (const it of items) born.set(it.id, String(it.createdAt || "").slice(0, 10));

  let planned = 0, taken = 0, skipped = 0, daysWithPlan = 0;

  for (let d = range.start; d <= range.end; d = addDays(d, 1)) {
    let askedToday = 0;
    for (const group of routineChecklist(items, logs, d)) {
      for (const row of group.rows) {
        const from = born.get(row.item.id);
        if (from && from > d) continue; // the item did not exist yet
        askedToday += 1;
        planned += 1;
        if (row.done) taken += 1;
        if (row.skipped) skipped += 1;
        const cur = acc.get(row.item.id) || {
          id: row.item.id, name: row.item.name, kind: row.item.kind,
          kindLabel: kindLabel(row.item.kind), dose: row.item.dose,
          planned: 0, taken: 0, skipped: 0, adherence: null, asNeeded: false,
        };
        cur.planned += 1;
        if (row.done) cur.taken += 1;
        if (row.skipped) cur.skipped += 1;
        acc.set(row.item.id, cur);
      }
    }
    if (askedToday) daysWithPlan += 1;
  }

  /* As-needed items have no plan to miss, so they are counted, not scored —
     "used 6 times" is the fact; an adherence percentage would be invented. */
  for (const it of asNeededItems(items)) {
    let used = 0;
    for (let d = range.start; d <= range.end; d = addDays(d, 1)) {
      used += routineOn(logs, d).filter((r) => r.itemId === it.id && !r.skipped).length;
    }
    if (!used) continue;
    acc.set(it.id, {
      id: it.id, name: it.name, kind: it.kind, kindLabel: kindLabel(it.kind), dose: it.dose,
      planned: 0, taken: used, skipped: 0, adherence: null, asNeeded: true,
    });
  }

  const list = [...acc.values()].map((r) => ({
    ...r,
    adherence: r.planned ? r.taken / r.planned : null,
  }));
  if (!list.length) return null;

  list.sort((a, b) => Number(a.asNeeded) - Number(b.asNeeded) || b.planned - a.planned || b.taken - a.taken);

  return {
    items: list.slice(0, 8),
    planned, taken, skipped,
    adherence: planned ? taken / planned : null,
    daysWithPlan,
  };
}

/** The notes worth offering for the pack: every note in the range, newest
    first. The choosing is the person's — an app picking which sentence a
    doctor reads is an app editing somebody's account of their own illness. */
export function candidateNotes(entries: PackEntry[], range: PackRange): PackNote[] {
  return entries
    .filter((e) => e && e.date >= range.start && e.date <= range.end && typeof e.notes === "string" && e.notes.trim())
    .map((e) => ({ date: e.date, text: e.notes!.trim() }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

/* ---------- labs ----------

   The pack prints every test with a result in the range, plus the reading
   immediately before the range where there is one — because "38, up from 31 in
   March" is the sentence a clinician wants and "38" on its own is not.

   The range printed under each row is the laboratory's own, carried on the
   record. A test whose results never carried one prints no range and no
   verdict, which is the honest output: this app does not know what normal is
   for somebody else's assay. */

export function buildLabs(input: PackInput): PackLab[] {
  const rows = (input.labs || []).filter((r) => r && r.date <= input.range.end);
  if (!rows.length) return [];
  const byTest = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byTest.get(r.test) || [];
    list.push(r);
    byTest.set(r.test, list);
  }

  const out: PackLab[] = [];
  for (const [test, all] of byTest) {
    const sorted = [...all].sort((a, b) => (a.date < b.date ? -1 : 1));
    const inRange = sorted.filter((r) => r.date >= input.range.start);
    if (!inRange.length) continue;
    /* One reading of context from before the range, so a single new result is
       still a comparison rather than a lone number. */
    const before = sorted.filter((r) => r.date < input.range.start).slice(-1);
    const shown = [...before, ...inRange];
    /* Everything is put onto the most recent reading's unit — the one the
       person is currently holding a report for — the same way the app's own
       lab screen does it. A reading that cannot be converted is dropped rather
       than printed at the wrong scale, which on paper next to a range would be
       the worst kind of error this document could make. */
    const unit = shown[shown.length - 1].unit;
    const usable = shown
      .map((r) => onUnit(test, r, unit))
      .filter((r): r is NonNullable<typeof r> => r !== null);
    if (!usable.length) continue;
    const latest = usable[usable.length - 1];
    out.push({
      test,
      name: latest.name,
      unit,
      points: usable.map((r) => ({
        date: r.date,
        value: r.value2 !== undefined ? `${trim(r.value)}/${trim(r.value2)}` : trim(r.value),
        status: labStatus(r),
        fasting: r.fasting,
      })),
      series: `${usable.map((r) => trim(r.value)).join(" → ")} ${unit}`.trim(),
      range: rangeText(latest),
      latestOn: latest.date,
      provider: latest.provider,
    });
  }
  return out.sort((a, b) => (a.latestOn < b.latestOn ? 1 : -1)).slice(0, 8);
}

const trim = (v: number): string => String(Math.round(v * 100) / 100);

/** One result, expressed in `unit`, or null when that cannot be done honestly.
    The laboratory's own range is converted with it — a value in ng/mL judged
    against a range in nmol/L would be nonsense printed with confidence. */
function onUnit<T extends { unit: string; value: number; value2?: number; refLow?: number; refHigh?: number }>(
  test: string, r: T, unit: string
): T | null {
  if (r.unit === unit) return r;
  const value = convertValue(test, r.value, r.unit, unit);
  if (value == null) return null;
  const conv = (v: number | undefined) =>
    v === undefined ? undefined : convertValue(test, v, r.unit, unit) ?? undefined;
  return {
    ...r,
    unit,
    value,
    value2: conv(r.value2),
    refLow: conv(r.refLow),
    refHigh: conv(r.refHigh),
  };
}

function labStatus(r: { value: number; refLow?: number; refHigh?: number }): string {
  if (r.refLow === undefined && r.refHigh === undefined) return "";
  if (r.refLow !== undefined && r.value < r.refLow) return "below range";
  if (r.refHigh !== undefined && r.value > r.refHigh) return "above range";
  return "in range";
}

function rangeText(r: { unit: string; refLow?: number; refHigh?: number }): string | undefined {
  if (r.refLow === undefined && r.refHigh === undefined) return undefined;
  const lo = r.refLow !== undefined ? trim(r.refLow) : "–";
  const hi = r.refHigh !== undefined ? trim(r.refHigh) : "–";
  return `Your lab's range: ${lo}–${hi} ${r.unit}`;
}

/* ---------- time outside ----------

   Two numbers a clinician can use — how much daylight somebody actually got,
   and over how many days — and one they can't, printed as what it is. The
   estimate note is not optional and not a footnote: on paper, next to a real
   laboratory value, an unlabelled IU figure is the single most misreadable
   thing this app could produce. */

export const SUN_ESTIMATE_NOTE =
  "Estimated from sun position, skin type and exposure — a research model, not a measurement. A blood level is the measurement; see Measurements above.";

export function buildSun(input: PackInput): PackSun | null {
  const rows = (input.sun || []).filter(
    (s) => s && s.date >= input.range.start && s.date <= input.range.end
  );
  if (!rows.length) return null;
  const days = new Set(rows.map((s) => s.date)).size;
  const minutes = rows.reduce((a, s) => a + s.minutes, 0);
  return {
    days,
    sessions: rows.length,
    minutes,
    averageMinutes: days ? Math.round(minutes / days) : 0,
    estimatedLow: rows.reduce((a, s) => a + s.iuLow, 0),
    estimatedHigh: rows.reduce((a, s) => a + s.iuHigh, 0),
    estimateNote: SUN_ESTIMATE_NOTE,
  };
}

/* ---------- the whole thing ---------- */

export function buildAppointmentPack(input: PackInput): AppointmentPack {
  const sections = { ...DEFAULT_PACK_SECTIONS, ...(input.sections || {}) };
  const omitted: PackOmission[] = [];
  const want = (k: PackSectionKey) => sections[k] !== false;

  const headline = want("summary") ? buildHeadline(input) : null;
  if (want("summary") && !headline) omitted.push({ key: "summary", reason: "Nothing logged in this range yet." });
  if (headline && headline.change == null && headline.average != null) {
    omitted.push({
      key: "summary",
      reason: `The ${input.range.days} days before this range have fewer than ${MIN_CHANGE_DAYS} logged days, so the pack won't print a change.`,
    });
  }

  const scores = want("scores") ? buildScores(input) : null;
  if (want("scores") && !scores) omitted.push({ key: "scores", reason: `No ${input.primary.label} ratings in this range.` });

  const flares = want("flares") ? buildFlares(input) : null;
  if (want("flares") && !flares) omitted.push({ key: "flares", reason: "No flares marked in this range." });

  const changes = want("changes") ? buildChanges(input) : [];
  if (want("changes") && !changes.length) {
    omitted.push({
      key: "changes",
      reason: `A change needs ${MIN_CHANGE_DAYS} logged days on each side of the range.`,
    });
  }

  const labs = want("labs") ? buildLabs(input) : [];
  if (want("labs") && !labs.length) {
    omitted.push({ key: "labs", reason: "No measurements recorded in this range." });
  }

  const sun = want("sun") ? buildSun(input) : null;
  if (want("sun") && !sun) {
    omitted.push({ key: "sun", reason: "No time outside recorded in this range." });
  }

  const routine = want("routine") ? buildRoutine(input) : null;
  if (want("routine") && !routine) omitted.push({ key: "routine", reason: "Nothing in your routine to report on yet." });

  const photo = want("photos") ? (input.photo || null) : null;
  if (want("photos") && !photo) omitted.push({ key: "photos", reason: "Two photos of the same spot are needed for a before and after." });

  const picked = new Set(input.noteDates || []);
  const notes = want("notes")
    ? candidateNotes(input.entries, input.range).filter((n) => picked.has(n.date)).slice(0, MAX_NOTES)
    : [];
  if (want("notes") && !notes.length) omitted.push({ key: "notes", reason: "No notes picked out for this pack." });

  const questions = want("questions")
    ? (input.questions || []).map((q) => q.trim()).filter(Boolean).slice(0, MAX_QUESTIONS)
    : [];

  return {
    range: input.range,
    previous: previousWindow(input.range),
    sections,
    headline, scores, flares, changes, labs, sun, routine, photo, notes, questions,
    omitted,
  };
}

/* ---------- saying it ---------- */

/** "+1.4" / "−0.6" / "no change". Uses a real minus sign: this gets printed. */
export function changeLabel(change: number | null, unit?: string): string {
  if (change == null) return "not enough to compare";
  const v = round1(change);
  if (Math.abs(v) < 0.05) return "no change";
  const sign = v > 0 ? "+" : "−";
  return `${sign}${Math.abs(v)}${unit ? ` ${unit}` : ""}`;
}

export const VERDICT_WORD: Record<ChangeVerdict, string> = {
  better: "better than last time",
  worse: "worse than last time",
  same: "about the same as last time",
  unknown: "",
};

/** "22 of 30 days (73%)" — every average in the pack carries one of these. */
export function coverageLabel(loggedDays: number, rangeDays: number): string {
  const pct = rangeDays ? Math.round((loggedDays / rangeDays) * 100) : 0;
  return `${loggedDays} of ${rangeDays} days (${pct}%)`;
}

/**
 * Roughly how much paper this is.
 *
 * The promise made to the reader is one or two pages, so the app has to be able
 * to keep it. Blocks are counted, not pixels — a rough count that is honest
 * about being rough beats a precise number that is wrong on the first printer
 * it meets.
 */
export function estimateBlocks(pack: AppointmentPack): number {
  let n = 1; // the masthead
  if (pack.headline) n += 1;
  if (pack.scores) n += 1;
  if (pack.flares) n += 1 + Math.min(pack.flares.items.length, 4) * 0.4;
  if (pack.changes.length) n += 1;
  if (pack.routine) n += 1 + pack.routine.items.length * 0.3;
  if (pack.photo) n += 2;
  n += pack.notes.length * 0.5;
  if (pack.questions.length) n += 0.6 + pack.questions.length * 0.35;
  return Math.round(n * 10) / 10;
}

export function pageEstimate(pack: AppointmentPack): 1 | 2 {
  return estimateBlocks(pack) > 7.5 ? 2 : 1;
}

export const pageLabel = (pack: AppointmentPack): string =>
  pageEstimate(pack) === 1 ? "About one page" : "About two pages";
