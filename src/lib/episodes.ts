/* Flares.

   A chronic condition is not a smooth line with a slope. It is long stretches
   of "fine, mostly" broken by weeks that reorganise your life, and the second
   kind is what a person remembers, what they book an appointment about, and
   what every question they bring to it is really asking: how often, how long,
   how bad, and is it happening more than last year.

   None of that is answerable from a daily average, so an episode is a first-
   class thing the user marks. Deliberately *not* detected automatically. A run
   of 7s is not always a flare and a flare does not always show up as a run of
   7s, and an app that invents medical events in someone's history and then
   reports statistics about them has done something worse than nothing. The
   user says when it happened. The app does the arithmetic.

   ---------- marking one is a count, not a stopwatch ----------

   It used to be a stopwatch. You pressed Start when a bad stretch began and
   you were expected to press Stop when it was over, and the app carried an
   "in progress" state between the two.

   That is the wrong shape for the moment it is used in. Marking a flare
   happens on the bad day, one-handed, usually in a hurry — and everything the
   stopwatch asked for after that first tap had to happen on some *later* day,
   when the person is fine and has stopped thinking about it. So the ends never
   got pressed. What the app actually accumulated was a list of flares that
   apparently never finished, a permanent red banner on the dashboard, and a
   "day 46" that meant nothing except that nobody had been back.

   So a flare is logged the way it is experienced: it happened, and it happened
   *now*. One tap records one flare on the day it fell, with the time it was
   marked, and it is complete the moment it is written. Twice in a day is two
   flares, which is the honest answer and also the one the old model could not
   represent at all. Everything past that first tap — a name, a note, whether
   it in fact ran on into the following week — is a detail somebody may add
   afterwards and is never chased for.

   `end` therefore now defaults to the day it started rather than to null, and
   `at` carries the moment. A flare with no end is still meaningful and still
   supported — it is one somebody has explicitly said is still running, and it
   is what every journal marked before this change looks like — so nothing here
   forgets how to read one.

   Everything below is pure. `episodeStats` takes the entries it should look at
   and the day it should call today; nothing here reads a clock. */

export type EpisodeDirection = "sym" | "pos" | "neutral" | undefined;

/** One flare, illness, or bad stretch, as the person marked it. */
export interface HealthEpisode {
  id: string;
  /** The person's own words. Defaulted, never demanded. */
  title: string;
  /** Which metric this episode is about — usually, but not always, the key
      metric. Stats are computed against this one. */
  metric: string;
  /** YYYY-MM-DD, local. */
  start: string;
  /** The moment it was marked, ISO. Present on anything logged as an event —
      "3:40pm, on the bad Tuesday" — and absent on the older stopwatch-style
      episodes, which only ever knew about days. */
  at?: string;
  /** Absent or null when it is still going on. A flare logged as an event
      ends on the day it started, so this is normally set. */
  end?: string | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown, max: number): string =>
  typeof v === "string" ? v.slice(0, max) : "";
const stamp = () => new Date().toISOString();
const rand = () => Math.random().toString(36).slice(2, 9);

export const newEpisodeId = (): string => `ep_${Date.now().toString(36)}${rand()}`;

export interface NewEpisodeInput {
  metric: string;
  start: string;
  title?: string;
  end?: string | null;
  notes?: string;
  /** The moment it happened, ISO. Defaults to now for anything logged live. */
  at?: string;
}

export function newEpisode(input: NewEpisodeInput): HealthEpisode {
  const now = stamp();
  return {
    id: newEpisodeId(),
    title: (input.title || "").trim() || "Flare",
    metric: input.metric,
    start: input.start,
    at: input.at,
    end: input.end || null,
    notes: input.notes || undefined,
    createdAt: now,
    updatedAt: now,
  };
}

/** Mark one, now.

    The whole of the counter model: a flare that happened today, complete on
    the tap, with the moment it was marked kept alongside the day. It never
    refuses and never inspects what else is in the list — two in an afternoon
    is two flares, and an app that quietly merged them would be deciding
    something it has no way to know. */
export function logFlare(list: HealthEpisode[], input: NewEpisodeInput): {
  list: HealthEpisode[]; episode: HealthEpisode;
} {
  const episode = newEpisode({
    ...input,
    at: input.at ?? stamp(),
    end: input.end === undefined ? input.start : input.end,
  });
  return { list: [...list, episode], episode };
}

/** Episodes arrive from local storage, a restored backup file and a sync pull,
    so they are sanitised on every load rather than trusted on any of them. An
    episode whose dates are the wrong way round would produce negative
    durations everywhere downstream, so it is repaired here, once. */
export function sanitizeEpisodes(rows: unknown): HealthEpisode[] {
  if (!Array.isArray(rows)) return [];
  const out: HealthEpisode[] = [];
  const seen = new Set<string>();
  for (const r of rows as any[]) {
    if (!r || typeof r !== "object") continue;
    if (!DATE_RE.test(r.start)) continue;
    const metric = str(r.metric, 80).trim();
    if (!metric) continue;
    const id = str(r.id, 64) || newEpisodeId();
    if (seen.has(id)) continue;
    seen.add(id);
    let end: string | null = DATE_RE.test(r.end) ? r.end : null;
    if (end && end < r.start) end = r.start;
    out.push({
      id,
      title: str(r.title, 120).trim() || "Flare",
      metric,
      start: r.start,
      at: str(r.at, 40) || undefined,
      end,
      notes: str(r.notes, 4000) || undefined,
      createdAt: str(r.createdAt, 40) || stamp(),
      updatedAt: str(r.updatedAt, 40) || stamp(),
    });
  }
  return out;
}

/* ---------- dates ---------- */

const pad2 = (n: number) => String(n).padStart(2, "0");

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

/** Whole days from `a` to `b`, inclusive of both ends. Same day = 1, because a
    flare that started and ended today lasted a day, not none. */
export function daySpan(a: string, b: string): number {
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  const ms = Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1);
  return Math.round(ms / 86400000) + 1;
}

export const datesBetween = (a: string, b: string): string[] => {
  const out: string[] = [];
  for (let d = a; d <= b; d = addDays(d, 1)) out.push(d);
  return out;
};

/* ---------- the list ---------- */

export const isOpen = (ep: HealthEpisode): boolean => !ep.end;

/** Newest first — the order every list in the app shows them in. */
export const sortEpisodes = (list: HealthEpisode[]): HealthEpisode[] =>
  [...list].sort((a, b) => (a.start < b.start ? 1 : a.start > b.start ? -1 : 0));

/** The flare currently running, if there is one. At most one per metric can be
    open at a time — two overlapping "current" flares of the same thing is a
    state with no meaning, and every count downstream would double it. */
export const openEpisode = (
  list: HealthEpisode[], metric?: string
): HealthEpisode | null =>
  sortEpisodes(list).find((e) => isOpen(e) && (!metric || e.metric === metric)) || null;

/** The episode covering a date, for shading the chart and for "was this day
    part of something". */
export const episodeOn = (
  list: HealthEpisode[], date: string, today?: string, metric?: string
): HealthEpisode | null =>
  sortEpisodes(list).find((e) =>
    (!metric || e.metric === metric)
    && date >= e.start
    && date <= (e.end || today || "9999-12-31")) || null;

/** The last day this episode covers: its end, or today while it is open. */
export const lastDay = (ep: HealthEpisode, today: string): string =>
  ep.end || (today > ep.start ? today : ep.start);

/* ---------- counting them ----------

   The counter model asks two questions the stopwatch model never had to: how
   many fell on a given day, and how many fell in a stretch of days. Both count
   the flare on the day it *started*, which is the day the person marked it and
   the day they mean when they say "I had two on Tuesday". */

/** Flares marked on one date. */
export const flaresOn = (
  list: HealthEpisode[], date: string, metric?: string
): HealthEpisode[] =>
  sortEpisodes(list).filter((e) => e.start === date && (!metric || e.metric === metric));

/** How many were marked between two dates, inclusive. */
export const flareCount = (
  list: HealthEpisode[], from: string, to: string, metric?: string
): number =>
  list.filter((e) => (!metric || e.metric === metric) && e.start >= from && e.start <= to).length;

/** Every day any of these episodes touches, as dates. Distinct: two flares on
    one afternoon are two flares and one bad day, and counting the day twice is
    how "flare days" ends up larger than the year. */
export function flareDates(
  list: HealthEpisode[], today: string, metric?: string
): Set<string> {
  const out = new Set<string>();
  for (const e of list) {
    if (metric && e.metric !== metric) continue;
    for (const d of datesBetween(e.start, lastDay(e, today))) out.add(d);
  }
  return out;
}

export interface StartFlareResult {
  list: HealthEpisode[];
  episode: HealthEpisode | null;
  /** Why nothing happened, when nothing happened. */
  refused?: "already-open";
}

/** Start one. Refuses rather than silently creating a second open flare for the
    same metric — the caller shows the running one instead. */
export function startFlare(
  list: HealthEpisode[], input: NewEpisodeInput
): StartFlareResult {
  const running = openEpisode(list, input.metric);
  if (running) return { list, episode: running, refused: "already-open" };
  const episode = newEpisode(input);
  return { list: [...list, episode], episode };
}

/** End one, on `date`. An end before the start is clamped to the start rather
    than rejected: the user picked a day, and refusing it teaches nothing. */
export function endFlare(
  list: HealthEpisode[], id: string, date: string
): HealthEpisode[] {
  return list.map((e) => e.id === id
    ? { ...e, end: date < e.start ? e.start : date, updatedAt: stamp() }
    : e);
}

export function updateEpisode(
  list: HealthEpisode[], id: string, patch: Partial<HealthEpisode>
): HealthEpisode[] {
  return list.map((e) => e.id === id
    ? { ...e, ...patch, id: e.id, updatedAt: stamp() }
    : e);
}

export const removeEpisode = (list: HealthEpisode[], id: string): HealthEpisode[] =>
  list.filter((e) => e.id !== id);

/* ---------- statistics ---------- */

export interface EpisodeEntry {
  date: string;
  answers?: Record<string, unknown>;
}

export interface EpisodeStats {
  id: string;
  title: string;
  metric: string;
  start: string;
  end: string | null;
  /** Still running. */
  open: boolean;
  /** Calendar days it covers, inclusive; through today while open. */
  days: number;
  /** Of those, how many carry a score for its metric. */
  loggedDays: number;
  coverage: number;
  average: number | null;
  median: number | null;
  /** The worst score reached, in the metric's direction, and when. */
  peak: number | null;
  peakDate: string | null;
  /** Days at or past the hard end of the scale. */
  hardDays: number;
  /** Average of the days immediately before it started. */
  baseline: number | null;
  baselineDays: number;
  /** How much worse the episode ran than the run-up to it, in the direction
      that means worse. Null when there is no baseline to compare against. */
  vsBaseline: number | null;
  /** Average of the days immediately after it ended. Null while it is open —
      there is no "after" yet, and printing one would be a lie. */
  after: number | null;
  afterDays: number;
  /** Days between the previous episode ending and this one starting. Null when
      this is the first, or when the previous one never ended. */
  sincePrevious: number | null;
}

export interface StatsOptions {
  entries: EpisodeEntry[];
  /** Today, YYYY-MM-DD — how far an open episode runs. */
  today: string;
  dir?: EpisodeDirection;
  /** How many days either side to average for baseline and after. */
  window?: number;
  /** The whole list, so `sincePrevious` can find the one before. */
  all?: HealthEpisode[];
}

const HARD_AT = 7;
const bad = (v: number, dir: EpisodeDirection) => (dir === "pos" ? 11 - v : v);

const avg = (xs: number[]): number | null =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

const mid = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const i = s.length >> 1;
  return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2;
};

export function episodeStats(ep: HealthEpisode, opts: StatsOptions): EpisodeStats {
  const { entries, today, dir } = opts;
  const window = opts.window ?? 14;
  const end = lastDay(ep, today);

  const byDate = new Map<string, number>();
  for (const e of entries) {
    const v = e?.answers?.[ep.metric];
    if (typeof v === "number" && Number.isFinite(v)) byDate.set(e.date, v);
  }
  const between = (a: string, b: string) => {
    const out: { date: string; v: number }[] = [];
    if (a > b) return out;
    for (const d of datesBetween(a, b)) {
      const v = byDate.get(d);
      if (v != null) out.push({ date: d, v });
    }
    return out;
  };

  const inside = between(ep.start, end);
  const values = inside.map((p) => p.v);
  const days = daySpan(ep.start, end);

  let peak: number | null = null, peakDate: string | null = null;
  for (const p of inside) {
    if (peak == null || bad(p.v, dir) > bad(peak, dir)) { peak = p.v; peakDate = p.date; }
  }

  const before = between(addDays(ep.start, -window), addDays(ep.start, -1));
  const baseline = avg(before.map((p) => p.v));
  const average = avg(values);

  /* "After" is only meaningful once the episode is over *and* time has passed.
     While it is open, or on the day it ended, there is nothing to average. */
  const afterRows = ep.end ? between(addDays(ep.end, 1), addDays(ep.end, window)) : [];
  const after = avg(afterRows.map((p) => p.v));

  const earlier = (opts.all || [])
    .filter((e) => e.id !== ep.id && e.start < ep.start)
    .sort((a, b) => (a.start < b.start ? 1 : -1))[0];
  const sincePrevious = earlier?.end && earlier.end < ep.start
    ? daySpan(earlier.end, ep.start) - 1
    : null;

  return {
    id: ep.id, title: ep.title, metric: ep.metric,
    start: ep.start, end: ep.end || null, open: isOpen(ep),
    days,
    loggedDays: values.length,
    coverage: days ? values.length / days : 0,
    average,
    median: mid(values),
    peak, peakDate,
    hardDays: values.filter((v) => bad(v, dir) >= HARD_AT).length,
    baseline, baselineDays: before.length,
    vsBaseline: average != null && baseline != null
      ? bad(average, dir) - bad(baseline, dir)
      : null,
    after, afterDays: afterRows.length,
    sincePrevious,
  };
}

/* ---------- a year of them ---------- */

export interface EpisodeYear {
  year: number;
  count: number;
  /** Days spent inside an episode this year — clipped to the year, so a flare
      running across New Year is counted in both, in the right proportions. */
  flareDays: number;
  avgDuration: number | null;
  longest: EpisodeStats | null;
  avgScore: number | null;
  avgPeak: number | null;
}

/** Days of an episode that fall inside a given year. */
export function daysInYear(ep: HealthEpisode, year: number, today: string): number {
  const from = `${year}-01-01`, to = `${year}-12-31`;
  const a = ep.start > from ? ep.start : from;
  const b0 = lastDay(ep, today);
  const b = b0 < to ? b0 : to;
  return a > b ? 0 : daySpan(a, b);
}

export function episodeYear(
  list: HealthEpisode[], year: number, opts: StatsOptions
): EpisodeYear {
  const started = list.filter((e) => e.start.slice(0, 4) === String(year));
  const stats = started.map((e) => episodeStats(e, { ...opts, all: list }));
  /* Distinct days, not the sum of the episodes' lengths. Under the counter
     model a bad afternoon can carry two flares, and adding their days together
     would report two bad days out of one. */
  let flareDays = 0;
  const prefix = `${year}-`;
  for (const d of flareDates(list, opts.today)) if (d.startsWith(prefix)) flareDays++;
  const durations = stats.map((s) => s.days);
  const scores = stats.map((s) => s.average).filter((v): v is number => v != null);
  const peaks = stats.map((s) => s.peak).filter((v): v is number => v != null);
  let longest: EpisodeStats | null = null;
  for (const s of stats) if (!longest || s.days > longest.days) longest = s;
  return {
    year,
    count: started.length,
    flareDays,
    avgDuration: avg(durations),
    longest,
    avgScore: avg(scores),
    avgPeak: avg(peaks),
  };
}

export interface EpisodeYearCompare {
  now: EpisodeYear;
  prev: EpisodeYear;
  /** Positive means more this year. */
  deltaCount: number;
  deltaFlareDays: number;
  /** Whether last year has enough in it to be worth comparing against. */
  comparable: boolean;
}

export function compareEpisodeYears(
  list: HealthEpisode[], year: number, opts: StatsOptions
): EpisodeYearCompare {
  const now = episodeYear(list, year, opts);
  const prev = episodeYear(list, year - 1, opts);
  return {
    now, prev,
    deltaCount: now.count - prev.count,
    deltaFlareDays: now.flareDays - prev.flareDays,
    comparable: prev.count > 0 || prev.flareDays > 0,
  };
}

/* ---------- shading the trend chart ---------- */

export interface EpisodeBand {
  id: string;
  title: string;
  /** Clipped to the requested window, so a band never draws past the axis. */
  from: string;
  to: string;
  open: boolean;
}

/** The episode ranges overlapping a window, ready to draw behind a chart. */
export function episodeBands(
  list: HealthEpisode[], from: string, to: string, today: string, metric?: string
): EpisodeBand[] {
  return sortEpisodes(list)
    .filter((e) => !metric || e.metric === metric)
    .map((e) => {
      const b = lastDay(e, today);
      return {
        id: e.id, title: e.title, open: isOpen(e),
        from: e.start > from ? e.start : from,
        to: b < to ? b : to,
      };
    })
    .filter((b) => b.from <= b.to && b.to >= from && b.from <= to)
    .reverse();
}

/* ---------- words ---------- */

export const durationLabel = (days: number): string =>
  days === 1 ? "1 day" : days < 14 ? `${days} days`
    : days < 60 ? `${Math.round(days / 7)} weeks`
    : `${Math.round(days / 30)} months`;

/** A flare that began and ended on its own day: one marked as it happened,
    rather than one somebody has said is still running. Most of them. */
export const isEvent = (ep: HealthEpisode): boolean =>
  !!ep.end && ep.end === ep.start;

/** "Ongoing · day 12" while it runs, a length once it is over. Says nothing
    about a single-day flare's length, because "1 day" is not information —
    the day it fell on is already printed beside it. */
export function episodeWhen(ep: HealthEpisode, today: string): string {
  if (isOpen(ep)) return `Ongoing · day ${daySpan(ep.start, lastDay(ep, today))}`;
  if (isEvent(ep)) return "Marked on the day";
  return `${durationLabel(daySpan(ep.start, ep.end!))}`;
}
