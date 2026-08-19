/* The long view: every month on record, and what a year looks like next to the
   one before it.

   This is the section with the most ways to mislead, so it is the section with
   the most floors. A month built on four logged days is not plotted, a
   same-month comparison needs both sides solid, and the seasonal card does not
   appear at all until most months of the year have more than one year behind
   them — because "your Januaries average 7.2" computed from one January is just
   that January with a grander name on it.

   Where something is hidden, the reason is printed. A person who logs
   irregularly should learn what the app needs, not conclude the feature is
   broken. */

import React, { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { C } from "../lib/theme";
import {
  extremeMonths, historySpan, longestStableRun, MIN_DAYS_PER_MONTH,
  MIN_YEARS_FOR_SEASON, monthlyAverages, sameMonthLastYear, seasonalAverages,
  seasonsWorthShowing, yearLines, type Direction, type Entryish,
} from "../lib/longterm";

type Props = {
  entries: Entryish[];
  metricKey: string;
  metricLabel: string;
  dir?: Direction;
  today: string;
  tint: string;
  palette: string[];
  tooltipProps: () => Record<string, unknown>;
  axisTick: () => Record<string, unknown>;
  chartAnim: () => Record<string, unknown>;
  onFeedback?: (kind: string) => void;
};

const fmt1 = (x: number | null | undefined) =>
  x == null ? "–" : (Math.round(x * 10) / 10).toString();
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const fmtDay = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-[11.5px] leading-relaxed mt-2" style={{ color: C.subtle }}>{children}</p>;
}

function Disclose({ label, summary, open, onToggle, children }: {
  label: string; summary: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <>
      <button type="button" className="fhj-disclose mt-3.5" aria-expanded={open} onClick={onToggle}>
        <span className="flex-1 min-w-0">
          <span className="block text-[13px] font-semibold" style={{ color: C.ink }}>{label}</span>
          <span className="block text-[11.5px] truncate mt-0.5" style={{ color: C.subtle }}>{summary}</span>
        </span>
        <span className="fhj-disclose-chev" aria-hidden="true">
          <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {open && <div className="fhj-disclose-panel">{children}</div>}
    </>
  );
}

export default function LongTermView({
  entries, metricKey, metricLabel, dir, today, tint, palette,
  tooltipProps, axisTick, chartAnim, onFeedback,
}: Props) {
  const months = useMemo(() => monthlyAverages(entries, metricKey, dir), [entries, metricKey, dir]);
  const lines = useMemo(() => yearLines(months), [months]);
  const compare = useMemo(() => sameMonthLastYear(months, today, dir), [months, today, dir]);
  const { best, worst } = useMemo(() => extremeMonths(months, dir), [months, dir]);
  const stable = useMemo(() => longestStableRun(entries, metricKey, dir), [entries, metricKey, dir]);
  const season = useMemo(() => seasonalAverages(months), [months]);

  const [openYoY, setOpenYoY] = useState(false);
  const [openSeason, setOpenSeason] = useState(false);

  const solid = months.filter((m) => m.solid);
  if (solid.length < 2) {
    return (
      <div className="rounded-xl px-6 py-8 text-center"
        style={{ background: C.faint, border: `1.5px dashed ${C.line}` }}>
        <div className="text-sm leading-relaxed" style={{ color: C.sub }}>
          The long view opens once two months each have {MIN_DAYS_PER_MONTH} or more
          days of “{metricLabel}” in them.
        </div>
        <div className="text-[11px] mt-2" style={{ color: C.subtle }}>
          {solid.length === 1 ? "One month qualifies so far." : "No month qualifies yet."}
        </div>
      </div>
    );
  }

  const monthData = months.map((m) => ({
    d: m.label + (m.month === 0 ? ` ${String(m.year).slice(2)}` : ""),
    key: m.key, full: m.full,
    v: m.solid && m.average != null ? Math.round(m.average * 10) / 10 : null,
  }));

  const yoyData = MONTH_SHORT.map((label, i) => {
    const row: Record<string, string | number | null> = { d: label };
    for (const l of lines) row[`y${l.year}`] = l.points[i];
    return row;
  });
  const yoyYears = lines.filter((l) => l.solidMonths >= 2).slice(-3);

  return (
    <div>
      <div className="fhj-eyebrow mb-2">Monthly average · {historySpan(months)}</div>
      <div style={{ width: "100%", height: 168 }}>
        <ResponsiveContainer>
          <BarChart data={monthData} margin={{ top: 8, right: 6, left: -4, bottom: 0 }}>
            <CartesianGrid stroke={C.grid} vertical={false} strokeDasharray="2 5" />
            <XAxis dataKey="d" tick={axisTick()} axisLine={false} tickLine={false}
              tickMargin={7} minTickGap={8} interval="preserveStartEnd" />
            <YAxis domain={[0, 10]} ticks={[0, 5, 10]} tick={axisTick()}
              axisLine={false} tickLine={false} width={30} />
            <Tooltip cursor={{ fill: C.faint }}
              labelFormatter={(_l, p) => (p?.[0]?.payload?.full as string) || ""}
              formatter={(v) => [v, "monthly average"]} {...tooltipProps()} />
            <Bar dataKey="v" radius={[5, 5, 2, 2]} {...chartAnim()}>
              {monthData.map((m) => (
                <Cell key={m.key} fill={tint}
                  fillOpacity={m.key === today.slice(0, 7) ? 1 : 0.5} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="fhj-caption mt-1">
        A month is only drawn once it has {MIN_DAYS_PER_MONTH} rated days in it.
      </div>

      {/* the four things a long history can actually tell you */}
      <div className="fhj-lt-cards mt-3.5">
        <div className="fhj-lt-card" style={{ background: C.faint }}>
          <div className="fhj-eyebrow leading-snug">This month vs last year</div>
          {compare.enough ? (
            <>
              <div className="font-display text-[1.5rem] leading-none mt-1.5 tabular-nums"
                style={{ color: compare.improving == null ? C.ink : compare.improving ? C.good : C.alert }}>
                {compare.delta! > 0 ? "+" : ""}{fmt1(compare.delta)}
              </div>
              <div className="text-[11px] mt-1.5 leading-snug" style={{ color: C.subtle }}>
                {fmt1(compare.now!.average)} now · {fmt1(compare.prev!.average)} in {compare.prev!.full}
              </div>
            </>
          ) : (
            <div className="text-[11.5px] mt-1.5 leading-relaxed" style={{ color: C.subtle }}>
              {compare.prev
                ? `${compare.prev.full} has only ${compare.prev.logged} rated ${compare.prev.logged === 1 ? "day" : "days"} — too few to compare.`
                : "No same month a year ago to compare with yet."}
            </div>
          )}
        </div>

        <div className="fhj-lt-card" style={{ background: C.faint }}>
          <div className="fhj-eyebrow leading-snug">Best month</div>
          <div className="font-display text-[1.5rem] leading-none mt-1.5 tabular-nums" style={{ color: C.good }}>
            {fmt1(best?.average)}
          </div>
          <div className="text-[11px] mt-1.5 leading-snug" style={{ color: C.subtle }}>
            {best ? best.full : "—"}
          </div>
        </div>

        <div className="fhj-lt-card" style={{ background: C.faint }}>
          <div className="fhj-eyebrow leading-snug">Hardest month</div>
          <div className="font-display text-[1.5rem] leading-none mt-1.5 tabular-nums" style={{ color: C.bad }}>
            {fmt1(worst?.average)}
          </div>
          <div className="text-[11px] mt-1.5 leading-snug" style={{ color: C.subtle }}>
            {worst ? worst.full : "—"}
          </div>
        </div>

        <div className="fhj-lt-card" style={{ background: C.faint }}>
          <div className="fhj-eyebrow leading-snug">Longest calm run</div>
          <div className="font-display text-[1.5rem] leading-none mt-1.5 tabular-nums" style={{ color: C.ink }}>
            {stable ? stable.days : "–"}
            {stable && <span className="text-[0.75rem] font-sans ml-1" style={{ color: C.subtle }}>days</span>}
          </div>
          <div className="text-[11px] mt-1.5 leading-snug" style={{ color: C.subtle }}>
            {stable ? `from ${fmtDay(stable.start)}` : "No calm run logged end to end yet"}
          </div>
        </div>
      </div>
      {stable && (
        <Note>
          A calm run only counts days logged back to back — a gap ends it, because
          not writing anything down is not evidence of a good day.
        </Note>
      )}

      {yoyYears.length >= 2 && (
        <Disclose
          label="Put the years on top of each other"
          summary={`${yoyYears.map((y) => y.year).join(" · ")} — one line per year`}
          open={openYoY}
          onToggle={() => { onFeedback?.("tap"); setOpenYoY((o) => !o); }}
        >
          <div style={{ width: "100%", height: 190 }}>
            <ResponsiveContainer>
              <LineChart data={yoyData} margin={{ top: 8, right: 6, left: -4, bottom: 0 }}>
                <CartesianGrid stroke={C.grid} vertical={false} strokeDasharray="2 5" />
                <XAxis dataKey="d" tick={axisTick()} axisLine={false} tickLine={false}
                  tickMargin={7} interval={0} minTickGap={2} />
                <YAxis domain={[1, 10]} ticks={[1, 4, 7, 10]} tick={axisTick()}
                  axisLine={false} tickLine={false} width={30} />
                <Tooltip formatter={(v, name) => [v, String(name).slice(1)]} {...tooltipProps()} />
                {yoyYears.map((l, j) => (
                  <Line key={l.year} type="monotone" dataKey={`y${l.year}`}
                    stroke={j === yoyYears.length - 1 ? tint : palette[(j + 1) % palette.length]}
                    strokeWidth={j === yoyYears.length - 1 ? 2.5 : 1.75}
                    strokeOpacity={j === yoyYears.length - 1 ? 1 : 0.62}
                    dot={{ r: 2 }} connectNulls {...chartAnim()} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 mt-2">
            {yoyYears.map((l, j) => (
              <span key={l.year} className="flex items-center gap-1.5 text-[11px]" style={{ color: C.sub }}>
                <span className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: j === yoyYears.length - 1 ? tint : palette[(j + 1) % palette.length] }} />
                {l.year}
              </span>
            ))}
          </div>
          <Note>Months with too little in them are left out of the line rather than drawn at zero.</Note>
        </Disclose>
      )}

      {seasonsWorthShowing(season) ? (
        <Disclose
          label="Does the time of year matter?"
          summary="Each month averaged across every year on record"
          open={openSeason}
          onToggle={() => { onFeedback?.("tap"); setOpenSeason((o) => !o); }}
        >
          <div style={{ width: "100%", height: 160 }}>
            <ResponsiveContainer>
              <BarChart data={season.map((s) => ({ d: s.label, v: s.average == null ? null : Math.round(s.average * 10) / 10, years: s.years }))}
                margin={{ top: 8, right: 6, left: -4, bottom: 0 }}>
                <CartesianGrid stroke={C.grid} vertical={false} strokeDasharray="2 5" />
                <XAxis dataKey="d" tick={axisTick()} axisLine={false} tickLine={false} interval={0} tickMargin={7} />
                <YAxis domain={[0, 10]} ticks={[0, 5, 10]} tick={axisTick()} axisLine={false} tickLine={false} width={30} />
                <Tooltip cursor={{ fill: C.faint }}
                  formatter={(v, _n, p) => [v, `average across ${p?.payload?.years} years`]}
                  {...tooltipProps()} />
                <Bar dataKey="v" radius={[5, 5, 2, 2]} {...chartAnim()}>
                  {season.map((s) => (
                    <Cell key={s.month} fill={tint}
                      fillOpacity={s.years >= MIN_YEARS_FOR_SEASON ? 0.85 : 0.3} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <Note>
            Paler bars have only one year behind them. A month needs at least
            {" "}{MIN_YEARS_FOR_SEASON} before it says anything about the season rather than
            about that one year.
          </Note>
        </Disclose>
      ) : (
        <Note>
          Seasonal averages appear once most months of the year have
          {" "}{MIN_YEARS_FOR_SEASON} years behind them. Until then a “seasonal”
          figure would just be one year wearing the word.
        </Note>
      )}
    </div>
  );
}
