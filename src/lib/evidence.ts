/* How much this journal actually knows.

   Every finding in this app — an insight, an experiment, a possible
   relationship — carries a strength, and this module is the only place that
   decides what strength means. One ladder, four rungs, used everywhere, so
   that "Useful" on an experiment card and "Useful" on an insight are the same
   claim about the same kind of evidence.

   The rungs are counts of *this person's own days*, not confidence intervals,
   and that is deliberate. A percentage is a promise about a population; this
   app has a sample size of one and no control group, and a number like "78%
   confident" would be an invented statistic dressed as a measurement. What it
   can honestly say is: here is how many paired days there are, here is how
   they are spread across time, and here is what is missing. A person can check
   every one of those.

   The spread matters as much as the count. Thirty paired days from one
   fortnight is one fortnight of your life; thirty spread over four months has
   seen four different versions of you. So the ladder asks for both, and a
   finding built on a single burst of days is capped at "Emerging" no matter
   how many days that burst holds. */

export type EvidenceStage = "collecting" | "emerging" | "useful" | "established";

/** Paired days needed to leave each rung. Chosen from what self-rated daily
    data actually behaves like, not from a table: below a dozen pairs the
    ranking of two groups flips on a single bad night, and past ninety a
    difference that has survived three months of a person's life is worth
    taking seriously even without a statistician in the room. */
export const EMERGING_AT = 12;
export const USEFUL_AT = 30;
export const ESTABLISHED_AT = 90;

/** How many distinct calendar weeks a finding must touch before it can be
    called Useful, and months before Well established. */
export const USEFUL_WEEKS = 3;
export const ESTABLISHED_PERIODS = 3;

export interface EvidenceInput {
  /** Days where both sides of the comparison have a value. */
  pairs: number;
  /** Distinct ISO weeks those days fall in. */
  weeks: number;
  /** Distinct calendar months. */
  months: number;
  /** Days inside the window where one side or the other was missing. Used for
      the honesty panel, not for the grade — a gap is a fact about the journal,
      not a fault in the finding. */
  missing?: number;
  /** Days in the window overall. */
  windowDays?: number;
}

export interface Evidence {
  stage: EvidenceStage;
  /** The word, in the app's own capitals. */
  label: string;
  /** "38 paired days", the line under the word. */
  count: string;
  /** The qualifying sentence — what makes this rung rather than the next. */
  detail: string;
  pairs: number;
  /** 0–1 toward the next rung. `1` on the top rung. */
  progress: number;
  /** How many more paired days until the next rung. `null` at the top. */
  toNext: number | null;
  nextLabel: string | null;
}

export const STAGE_LABEL: Record<EvidenceStage, string> = {
  collecting: "Collecting",
  emerging: "Emerging",
  useful: "Useful",
  established: "Well established in your journal",
};

/** The one function. Everything that grades evidence in this app calls it. */
export function gradeEvidence(input: EvidenceInput): Evidence {
  const pairs = Math.max(0, Math.round(input.pairs));
  const weeks = Math.max(0, Math.round(input.weeks));
  const months = Math.max(0, Math.round(input.months));

  let stage: EvidenceStage = "collecting";
  if (pairs >= ESTABLISHED_AT && months >= ESTABLISHED_PERIODS) stage = "established";
  else if (pairs >= USEFUL_AT && weeks >= USEFUL_WEEKS) stage = "useful";
  else if (pairs >= EMERGING_AT) stage = "emerging";

  const count = `${pairs} paired ${pairs === 1 ? "day" : "days"}`;
  const detail = detailFor(stage, { pairs, weeks, months, missing: input.missing });

  const next =
    stage === "collecting" ? EMERGING_AT
      : stage === "emerging" ? USEFUL_AT
      : stage === "useful" ? ESTABLISHED_AT
      : null;
  const floor =
    stage === "collecting" ? 0
      : stage === "emerging" ? EMERGING_AT
      : stage === "useful" ? USEFUL_AT
      : ESTABLISHED_AT;

  return {
    stage,
    label: STAGE_LABEL[stage],
    count,
    detail,
    pairs,
    progress: next ? Math.min(1, Math.max(0, (pairs - floor) / (next - floor))) : 1,
    toNext: next ? Math.max(0, next - pairs) : null,
    nextLabel:
      stage === "collecting" ? STAGE_LABEL.emerging
        : stage === "emerging" ? STAGE_LABEL.useful
        : stage === "useful" ? STAGE_LABEL.established
        : null,
  };
}

function detailFor(stage: EvidenceStage, i: { pairs: number; weeks: number; months: number; missing?: number }): string {
  if (stage === "collecting") {
    const need = EMERGING_AT - i.pairs;
    return need > 0
      ? `${need} more ${need === 1 ? "day" : "days"} with both recorded before there's anything worth reading.`
      : "Waiting on days where both are recorded.";
  }
  if (stage === "emerging") {
    if (i.pairs >= USEFUL_AT && i.weeks < USEFUL_WEEKS) {
      return `Plenty of days, but they sit inside ${i.weeks} ${i.weeks === 1 ? "week" : "weeks"}. Spread across more of the year, this would say more.`;
    }
    return `Enough to look at, not enough to lean on.${i.missing ? ` ${i.missing} days in the window are missing one side.` : ""}`;
  }
  if (stage === "useful") {
    if (i.pairs >= ESTABLISHED_AT && i.months < ESTABLISHED_PERIODS) {
      return `${i.pairs} days, but from ${i.months} ${i.months === 1 ? "month" : "months"}. Seen across more of the year it would be firmer still.`;
    }
    return `Repeated across ${i.weeks} separate weeks.`;
  }
  return `Seen across ${i.months} separate months of your journal.`;
}

/* ---------- the honesty panel ----------

   "Why am I seeing this?" opens this. It is a list of facts about the
   calculation, not a paragraph of reassurance, and every row is something the
   person could verify by scrolling their own history. Anything the app cannot
   state as a fact belongs in `limitations`, in plain language. */

export interface EvidenceReport {
  /** The line the finding was made from. */
  usable: number;
  missing: number;
  windowLabel: string;
  /** "Same day", "The day before", … */
  lagLabel: string;
  /** How the days were split or compared. */
  comparison: string;
  /** Weeks and months touched. */
  consistency: string;
  limitations: string[];
}

/** The standing limitations. These are on every finding this app makes,
    because they are true of every finding this app can make, and burying them
    per-feature is how a product ends up with a caveat that only appears on the
    screens somebody remembered to write one for. */
export const STANDING_LIMITATIONS = [
  "This is your own journal compared against itself. There is no control group and nothing is randomised.",
  "Days that are alike in one way are usually alike in others — the weather, the week, how much sleep you got.",
  "A pattern here is a reason to be curious, and never a reason to change treatment without talking to someone qualified.",
];

export function buildReport(input: {
  usable: number;
  missing: number;
  windowLabel: string;
  lag: number;
  comparison: string;
  weeks: number;
  months: number;
  extra?: string[];
}): EvidenceReport {
  return {
    usable: input.usable,
    missing: input.missing,
    windowLabel: input.windowLabel,
    lagLabel: lagLabel(input.lag),
    comparison: input.comparison,
    consistency:
      input.months >= 2
        ? `${input.weeks} weeks across ${input.months} months`
        : `${input.weeks} ${input.weeks === 1 ? "week" : "weeks"}`,
    limitations: [...(input.extra || []), ...STANDING_LIMITATIONS],
  };
}

export function lagLabel(lag: number): string {
  if (!lag) return "Same day";
  if (lag === 1) return "The day before";
  return `${lag} days before`;
}

/* ---------- date arithmetic the ladder needs ---------- */

/** ISO week key, "2026-W31". Used to count how spread out a finding is; the
    exact ISO rules matter less than that the same week always gets the same
    key. */
export function weekKey(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((dt.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export const monthKey = (date: string): string => date.slice(0, 7);

/** Count the distinct weeks and months a set of dates touches. */
export function spread(dates: string[]): { weeks: number; months: number } {
  return {
    weeks: new Set(dates.map(weekKey)).size,
    months: new Set(dates.map(monthKey)).size,
  };
}
