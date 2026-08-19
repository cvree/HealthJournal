/* "Possible relationships" — one outcome, one factor, and a great deal of care.

   This is the most dangerous screen in the app, and the danger is not that the
   arithmetic is wrong. It is that a person managing a condition, looking at a
   chart the app drew, will read "dairy 0.42" as "dairy is doing this to me" and
   change what they eat on the strength of eleven days. So the honesty lives in
   the code, not in a disclaimer at the bottom:

   · Nothing is shown below MIN_PAIRS paired days. Not greyed out — absent, with
     a line saying how many more days it needs.
   · The number is Spearman's rho, not Pearson's r. These are 1–10 ratings a
     person assigned to their own body; the intervals between them are not
     equal, and rank correlation is the one that doesn't pretend otherwise.
   · Strength words stop at "moderate" unless the sample is large. A 0.7 on
     twelve days is not a strong relationship, it is twelve days.
   · Every phrase this module produces is non-causal, and `RELATIONSHIP_COPY`
     exists so the causal-language audit in validate.ts can check them all in
     one place.

   The lag option is here because a same-day comparison misses most of what
   people actually suspect — food today, skin tomorrow. One day is offered, not
   seven, because the number of hypotheses you can test before one of them looks
   real by chance is the whole problem. */

export type Direction = "sym" | "pos" | "neutral" | undefined;

/** Below this many paired days, nothing is shown. Twelve is not a statistical
    threshold — no threshold would be — it is the point below which a rank
    correlation on daily self-ratings is visibly a coin toss. */
export const MIN_PAIRS = 12;
/** Above this, "strong" is allowed to be said out loud. */
export const SOLID_PAIRS = 30;

export interface Entryish {
  date: string;
  answers?: Record<string, unknown>;
}

export interface Pair {
  /** The outcome day. With a lag, the factor came from `factorDate`. */
  date: string;
  factorDate: string;
  /** The factor. */
  x: number;
  /** The outcome. */
  y: number;
}

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v
    : typeof v === "boolean" ? (v ? 1 : 0)
    : null;

const pad2 = (n: number) => String(n).padStart(2, "0");
const shift = (date: string, n: number): string => {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
};

/** Days where both the factor and the outcome have a number.

    `lag` is how many days *earlier* the factor is read: lag 1 pairs yesterday's
    factor with today's outcome. Booleans count as 0/1 so a yes/no trigger can
    be compared the same way as a rating. */
export function pairUp(
  entries: Entryish[], outcomeKey: string, factorKey: string, lag = 0
): Pair[] {
  const byDate = new Map<string, Entryish>();
  for (const e of entries) if (e && typeof e.date === "string") byDate.set(e.date, e);
  const out: Pair[] = [];
  for (const e of [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1))) {
    const y = num(e.answers?.[outcomeKey]);
    if (y == null) continue;
    const factorDate = lag ? shift(e.date, -lag) : e.date;
    const x = num(byDate.get(factorDate)?.answers?.[factorKey]);
    if (x == null) continue;
    out.push({ date: e.date, factorDate, x, y });
  }
  return out;
}

/** Ranks with ties averaged — the tie handling is not optional here, because
    1–10 ratings are almost entirely ties. */
export function ranks(values: number[]): number[] {
  const order = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const out = new Array(values.length).fill(0);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && order[j + 1].v === order[i].v) j += 1;
    const rank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) out[order[k].i] = rank;
    i = j + 1;
  }
  return out;
}

/** Spearman's rank correlation. Null when either side never varies — a factor
    that was the same every day cannot be related to anything, and the formula
    would divide by zero saying so. */
export function spearman(pairs: { x: number; y: number }[]): number | null {
  if (pairs.length < 3) return null;
  const rx = ranks(pairs.map((p) => p.x));
  const ry = ranks(pairs.map((p) => p.y));
  const n = pairs.length;
  const mx = rx.reduce((a, b) => a + b, 0) / n;
  const my = ry.reduce((a, b) => a + b, 0) / n;
  let num2 = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const a = rx[i] - mx, b = ry[i] - my;
    num2 += a * b; dx += a * a; dy += b * b;
  }
  if (dx === 0 || dy === 0) return null;
  return num2 / Math.sqrt(dx * dy);
}

export type Strength = "none" | "slight" | "moderate" | "strong";

/** How firmly the number may be described, sample size included in the
    judgement. "Strong" is unavailable below SOLID_PAIRS however big rho is. */
export function strengthOf(rho: number | null, n: number): Strength {
  if (rho == null) return "none";
  const r = Math.abs(rho);
  if (r < 0.2) return "none";
  if (r < 0.4) return "slight";
  if (r < 0.6 || n < SOLID_PAIRS) return "moderate";
  return "strong";
}

export interface FactorGroup {
  label: string;
  n: number;
  mean: number;
}

export interface RelationshipResult {
  /** Paired days found. */
  n: number;
  /** Of the outcome's logged days in range, how many found a factor to pair
      with. A low number means the factor is logged rarely, not that there is
      no relationship — and the UI says which. */
  coverage: number;
  /** Days the outcome was logged in range. */
  outcomeDays: number;
  lag: number;
  rho: number | null;
  strength: Strength;
  /** Whether higher factor went with higher outcome, in raw terms. */
  direction: "up" | "down" | "flat";
  /** True when there is enough to show anything at all. */
  enough: boolean;
  /** How many more paired days are needed. Zero when `enough`. */
  needs: number;
  pairs: Pair[];
  /** A two-group split for factors that only take a few values — a yes/no
      trigger, or a 1–10 rating split at its own median. Often the only shape
      of this a person can actually read. */
  groups: FactorGroup[];
  /** The gap between the two groups' outcome averages, low group first. */
  groupDelta: number | null;
}

export interface RelationshipInput {
  entries: Entryish[];
  outcomeKey: string;
  factorKey: string;
  lag?: number;
  start?: string;
  end?: string;
  /** Labels for the two halves of the split. */
  groupLabels?: [string, string];
}

export function relationship(input: RelationshipInput): RelationshipResult {
  const { outcomeKey, factorKey } = input;
  const lag = input.lag ?? 0;
  const inRange = input.entries.filter((e) =>
    e && typeof e.date === "string"
    && (!input.start || e.date >= input.start)
    && (!input.end || e.date <= input.end));

  const outcomeDays = inRange.filter((e) => num(e.answers?.[outcomeKey]) != null).length;
  const pairs = pairUp(inRange, outcomeKey, factorKey, lag);
  const rho = spearman(pairs);
  const n = pairs.length;

  /* Split at the factor's own median rather than at a fixed number: "high" for
     a 1–10 rating and "high" for a step count have nothing in common except
     that half this person's days are above it. */
  const xs = pairs.map((p) => p.x).sort((a, b) => a - b);
  const cut = xs.length ? xs[xs.length >> 1] : 0;
  const low = pairs.filter((p) => p.x < cut);
  const high = pairs.filter((p) => p.x >= cut);
  const mean = (rows: Pair[]) => rows.reduce((a, p) => a + p.y, 0) / (rows.length || 1);
  const [lowLabel, highLabel] = input.groupLabels || ["Lower days", "Higher days"];
  const groups: FactorGroup[] = low.length && high.length
    ? [
      { label: lowLabel, n: low.length, mean: mean(low) },
      { label: highLabel, n: high.length, mean: mean(high) },
    ]
    : [];

  return {
    n,
    coverage: outcomeDays ? n / outcomeDays : 0,
    outcomeDays,
    lag,
    rho,
    strength: strengthOf(rho, n),
    direction: rho == null || Math.abs(rho) < 0.2 ? "flat" : rho > 0 ? "up" : "down",
    enough: n >= MIN_PAIRS,
    needs: Math.max(0, MIN_PAIRS - n),
    pairs,
    groups,
    groupDelta: groups.length === 2 ? groups[1].mean - groups[0].mean : null,
  };
}

/* ---------- words ----------
   Every user-facing phrase this feature can produce lives here, so the
   causal-language audit has one file to read and there is no second place for
   a stray "causes" to hide. */

export const RELATIONSHIP_COPY = {
  heading: "Possible relationships",
  intro:
    "Pick something you're tracking and something you suspect. This compares the "
    + "days they were both logged. It can show that two things moved together — "
    + "it cannot show that one made the other happen.",
  notProof:
    "Moving together is not proof that one causes the other. Something else may "
    + "explain both, and a run of days can look related by chance.",
  none: "No clear pattern in these days.",
  slight: "A slight tendency to move together.",
  moderate: "These moved together fairly often.",
  strong: "These moved together closely across these days.",
  lagOn: "Comparing each day's outcome with the day before's factor.",
  lagOff: "Comparing both on the same day.",
} as const;

export const STRENGTH_COPY: Record<Strength, string> = {
  none: RELATIONSHIP_COPY.none,
  slight: RELATIONSHIP_COPY.slight,
  moderate: RELATIONSHIP_COPY.moderate,
  strong: RELATIONSHIP_COPY.strong,
};

/** "12 more days needed" — the honest version of an empty chart. */
export const needsLine = (r: RelationshipResult): string =>
  r.needs === 1
    ? "One more day with both logged and this will appear."
    : `${r.needs} more days with both logged and this will appear.`;
