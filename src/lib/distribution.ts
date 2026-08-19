/* How a 1–10 metric is *spread*, as opposed to where it is heading.

   An average of 5.2 is the same number for someone who scores 5 every single
   day and for someone who alternates 2 and 8, and those are not the same life.
   The trend chart cannot tell them apart either — it draws both, and the eye
   reads the second as noise around the first. So this counts the days at each
   score and says the three things a person actually wants from that: what a
   typical day is, what the most common day is, and how many days were hard.

   Direction is load-bearing. A 2 is a good day for a rash and a poor one for
   sleep quality, so every judgement here — hard days, calm days, best, worst —
   is made against `dir` rather than against the number. Nothing in this file
   assumes high is bad. */

export type Direction = "sym" | "pos" | "neutral" | undefined;

/** How far into "bad" a score sits, whichever way the metric points. Used for
    every threshold in this file, so there is exactly one place that knows
    which end is which. */
export const badness = (value: number, dir: Direction): number =>
  dir === "pos" ? 11 - value : value;

/* The two thresholds. They are the boundaries of the app's existing severity
   ramp — a "hard day" here is a day the dashboard would have coloured amber or
   red, and a calm day is one it coloured green. Inventing separate numbers for
   this card would mean the same day was hard in one place and fine in another. */
export const HARD_AT = 7;
export const CALM_AT = 3;

export interface ScoreBucket {
  /** 1–10. */
  score: number;
  days: number;
  /** Of the days that carry a score, 0–1. */
  share: number;
}

export type Variability = "steady" | "mixed" | "swinging";

export interface DistributionStats {
  /** Days in range that carry a score for this metric. */
  total: number;
  /** Always ten, score 1 through 10, zeroes included — a gap in the middle of
      a distribution is information, and dropping empty buckets hides it. */
  buckets: ScoreBucket[];
  mean: number | null;
  /** The middle day. More honest than the mean on a metric that spikes. */
  median: number | null;
  /** The score logged on more days than any other. */
  mode: number | null;
  modeDays: number;
  modeShare: number;
  /** Population standard deviation, and the word for it. */
  sd: number | null;
  variability: Variability | null;
  /** Days at or past the hard end of the scale, in this metric's direction. */
  hardDays: number;
  hardShare: number;
  calmDays: number;
  calmShare: number;
  /** The kindest and the worst score actually logged, by direction. */
  best: number | null;
  worst: number | null;
}

export interface DistributionInput {
  /** Anything with a date and answers — DailyEntry, or the chart's merged rows. */
  entries: { date: string; answers?: Record<string, unknown> }[];
  key: string;
  dir?: Direction;
  /** Inclusive YYYY-MM-DD bounds. Omit for the whole journal. */
  start?: string;
  end?: string;
}

/** Every score for a metric inside the range, in date order. */
export function scoresIn(input: DistributionInput): number[] {
  const { entries, key, start, end } = input;
  const out: { date: string; v: number }[] = [];
  for (const e of entries) {
    if (!e || typeof e.date !== "string") continue;
    if (start && e.date < start) continue;
    if (end && e.date > end) continue;
    const v = e.answers?.[key];
    if (typeof v === "number" && Number.isFinite(v)) out.push({ date: e.date, v });
  }
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return out.map((p) => p.v);
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** How wide the swings are, in three words rather than a decimal.

    The cuts are one and two points of standard deviation, which on a ten-point
    scale means: a metric that mostly repeats itself, one that moves a couple of
    points either way, and one that is genuinely all over the place. */
export function variabilityOf(sd: number | null): Variability | null {
  if (sd == null) return null;
  if (sd < 1) return "steady";
  if (sd < 2) return "mixed";
  return "swinging";
}

export function distribution(input: DistributionInput): DistributionStats {
  const values = scoresIn(input).map((v) => Math.min(10, Math.max(1, Math.round(v))));
  const dir = input.dir;
  const counts = new Array(10).fill(0);
  for (const v of values) counts[v - 1] += 1;
  const total = values.length;

  const buckets: ScoreBucket[] = counts.map((days, i) => ({
    score: i + 1, days, share: total ? days / total : 0,
  }));

  if (!total) {
    return {
      total: 0, buckets, mean: null, median: null, mode: null, modeDays: 0, modeShare: 0,
      sd: null, variability: null,
      hardDays: 0, hardShare: 0, calmDays: 0, calmShare: 0, best: null, worst: null,
    };
  }

  const mean = values.reduce((a, b) => a + b, 0) / total;
  const mid = median(values)!;
  const sd = Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / total);

  /* Ties go to the score nearest the middle day. Picking the lowest would
     quietly claim the calmer of two equally common days is the typical one. */
  let mode = 1, modeDays = -1;
  for (const b of buckets) {
    if (b.days > modeDays || (b.days === modeDays && Math.abs(b.score - mid) < Math.abs(mode - mid))) {
      mode = b.score; modeDays = b.days;
    }
  }

  const hardDays = values.filter((v) => badness(v, dir) >= HARD_AT).length;
  const calmDays = values.filter((v) => badness(v, dir) <= CALM_AT).length;
  const byBad = [...values].sort((a, b) => badness(a, dir) - badness(b, dir));

  return {
    total, buckets, mean, median: mid,
    mode, modeDays, modeShare: modeDays / total,
    sd, variability: variabilityOf(sd),
    hardDays, hardShare: hardDays / total,
    calmDays, calmShare: calmDays / total,
    best: byBad[0], worst: byBad[byBad.length - 1],
  };
}

/* ---------- words ---------- */

/** "7 or higher" / "4 or lower" — the threshold said the way the reader would
    say it, so the card never has to explain which end is bad. */
export const hardLabel = (dir: Direction): string =>
  dir === "pos" ? `${11 - HARD_AT} or lower` : `${HARD_AT} or higher`;

export const calmLabel = (dir: Direction): string =>
  dir === "pos" ? `${11 - CALM_AT} or higher` : `${CALM_AT} or lower`;

export const VARIABILITY_COPY: Record<Variability, { label: string; detail: string }> = {
  steady: { label: "Steady", detail: "most days land close together" },
  mixed: { label: "Mixed", detail: "a couple of points either way is normal" },
  swinging: { label: "Swinging", detail: "good days and bad days, not much in between" },
};

/** Rounded to whole percent, because a distribution built on 40 days does not
    have a tenth of a percent to give. */
export const pct = (share: number): string => `${Math.round(share * 100)}%`;
