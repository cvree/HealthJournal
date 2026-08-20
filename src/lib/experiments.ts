/* Personal experiments — a real question, and the smallest thing that could
   answer it.

   People arrive at a health journal with a question, not a dataset. *Does
   morning sunlight relate to better sleep? Does coffee after two make the night
   worse? Did anything change after I started that cream?* Every one of those is
   answerable from data this app already has, and every one of them is
   ordinarily answered by scrolling back through six weeks of entries and
   guessing.

   An experiment here is four things: a factor, an outcome, a lag, and a way of
   splitting the days in two. That is all. The design decisions worth stating:

   **The split is the person's own median, not a threshold from a guideline.**
   "Days with 15+ minutes outside" is chosen because *this person* has a run of
   days above and below that line, so both halves exist. A fixed threshold
   produces experiments with three days on one side, which is the commonest way
   an n-of-1 tool produces a confident nonsense.

   **Nothing is reported until the ladder in ./evidence says so.** A card in
   Collecting is not a result with a caveat, it is a progress bar and a count.
   The result text does not exist yet. That is why watching one fill up is the
   good part: the app is visibly refusing to guess.

   **Every sentence is a comparison of the person's own averages.** "On
   mornings with 15+ minutes outside, your later sleep rating has averaged 0.9
   points higher" is a fact about their journal, checkable by hand. It never
   becomes "morning light improves your sleep", and `EXPERIMENT_COPY` holds
   every phrase this module can emit so the causal-language audit can read them
   all in one place.

   **A before/after experiment is a different shape and is treated as one.**
   "Did anything change after I started this cream" has no high and low days,
   it has a date. It gets its own comparison and its own, sharper limitation:
   time passed, seasons turned, and everything else in a life moved too. */

import type { Evidence, EvidenceReport } from "./evidence";
import { buildReport, gradeEvidence, lagLabel, spread } from "./evidence";
import type { SeriesSources, Variable } from "./series";
import { dateRange, journalDates, shiftDate, variables } from "./series";

/* ---------- the record ---------- */

export type ExperimentKind = "split" | "beforeAfter";

export interface Experiment {
  id: string;
  /** The person's question, in their words where they typed one. */
  title: string;
  kind: ExperimentKind;
  /** Variable keys, as understood by ./series. */
  factor: string;
  outcome: string;
  /** How many days *earlier* the factor is read. 0 = same day, 1 = the factor
      is yesterday's. */
  lag: number;
  /** For a before/after experiment: the day the thing changed. */
  changedOn?: string;
  /** A threshold the person set by hand, in the factor's own unit. Absent
      means the split is their own median, recomputed as data arrives. */
  threshold?: number;
  /** Where it came from. A suggested experiment the person accepted is
      "suggested" forever — it is interesting to know later which questions the
      app asked and which they did. */
  source: "user" | "suggested";
  /** Archived experiments stay in the journal; they leave the main list. */
  archived?: boolean;
  /** Pinned to Today while it is running. */
  pinned?: boolean;
  createdAt: string;
  updatedAt: string;
}

const stamp = () => new Date().toISOString();
const rand = () => Math.random().toString(36).slice(2, 9);
export const newExperimentId = (): string => `exp_${Date.now().toString(36)}${rand()}`;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface NewExperimentInput {
  title?: string;
  kind?: ExperimentKind;
  factor: string;
  outcome: string;
  lag?: number;
  changedOn?: string;
  threshold?: number;
  source?: "user" | "suggested";
}

export function newExperiment(input: NewExperimentInput): Experiment {
  const at = stamp();
  return {
    id: newExperimentId(),
    title: (input.title || "").trim().slice(0, 100) || "Untitled experiment",
    kind: input.kind === "beforeAfter" ? "beforeAfter" : "split",
    factor: input.factor,
    outcome: input.outcome,
    lag: clampLag(input.lag),
    changedOn: input.changedOn && DATE_RE.test(input.changedOn) ? input.changedOn : undefined,
    threshold: Number.isFinite(Number(input.threshold)) ? Number(input.threshold) : undefined,
    source: input.source === "suggested" ? "suggested" : "user",
    createdAt: at,
    updatedAt: at,
  };
}

/* Lag is capped at three days on purpose. Every extra lag offered is another
   hypothesis that can look real by chance, and "it showed up four days later"
   is not a claim daily self-ratings can support. */
const clampLag = (n: unknown): number => Math.max(0, Math.min(3, Math.round(Number(n) || 0)));

export function sanitizeExperiments(rows: unknown): Experiment[] {
  if (!Array.isArray(rows)) return [];
  const out: Experiment[] = [];
  const seen = new Set<string>();
  for (const r of rows as any[]) {
    if (!r || typeof r !== "object") continue;
    if (typeof r.factor !== "string" || typeof r.outcome !== "string") continue;
    if (!r.factor || !r.outcome) continue;
    const id = typeof r.id === "string" && r.id ? r.id : newExperimentId();
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      title: (typeof r.title === "string" ? r.title : "").slice(0, 100) || "Untitled experiment",
      kind: r.kind === "beforeAfter" ? "beforeAfter" : "split",
      factor: r.factor.slice(0, 60),
      outcome: r.outcome.slice(0, 60),
      lag: clampLag(r.lag),
      changedOn: typeof r.changedOn === "string" && DATE_RE.test(r.changedOn) ? r.changedOn : undefined,
      threshold: Number.isFinite(Number(r.threshold)) ? Number(r.threshold) : undefined,
      source: r.source === "suggested" ? "suggested" : "user",
      archived: r.archived === true,
      pinned: r.pinned === true,
      createdAt: typeof r.createdAt === "string" ? r.createdAt : stamp(),
      updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : stamp(),
    });
  }
  return out;
}

/* ---------- running one ---------- */

export interface PairedDay {
  /** The outcome's day. */
  date: string;
  /** The factor's day, which differs when there is a lag. */
  factorDate: string;
  x: number;
  y: number;
  /** Which side of the split this day landed on. */
  side: "high" | "low";
}

export interface ExperimentResult {
  experiment: Experiment;
  factorVar?: Variable;
  outcomeVar?: Variable;
  evidence: Evidence;
  pairs: PairedDay[];
  /** The value the days were split at, in the factor's own unit. */
  threshold: number | null;
  /** Whether the threshold was the person's median or their own number. */
  thresholdSource: "median" | "manual" | "date";
  high: { n: number; mean: number; dates: string[] };
  low: { n: number; mean: number; dates: string[] };
  /** high.mean − low.mean, rounded to one decimal. */
  difference: number;
  /** The sentence, once the evidence supports one. Empty while collecting. */
  headline: string;
  /** The line under it — always present, even while collecting. */
  subline: string;
  /** Every date this result is about, for lighting them up elsewhere. */
  dates: string[];
  report: EvidenceReport;
  /** True when the difference is too small to be worth a sentence, even with
      plenty of days behind it. A null result is a result and gets said. */
  flat: boolean;
}

export const EXPERIMENT_COPY = {
  collecting: "Collecting days where both are recorded.",
  emerging: "Something may be forming.",
  flat: "No difference worth reporting so far.",
  /* The only template that makes a claim, and the claim is arithmetic about
     the person's own numbers. "has averaged" is doing load-bearing work here:
     it is past tense, it is about a set of days, and it does not reach for a
     mechanism. */
  result: (outcome: string, diff: string, dir: string, factor: string) =>
    `On days with ${factor}, your ${outcome} has averaged ${diff} ${dir}.`,
  beforeAfter: (outcome: string, diff: string, dir: string, when: string) =>
    `Since ${when}, your ${outcome} has averaged ${diff} ${dir} than the matched period before it.`,
  caveat: "Averages of your own days, side by side. Not an effect, and not a cause.",
};

const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Build the paired days for an experiment. Exported because the card draws a
    dot per pair and needs them whether or not there is a result yet. */
export function pairDays(exp: Experiment, factor: Variable, outcome: Variable, dates: string[]): Omit<PairedDay, "side">[] {
  const out: Omit<PairedDay, "side">[] = [];
  for (const date of dates) {
    const y = outcome.value(date);
    if (y == null) continue;
    const factorDate = exp.lag ? shiftDate(date, -exp.lag) : date;
    const x = factor.value(factorDate);
    if (x == null) continue;
    out.push({ date, factorDate, x, y });
  }
  return out;
}

/** Where to cut the days in two.

    Not the median — the cut that actually *divides*, which is a different
    thing and the difference is load-bearing.

    A factor people really track is rarely a smooth spread. It is nine glasses
    of water on the days you remember and two on the days you don't, and often
    not in equal numbers: eighty days at nine and forty at two. The median of
    that is nine, and a strict "above the line" test then puts all hundred and
    twenty days *below* it and compares a hundred and twenty against nothing.
    The experiment looks like it is working and is comparing one group to the
    empty set.

    So the split is chosen from the values that are actually present, and the
    one picked is whichever leaves the two halves closest in size. On evenly
    spread data that lands on the median anyway; on the water case it lands on
    two, which is exactly what somebody means by "the days I had a lot".

    Returns null when there is nothing to cut, and null when every day carries
    the same value — that factor cannot be split at all, and saying so is more
    honest than picking a line with nothing on one side of it. */
export function splitPoint(values: number[]): number | null {
  if (!values.length) return null;
  const xs = [...values].sort((a, b) => a - b);
  const n = xs.length;
  let best: number | null = null;
  let bestGap = Infinity;
  for (let i = 0; i < n - 1; i += 1) {
    /* Only at a real boundary — cutting inside a run of equal values would
       claim a split that does not exist. */
    if (xs[i] === xs[i + 1]) continue;
    const low = i + 1;
    const gap = Math.abs(n - 2 * low);
    if (gap < bestGap) {
      bestGap = gap;
      best = xs[i];
    }
  }
  return best;
}

export function runExperiment(exp: Experiment, src: SeriesSources, allVars?: Variable[]): ExperimentResult {
  const vars = allVars || variables(src);
  const factor = vars.find((v) => v.k === exp.factor);
  const outcome = vars.find((v) => v.k === exp.outcome);
  const dates = journalDates(src);

  if (!factor || !outcome) {
    /* A variable can disappear — a question switched off, a lab deleted. The
       experiment is not broken, it is waiting, and it says which half it has
       lost rather than rendering as an error. */
    return emptyResult(
      exp,
      factor,
      outcome,
      !factor && !outcome
        ? "Both sides of this experiment are missing from your setup."
        : `The ${factor ? "outcome" : "factor"} for this experiment isn't in your journal any more.`
    );
  }

  if (exp.kind === "beforeAfter") return runBeforeAfter(exp, factor, outcome, src, dates);

  const raw = pairDays(exp, factor, outcome, dates);
  const threshold = exp.threshold !== undefined ? exp.threshold : splitPoint(raw.map((r) => r.x));

  const pairs: PairedDay[] = raw.map((r) => ({
    ...r,
    side: threshold != null && r.x > threshold ? "high" : "low",
  }));
  const highRows = pairs.filter((p) => p.side === "high");
  const lowRows = pairs.filter((p) => p.side === "low");

  /* The pair count that grades the evidence is the count in the *smaller*
     half, doubled — not the total. Fifty days of which two are above the line
     is two days of evidence wearing fifty days' clothing. */
  const balanced = Math.min(highRows.length, lowRows.length) * 2;
  const { weeks, months } = spread(pairs.map((p) => p.date));
  const evidence = gradeEvidence({
    pairs: balanced,
    weeks,
    months,
    missing: missingCount(dates, factor, outcome, exp.lag),
    windowDays: dates.length,
  });

  const highMean = mean(highRows.map((p) => p.y));
  const lowMean = mean(lowRows.map((p) => p.y));
  const difference = round1(highMean - lowMean);
  /* Half a point on a ten-point self-rating is the floor of what a person can
     feel. Below it, the honest headline is that there isn't one. */
  const flat = Math.abs(difference) < 0.5 && evidence.stage !== "collecting";

  const factorPhrase = describeSide(factor, threshold, "high");
  const dirWord = difference > 0 ? "higher" : "lower";
  /* The ladder decides what may be said, in one place. Collecting says
     nothing — not a hedged version of the result, nothing — because a sentence
     with a caveat on it is still a sentence somebody will remember. */
  const headline =
    evidence.stage === "collecting" || threshold == null
      ? ""
      : flat
      ? EXPERIMENT_COPY.flat
      : evidence.stage === "emerging"
      ? EXPERIMENT_COPY.emerging
      : EXPERIMENT_COPY.result(
          outcome.label.toLowerCase(),
          `${Math.abs(difference)} ${Math.abs(difference) === 1 ? "point" : "points"}`,
          dirWord,
          factorPhrase
        );

  return {
    experiment: exp,
    factorVar: factor,
    outcomeVar: outcome,
    evidence,
    pairs,
    threshold,
    thresholdSource: exp.threshold !== undefined ? "manual" : "median",
    high: { n: highRows.length, mean: round1(highMean), dates: highRows.map((p) => p.date) },
    low: { n: lowRows.length, mean: round1(lowMean), dates: lowRows.map((p) => p.date) },
    difference,
    headline,
    subline:
      evidence.stage === "collecting"
        ? EXPERIMENT_COPY.collecting
        : evidence.stage === "emerging" && !flat
        ? `${describeSide(factor, threshold, "high")} against ${describeSide(factor, threshold, "low")}, so far.`
        : EXPERIMENT_COPY.caveat,
    dates: pairs.map((p) => p.date),
    report: buildReport({
      usable: pairs.length,
      missing: missingCount(dates, factor, outcome, exp.lag),
      windowLabel: dates.length ? `${dates[0]} to ${dates[dates.length - 1]}` : "—",
      lag: exp.lag,
      comparison:
        threshold == null
          ? "Not enough days to split yet"
          : `${highRows.length} days above ${trim(threshold)}${unitOf(factor)} against ${lowRows.length} at or below`,
      weeks,
      months,
      extra:
        exp.threshold !== undefined
          ? ["The split is a number you chose, not your own median."]
          : ["The split is your own median, so both halves exist. It moves as you log more."],
    }),
    flat,
  };
}

function runBeforeAfter(
  exp: Experiment,
  factor: Variable,
  outcome: Variable,
  src: SeriesSources,
  dates: string[]
): ExperimentResult {
  const changed = exp.changedOn || dates[Math.floor(dates.length / 2)] || "";
  const rows = dates
    .map((date) => ({ date, y: outcome.value(date) }))
    .filter((r): r is { date: string; y: number } => r.y != null);
  const before = rows.filter((r) => r.date < changed);
  const after = rows.filter((r) => r.date >= changed);
  /* Symmetric windows. Comparing three months before against nine days after
     is a comparison of sample sizes, not of periods. */
  const span = Math.min(before.length, after.length);
  const beforeRows = before.slice(-span);
  const afterRows = after.slice(0, span);

  const pairs: PairedDay[] = [
    ...beforeRows.map((r) => ({ date: r.date, factorDate: r.date, x: 0, y: r.y, side: "low" as const })),
    ...afterRows.map((r) => ({ date: r.date, factorDate: r.date, x: 1, y: r.y, side: "high" as const })),
  ];
  const { weeks, months } = spread(pairs.map((p) => p.date));
  const evidence = gradeEvidence({ pairs: span * 2, weeks, months, windowDays: dates.length });

  const beforeMean = mean(beforeRows.map((r) => r.y));
  const afterMean = mean(afterRows.map((r) => r.y));
  const difference = round1(afterMean - beforeMean);
  const flat = Math.abs(difference) < 0.5 && evidence.stage !== "collecting";
  const dirWord = difference > 0 ? "higher" : "lower";

  return {
    experiment: exp,
    factorVar: factor,
    outcomeVar: outcome,
    evidence,
    pairs,
    threshold: null,
    thresholdSource: "date",
    high: { n: afterRows.length, mean: round1(afterMean), dates: afterRows.map((r) => r.date) },
    low: { n: beforeRows.length, mean: round1(beforeMean), dates: beforeRows.map((r) => r.date) },
    difference,
    headline:
      evidence.stage === "collecting"
        ? ""
        : flat
        ? EXPERIMENT_COPY.flat
        : evidence.stage === "emerging"
        ? EXPERIMENT_COPY.emerging
        : EXPERIMENT_COPY.beforeAfter(
            outcome.label.toLowerCase(),
            `${Math.abs(difference)} ${Math.abs(difference) === 1 ? "point" : "points"}`,
            dirWord,
            changed
          ),
    subline:
      evidence.stage === "collecting"
        ? EXPERIMENT_COPY.collecting
        : `${beforeRows.length} days before against ${afterRows.length} after, matched in length.`,
    dates: pairs.map((p) => p.date),
    report: buildReport({
      usable: pairs.length,
      missing: dates.length - rows.length,
      windowLabel: pairs.length ? `${pairs[0].date} to ${pairs[pairs.length - 1].date}` : "—",
      lag: 0,
      comparison: `${beforeRows.length} days before ${changed} against the ${afterRows.length} after it`,
      weeks,
      months,
      extra: [
        "A before-and-after comparison carries everything else that changed with time — the season, the weather, whatever else you started or stopped.",
      ],
    }),
    flat,
  };
}

function emptyResult(exp: Experiment, factor: Variable | undefined, outcome: Variable | undefined, why: string): ExperimentResult {
  return {
    experiment: exp,
    factorVar: factor,
    outcomeVar: outcome,
    evidence: gradeEvidence({ pairs: 0, weeks: 0, months: 0 }),
    pairs: [],
    threshold: null,
    thresholdSource: "median",
    high: { n: 0, mean: 0, dates: [] },
    low: { n: 0, mean: 0, dates: [] },
    difference: 0,
    headline: "",
    subline: why,
    dates: [],
    report: buildReport({
      usable: 0,
      missing: 0,
      windowLabel: "—",
      lag: exp.lag,
      comparison: why,
      weeks: 0,
      months: 0,
    }),
    flat: false,
  };
}

function missingCount(dates: string[], factor: Variable, outcome: Variable, lag: number): number {
  let n = 0;
  for (const date of dates) {
    const y = outcome.value(date);
    const x = factor.value(lag ? shiftDate(date, -lag) : date);
    if ((y == null) !== (x == null)) n += 1;
  }
  return n;
}

const trim = (n: number): string => (Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10));
const unitOf = (v: Variable): string => (v.unit ? ` ${v.unit}` : "");

/** "time outside above 15 min", "dairy", "no dairy". The phrase the headline
    puts after "On days with".

    The wording tracks the arithmetic exactly. The high half is `x > threshold`,
    strictly — so it is "above 15 min", never "15 min+", which would include
    the threshold itself and put it on the wrong side of the sentence from the
    side it is actually counted on. A number nobody can check is bad; a number
    somebody checks and finds off by one is worse. */
export function describeSide(v: Variable, threshold: number | null, side: "high" | "low"): string {
  const name = v.label.toLowerCase();
  if (threshold == null) return side === "high" ? `more ${name}` : `less ${name}`;
  /* A yes/no factor splits at 0 and reads as a thing that happened, not as a
     number above a line. */
  if (threshold === 0 && v.dir !== "neutral") {
    return side === "high" ? name : `no ${name}`;
  }
  const t = `${trim(threshold)}${unitOf(v)}`;
  return side === "high" ? `${name} above ${t}` : `${name} at or below ${t}`;
}

/* ---------- suggesting them ----------

   The other half of the feature, and the half that makes it feel alive: the
   app noticing that a question has become answerable. "You have enough history
   to explore heat × dizziness."

   A suggestion is offered only when the pairing already clears the Emerging
   bar — an offer to start collecting from zero is not a discovery, it is a
   chore. And the suggestions are ranked by how *interesting* they are, which
   here means: the person's own key metric first, then the factors they cannot
   see for themselves (weather, air, daylight, sunlight) ahead of the ones they
   can (what they ate, what they took), because the invisible ones are the
   whole reason to keep a journal in the first place. */

export interface Suggestion {
  factor: string;
  outcome: string;
  lag: number;
  title: string;
  /** Why this is being offered, in one line. */
  reason: string;
  /** Paired days already available. */
  pairs: number;
  /** For ordering. Not shown. */
  score: number;
}

const KIND_WEIGHT: Record<Variable["kind"], number> = {
  environment: 3,
  sun: 3,
  food: 2,
  routine: 2,
  bowel: 1,
  lab: 1,
  answer: 1.5,
};

export function suggestExperiments(
  src: SeriesSources,
  opts: { keyMetric?: string; existing?: Experiment[]; limit?: number } = {}
): Suggestion[] {
  const vars = variables(src);
  const dates = journalDates(src);
  if (dates.length < 14) return [];
  const outcomes = vars.filter((v) => v.kind === "answer" && v.dir !== "neutral");
  if (!outcomes.length) return [];

  const taken = new Set(
    (opts.existing || []).map((e) => `${e.factor}|${e.outcome}|${e.lag}`)
  );
  const out: Suggestion[] = [];

  for (const outcome of outcomes) {
    const isKey = outcome.k === opts.keyMetric;
    for (const factor of vars) {
      if (factor.k === outcome.k) continue;
      if (factor.kind === "answer" && factor.dir === "sym") continue; // symptom vs symptom is not a question
      for (const lag of factor.kind === "food" || factor.kind === "routine" ? [0, 1] : [0]) {
        if (taken.has(`${factor.k}|${outcome.k}|${lag}`)) continue;
        const probe = newExperiment({ factor: factor.k, outcome: outcome.k, lag, source: "suggested" });
        const raw = pairDays(probe, factor, outcome, dates);
        if (raw.length < 14) continue;
        const median = splitPoint(raw.map((r) => r.x));
        if (median == null) continue;
        const high = raw.filter((r) => r.x > median).length;
        const low = raw.length - high;
        /* Both halves have to exist. A factor that is the same number every
           day cannot be split, and offering it produces a card that can never
           say anything. */
        if (Math.min(high, low) < 6) continue;
        const { weeks, months } = spread(raw.map((r) => r.date));
        const score =
          KIND_WEIGHT[factor.kind] * (isKey ? 2 : 1) + Math.min(3, raw.length / 20) + Math.min(2, months);
        out.push({
          factor: factor.k,
          outcome: outcome.k,
          lag,
          title: `${factor.label} × ${outcome.label}`,
          reason: `You already have ${raw.length} days with both recorded, across ${weeks} ${weeks === 1 ? "week" : "weeks"}.`,
          pairs: raw.length,
          score,
        });
      }
    }
  }

  return out
    .sort((a, b) => b.score - a.score)
    .filter(uniqueByPair())
    .slice(0, opts.limit ?? 5);
}

function uniqueByPair() {
  const seen = new Set<string>();
  return (s: Suggestion) => {
    /* One suggestion per factor, whichever outcome scored best. Three cards
       offering humidity against three different symptoms is one idea printed
       three times. */
    if (seen.has(s.factor)) return false;
    seen.add(s.factor);
    return true;
  };
}

/* ---------- the starter questions ----------

   What the "New experiment" screen offers before somebody has thought of
   anything: real questions in plain words, each of which resolves to a factor
   and an outcome if the journal happens to hold both. Deliberately phrased as
   questions — a list of variables is a form, a list of questions is an
   invitation. */

export interface StarterQuestion {
  id: string;
  question: string;
  factor: string;
  /** Outcome candidates in preference order; the first one present wins. */
  outcomes: string[];
  lag: number;
  kind?: ExperimentKind;
}

export const STARTERS: StarterQuestion[] = [
  {
    id: "morning-light-sleep",
    question: "Does morning sunlight relate to better sleep?",
    factor: "sun_minutes",
    outcomes: ["sleep_quality", "sleep", "sleep_hours", "energy"],
    lag: 0,
  },
  {
    id: "humidity-skin",
    question: "Does humidity line up with my skin?",
    factor: "env_humidity",
    outcomes: ["itch", "skin_severity", "rash", "eczema_severity"],
    lag: 0,
  },
  {
    id: "heat-dizzy",
    question: "Does heat line up with feeling dizzy?",
    factor: "env_temp_max",
    outcomes: ["dizziness", "lightheaded", "fatigue"],
    lag: 0,
  },
  {
    id: "pressure-headache",
    question: "Does a pressure drop line up with my headaches?",
    factor: "env_pressure_change",
    outcomes: ["headache", "migraine", "pain"],
    lag: 0,
  },
  {
    id: "pollen-symptoms",
    question: "Does pollen line up with my symptoms?",
    factor: "env_pollen",
    outcomes: ["congestion", "sneezing", "itch", "hives"],
    lag: 0,
  },
  {
    id: "water-hr",
    question: "Does hydration relate to my standing heart rate?",
    factor: "water",
    outcomes: ["hr_standing", "hr_change", "heart_rate_standing"],
    lag: 0,
  },
  {
    id: "outside-mood",
    question: "Does time outside relate to how the day felt?",
    factor: "sun_minutes",
    outcomes: ["mood", "energy", "wellbeing"],
    lag: 0,
  },
  {
    id: "late-caffeine",
    question: "Does caffeine relate to a worse night?",
    factor: "caffeine",
    outcomes: ["sleep_quality", "sleep", "energy"],
    lag: 0,
  },
  {
    id: "air-breathing",
    question: "Does air quality line up with my breathing?",
    factor: "env_aqi",
    outcomes: ["breathing", "cough", "wheeze", "chest"],
    lag: 0,
  },
  {
    id: "daylight-mood",
    question: "Does the length of the day line up with how I feel?",
    factor: "env_daylight",
    outcomes: ["mood", "energy", "fatigue"],
    lag: 0,
  },
];

/** Which starters this journal can actually answer, with the outcome resolved.
    A question whose factor or outcome isn't here is not offered — an invitation
    that leads to "no data" is worse than no invitation. */
export function availableStarters(src: SeriesSources): (StarterQuestion & { resolvedOutcome: string })[] {
  const vars = variables(src);
  const keys = new Set(vars.map((v) => v.k));
  const dates = journalDates(src);
  const out: (StarterQuestion & { resolvedOutcome: string })[] = [];
  for (const s of STARTERS) {
    if (!keys.has(s.factor)) continue;
    const outcome = s.outcomes.find((k) => keys.has(k));
    if (!outcome) continue;
    /* At least a handful of days on each side, or the card would open onto an
       empty progress bar. */
    const f = vars.find((v) => v.k === s.factor)!;
    const o = vars.find((v) => v.k === outcome)!;
    const probe = newExperiment({ factor: s.factor, outcome, lag: s.lag, source: "suggested" });
    if (pairDays(probe, f, o, dates).length < 3) continue;
    out.push({ ...s, resolvedOutcome: outcome });
  }
  return out;
}

/** A default title for an experiment somebody built by hand, in the app's
    display capitals: "MORNING LIGHT × SLEEP". */
export function experimentTitle(factor: Variable | undefined, outcome: Variable | undefined): string {
  if (!factor || !outcome) return "Untitled experiment";
  return `${factor.label} × ${outcome.label}`;
}

/** Order for the list: pinned, then by how far up the ladder they are, then
    newest. A card that just reached Useful should be the first thing seen. */
export function sortResults(results: ExperimentResult[]): ExperimentResult[] {
  const rank: Record<string, number> = { established: 0, useful: 1, emerging: 2, collecting: 3 };
  return [...results].sort((a, b) => {
    if (!!a.experiment.pinned !== !!b.experiment.pinned) return a.experiment.pinned ? -1 : 1;
    const r = rank[a.evidence.stage] - rank[b.evidence.stage];
    if (r) return r;
    return a.experiment.createdAt < b.experiment.createdAt ? 1 : -1;
  });
}

/** Everything on the experiments screen, in one pass. Exported as one call so
    the screen never runs the engine twice for the same render. */
export function runAll(experiments: Experiment[], src: SeriesSources): ExperimentResult[] {
  const vars = variables(src);
  return sortResults(
    experiments.filter((e) => !e.archived).map((e) => runExperiment(e, src, vars))
  );
}

/** Dates worth illuminating when somebody taps a result — the side that the
    headline is about. */
export function highlightDates(result: ExperimentResult): string[] {
  if (result.flat || result.evidence.stage === "collecting") return result.dates;
  return result.difference >= 0 ? result.high.dates : result.low.dates;
}

export { dateRange };
