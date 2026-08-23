/* The derived-metric registry.

   Three of this app's collections — meals, bowel movements, routine doses —
   are many-per-day, while the trend chart is one-value-per-day. Each of those
   modules defines how *its* rows reduce to a daily number; this file is the
   one place that knows about all three at once, so the chart, the metric
   picker and the AI payload each ask a single question ("what can be plotted,
   and what is today's value") rather than three.

   It exists as its own module for a boring but load-bearing reason: ./routine
   imports ./tracking for the clock helpers, so ./tracking cannot import
   ./routine back. The registry has to sit above both. */

import type { DerivedMetric, MetricCtx } from "./tracking";
import { BOWEL_METRICS, FOOD_METRICS } from "./tracking";
import { ROUTINE_METRICS } from "./routine";
import { RITUAL_METRICS } from "./rituals";
import type { Ritual, RitualRun } from "./rituals";
import type { BowelLog, FoodLog, RoutineItem, RoutineLog } from "../types/models";

export type { DerivedMetric, MetricCtx };

/** Everything that can be charted alongside a survey question. */
export const DERIVED_METRICS: DerivedMetric[] = [
  ...FOOD_METRICS,
  ...BOWEL_METRICS,
  ...ROUTINE_METRICS,
  ...RITUAL_METRICS,
];

export const derivedMetric = (k: string): DerivedMetric | undefined =>
  DERIVED_METRICS.find((m) => m.k === k);

export const isDerivedKey = (k: string): boolean => DERIVED_METRICS.some((m) => m.k === k);

/** The collections a metric can be computed from. All optional — a journal
    with no routine should not have to pass an empty one to plot its meals. */
export interface MetricSource {
  food?: FoodLog[];
  bowel?: BowelLog[];
  routine?: RoutineLog[];
  routineItems?: RoutineItem[];
  rituals?: Ritual[];
  ritualRuns?: RitualRun[];
}

/** One day's context, ready to hand to `metric.value`. */
export const metricCtx = (source: MetricSource, date: string): MetricCtx => ({
  food: source.food || [],
  bowel: source.bowel || [],
  routine: source.routine || [],
  routineItems: source.routineItems || [],
  rituals: source.rituals || [],
  ritualRuns: source.ritualRuns || [],
  date,
});

/** Which derived metrics have enough data to be worth offering. A picker full
    of always-empty options is worse than a short one. */
export function availableDerivedMetrics(
  source: MetricSource, dates: string[], minDays = 2
): DerivedMetric[] {
  return DERIVED_METRICS.filter((m) => {
    let n = 0;
    for (const date of dates) {
      if (m.value(metricCtx(source, date)) != null) n += 1;
      if (n >= minDays) return true;
    }
    return false;
  });
}

/** One derived metric across a run of dates, in the shape the chart already
    understands ({ date, value }). */
export function derivedSeries(
  m: DerivedMetric, source: MetricSource, dates: string[]
): { date: string; value: number | null }[] {
  return dates.map((date) => ({ date, value: m.value(metricCtx(source, date)) }));
}
