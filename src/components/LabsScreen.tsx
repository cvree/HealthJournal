/* Labs & Measurements.

   The visual idea, and the reason this screen exists rather than a table: a
   new result *arrives into* its own history. It lands, the line reaches back
   and connects it to the previous measurement, the delta counts up, and the
   band under it fills in with what else was in the journal during that gap.
   That is the whole story of a lab value — where it was, where it is, and what
   the months in between contained — told in the order a person actually asks
   it.

   Two things the design refuses:

   · The reference range is drawn from the record, never from the catalog. A
     result with no range recorded gets no band, no colour and no verdict. The
     app does not know what normal is for somebody else's assay.
   · Estimated vitamin D from sunlight sits beside a 25(OH)D result, on its own
     track, in its own unit, under its own heading. Never on the same axis.
     They are different quantities and the screen says so out loud. */

import React, { useMemo, useState } from "react";
import { C } from "../lib/theme";
import {
  CATEGORY_LABEL, CHANGE_COPY, LAB_TESTS, RANGE_COPY, VITAMIN_D_PAIRING_NOTE,
  changesBetween, labSeries, labTest, labValueLabel, searchTests, seriesLabel,
  testsHeld, trimNum, vitaminDBesideSun,
  type ChangeEvent, type LabPoint, type LabResult, type LabTest,
} from "../lib/labs";
import type { SunSession } from "../lib/sun";
import type { DayContext } from "../lib/context";
import type { HealthEpisode } from "../lib/episodes";
import type { RoutineItem } from "../types/models";

type Props = {
  labs: LabResult[];
  sun?: SunSession[];
  context?: DayContext[];
  episodes?: HealthEpisode[];
  routineItems?: RoutineItem[];
  today: string;
  viewer?: boolean;
  onSave: (input: any) => void;
  onDelete: (id: string) => void;
  /** Lights the surrounding days up everywhere else. */
  onHighlight: (dates: string[], label: string) => void;
  onFeedback?: (kind: string) => void;
};

export default function LabsScreen({
  labs, sun = [], context = [], episodes = [], routineItems = [], today,
  viewer = false, onSave, onDelete, onHighlight, onFeedback,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [openTest, setOpenTest] = useState<string | null>(null);
  const held = useMemo(() => testsHeld(labs), [labs]);

  if (openTest) {
    return (
      <TestDetail
        testKey={openTest}
        labs={labs}
        sun={sun}
        context={context}
        episodes={episodes}
        routineItems={routineItems}
        viewer={viewer}
        onBack={() => setOpenTest(null)}
        onDelete={onDelete}
        onHighlight={onHighlight}
      />
    );
  }

  return (
    <div className="fhj-labs">
      <header className="fhj-exp-head">
        <h1 className="fhj-page-title">Labs & measurements</h1>
        <p className="fhj-exp-lede">
          Blood work, blood pressure, weight — anything somebody measured. Add the range your lab printed
          and every reading is judged against that one, not against a number in this app.
        </p>
      </header>

      {!viewer && (
        <button type="button" className="fhj-btn fhj-btn-primary fhj-btn-block fhj-pop" onClick={() => setAdding(true)}>
          Add a result
        </button>
      )}

      {held.length === 0 && (
        <div className="fhj-empty">
          <div className="fhj-empty-title">Nothing measured yet</div>
          <p>
            Add a result and it becomes part of your timeline — with whatever else your journal held during
            the months around it.
          </p>
        </div>
      )}

      <div className="fhj-labs-list">
        {held.map(({ key, name, count, latest }) => {
          const series = labSeries(labs, key);
          return (
            <button key={key} type="button" className="fhj-labs-row" onClick={() => setOpenTest(key)}>
              <div className="fhj-labs-row-main">
                <div className="fhj-labs-row-name">{name}</div>
                <div className="fhj-labs-row-series">{seriesLabel(series)}</div>
              </div>
              <div className="fhj-labs-row-right">
                <MiniLine points={series} />
                <div className="fhj-labs-row-meta">
                  {count} {count === 1 ? "result" : "results"}
                  {latest.status !== "unknown" && (
                    <span className="fhj-labs-dot" data-status={latest.status} aria-hidden />
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {adding && (
        <AddSheet
          today={today}
          onClose={() => setAdding(false)}
          onSave={(input) => {
            onSave(input);
            setAdding(false);
            onFeedback?.("save");
          }}
        />
      )}
    </div>
  );
}

/* ---------- one test ---------- */

function TestDetail({
  testKey, labs, sun, context, episodes, routineItems, viewer, onBack, onDelete, onHighlight,
}: {
  testKey: string;
  labs: LabResult[];
  sun: SunSession[];
  context: DayContext[];
  episodes: HealthEpisode[];
  routineItems: RoutineItem[];
  viewer: boolean;
  onBack: () => void;
  onDelete: (id: string) => void;
  onHighlight: (dates: string[], label: string) => void;
}) {
  const points = useMemo(() => labSeries(labs, testKey), [labs, testKey]);
  const [selected, setSelected] = useState(points.length - 1);
  const point = points[Math.min(selected, points.length - 1)];
  const prev = selected > 0 ? points[selected - 1] : undefined;
  const test = labTest(testKey);

  const changes = useMemo<ChangeEvent[]>(
    () => (prev ? changesBetween(prev.date, point.date, { sun, context, episodes, routineItems }) : []),
    [prev?.date, point?.date, sun, context, episodes, routineItems]
  );

  const vdPairs = useMemo(
    () => (testKey === "vitamin_d" ? vitaminDBesideSun(labs, sun) : []),
    [testKey, labs, sun]
  );
  const vdForPoint = vdPairs.find((p) => p.point.id === point?.id);

  if (!point) return null;

  return (
    <div className="fhj-labs-detail">
      <button type="button" className="fhj-linkish" onClick={onBack}>← All measurements</button>
      <h1 className="fhj-page-title" style={{ marginTop: 6 }}>{point.name}</h1>

      <LabChart points={points} selected={selected} onSelect={setSelected} />

      <section className="fhj-card fhj-labs-value">
        <div className="fhj-labs-value-top">
          <div>
            <div className="fhj-eyebrow">{fmtDate(point.date)}</div>
            <div className="fhj-labs-big">{labValueLabel(point)}</div>
          </div>
          {point.delta !== undefined && (
            <div className={"fhj-labs-delta" + (point.delta > 0 ? " is-up" : point.delta < 0 ? " is-down" : "")}>
              <span aria-hidden>{point.delta > 0 ? "↑" : point.delta < 0 ? "↓" : "→"}</span>
              {trimNum(Math.abs(point.delta))}
              <em>over {point.gapDays} days</em>
            </div>
          )}
        </div>

        <div className="fhj-labs-range">
          {point.status === "unknown" ? (
            <span style={{ color: C.subtle }}>{RANGE_COPY.unknown}</span>
          ) : (
            <>
              <RangeBar point={point} />
              <span data-status={point.status}>
                {RANGE_COPY[point.status]}
                {point.refLow !== undefined || point.refHigh !== undefined ? (
                  <em>
                    {" "}
                    ({point.refLow !== undefined ? trimNum(point.refLow) : "–"}–
                    {point.refHigh !== undefined ? trimNum(point.refHigh) : "–"} {point.unit})
                  </em>
                ) : null}
              </span>
            </>
          )}
        </div>

        <ul className="fhj-labs-meta">
          {point.fasting !== undefined && <li>{point.fasting ? "Fasting" : "Not fasting"}</li>}
          {point.time && <li>{point.time}</li>}
          {point.provider && <li>{point.provider}</li>}
          {point.refText && <li>Lab note: {point.refText}</li>}
        </ul>
        {point.note && <p className="fhj-labs-note">{point.note}</p>}

        {!viewer && (
          <button type="button" className="fhj-linkish fhj-linkish-quiet" onClick={() => onDelete(point.id)}>
            Delete this result
          </button>
        )}
      </section>

      {prev && (
        <section className="fhj-card">
          <div className="fhj-eyebrow">{CHANGE_COPY.heading}</div>
          <div className="fhj-labs-gap">
            <span>{fmtDate(prev.date)}</span>
            <span className="fhj-labs-gap-line" aria-hidden />
            <span>{fmtDate(point.date)}</span>
          </div>
          {changes.length ? (
            <ul className="fhj-labs-changes">
              {changes.map((c, i) => (
                <li key={`${c.kind}${c.date}${i}`}>
                  <span className="fhj-labs-change-mark" data-kind={c.kind} aria-hidden>
                    {CHANGE_GLYPH[c.kind]}
                  </span>
                  <span>
                    <strong>{c.label}</strong>
                    {c.detail && <em>{c.detail}</em>}
                    <span className="fhj-labs-change-date">{fmtDate(c.date)}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="fhj-labs-empty-changes">Nothing else in your journal stands out from this period.</p>
          )}
          <p className="fhj-note">{CHANGE_COPY.caveat}</p>
          <button
            type="button"
            className="fhj-linkish"
            onClick={() => onHighlight(daysBetweenList(prev.date, point.date), `${point.name}, ${fmtDate(prev.date)}–${fmtDate(point.date)}`)}
          >
            Light this period up
          </button>
        </section>
      )}

      {testKey === "vitamin_d" && vdForPoint && vdForPoint.daysOutside > 0 && (
        <section className="fhj-card fhj-labs-vd">
          <div className="fhj-eyebrow">Beside your sunlight</div>
          <div className="fhj-labs-vd-two">
            <div className="fhj-labs-vd-side" data-kind="measured">
              <div className="fhj-eyebrow">Measured — blood level</div>
              <div className="fhj-labs-vd-num">{labValueLabel(point)}</div>
              <div className="fhj-labs-vd-sub">A laboratory result</div>
            </div>
            <div className="fhj-labs-vd-side" data-kind="estimated">
              <div className="fhj-eyebrow">Estimated — sunlight production</div>
              <div className="fhj-labs-vd-num">
                ~{vdForPoint.estimatedLow.toLocaleString("en-US")}–{vdForPoint.estimatedHigh.toLocaleString("en-US")} IU
              </div>
              <div className="fhj-labs-vd-sub">
                over the {vdForPoint.windowDays} days before, across {vdForPoint.daysOutside} days outside
              </div>
            </div>
          </div>
          <p className="fhj-note">{VITAMIN_D_PAIRING_NOTE}</p>
        </section>
      )}

      {test?.hint && <p className="fhj-note">{test.hint}</p>}
    </div>
  );
}

const CHANGE_GLYPH: Record<ChangeEvent["kind"], string> = {
  sun: "☀",
  routine: "◍",
  episode: "▲",
  season: "❈",
  travel: "→",
  note: "·",
};

/* ---------- the chart ----------

   The connecting line is the point. Each result is a node; the segment between
   two nodes is drawn as its own path so it can be animated in as a *reach*
   from the older value to the newer one, which is what a new result physically
   doing something to the history looks like. */

function LabChart({
  points, selected, onSelect,
}: {
  points: LabPoint[];
  selected: number;
  onSelect: (i: number) => void;
}) {
  const W = 100;
  const H = 96;
  const geo = useMemo(() => {
    const vals = points.map((p) => p.value);
    const lows = points.map((p) => p.refLow).filter((v): v is number => v !== undefined);
    const highs = points.map((p) => p.refHigh).filter((v): v is number => v !== undefined);
    const all = [...vals, ...lows, ...highs];
    const min = Math.min(...all);
    const max = Math.max(...all);
    const pad = (max - min) * 0.18 || Math.max(1, max * 0.1);
    return { min: min - pad, max: max + pad };
  }, [points]);

  const x = (i: number) => (points.length === 1 ? W / 2 : 8 + (i / (points.length - 1)) * (W - 16));
  const y = (v: number) => H - 12 - ((v - geo.min) / Math.max(0.0001, geo.max - geo.min)) * (H - 26);

  const last = points[points.length - 1];
  const bandLow = last?.refLow;
  const bandHigh = last?.refHigh;

  return (
    <div className="fhj-lab-chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${points.length} results from ${points[0].date} to ${last.date}. ${seriesLabel(points)}.`}
      >
        {/* The lab's own range, when there is one. Never the catalog's. */}
        {bandLow !== undefined && bandHigh !== undefined && (
          <rect
            x={0}
            y={y(bandHigh)}
            width={W}
            height={Math.max(1, y(bandLow) - y(bandHigh))}
            fill={C.goodSoft}
          />
        )}

        {/* Each segment its own path, so it can reach across on arrival. */}
        {points.slice(1).map((p, i) => (
          <line
            key={p.id}
            className="fhj-lab-link"
            x1={x(i)}
            y1={y(points[i].value)}
            x2={x(i + 1)}
            y2={y(p.value)}
            stroke={C.accent}
            strokeWidth={1.6}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            style={{ animationDelay: `${i * 90}ms` }}
          />
        ))}

        {points.map((p, i) => (
          <g key={p.id} className={"fhj-lab-node" + (i === selected ? " is-on" : "")}>
            <circle
              cx={x(i)}
              cy={y(p.value)}
              r={i === selected ? 3.4 : 2.4}
              fill={i === selected ? C.accent : C.card}
              stroke={C.accent}
              strokeWidth={1.4}
              vectorEffect="non-scaling-stroke"
              style={{ animationDelay: `${i * 90}ms` }}
            />
          </g>
        ))}
      </svg>

      {/* Real buttons over the nodes: an SVG circle is not a tap target. */}
      <div className="fhj-lab-picks">
        {points.map((p, i) => (
          <button
            key={p.id}
            type="button"
            className={"fhj-lab-pick" + (i === selected ? " is-on" : "")}
            style={{ left: `${x(i)}%` }}
            aria-label={`${labValueLabel(p)} on ${fmtDate(p.date)}`}
            aria-pressed={i === selected}
            onClick={() => onSelect(i)}
          >
            <span>{trimNum(p.value)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MiniLine({ points }: { points: LabPoint[] }) {
  if (points.length < 2) return <div className="fhj-labs-mini" aria-hidden />;
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const d = vals
    .map((v, i) => `${i ? "L" : "M"}${(i / (vals.length - 1)) * 40},${14 - ((v - min) / span) * 12}`)
    .join(" ");
  return (
    <svg className="fhj-labs-mini" viewBox="0 0 40 16" aria-hidden>
      <path d={d} fill="none" stroke={C.accent} strokeWidth={1.3} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={40} cy={14 - ((vals[vals.length - 1] - min) / span) * 12} r={1.8} fill={C.accent} />
    </svg>
  );
}

function RangeBar({ point }: { point: LabPoint }) {
  const low = point.refLow;
  const high = point.refHigh;
  if (low === undefined || high === undefined) return null;
  const span = high - low;
  const pad = span * 0.6;
  const min = low - pad;
  const max = high + pad;
  const pos = Math.max(0, Math.min(100, ((point.value - min) / (max - min)) * 100));
  const from = ((low - min) / (max - min)) * 100;
  const to = ((high - min) / (max - min)) * 100;
  return (
    <div className="fhj-labs-rangebar" aria-hidden>
      <span className="fhj-labs-rangebar-band" style={{ left: `${from}%`, width: `${to - from}%` }} />
      <span className="fhj-labs-rangebar-pin" style={{ left: `${pos}%` }} data-status={point.status} />
    </div>
  );
}

/* ---------- adding ---------- */

function AddSheet({
  today, onClose, onSave,
}: {
  today: string;
  onClose: () => void;
  onSave: (input: any) => void;
}) {
  const [query, setQuery] = useState("");
  const [test, setTest] = useState<LabTest | null>(null);
  const [custom, setCustom] = useState("");
  const [value, setValue] = useState("");
  const [value2, setValue2] = useState("");
  const [unit, setUnit] = useState("");
  const [date, setDate] = useState(today);
  const [refLow, setRefLow] = useState("");
  const [refHigh, setRefHigh] = useState("");
  const [fasting, setFasting] = useState<boolean | undefined>(undefined);
  const [provider, setProvider] = useState("");
  const [note, setNote] = useState("");

  const results = useMemo(() => searchTests(query), [query]);
  const grouped = useMemo(() => {
    const map = new Map<LabTest["category"], LabTest[]>();
    for (const t of results) {
      const list = map.get(t.category) || [];
      list.push(t);
      map.set(t.category, list);
    }
    return [...map.entries()];
  }, [results]);

  const pick = (t: LabTest) => {
    setTest(t);
    setUnit(t.units[0].unit);
    /* The typical range is offered as a prefill and labelled as one. It is
       never saved unless the person leaves it there, and the field says whose
       number it is. */
    setRefLow(t.typicalLow !== undefined ? String(t.typicalLow) : "");
    setRefHigh(t.typicalHigh !== undefined ? String(t.typicalHigh) : "");
  };

  const canSave = (test || custom.trim()) && value.trim() !== "" && Number.isFinite(Number(value));

  return (
    <div className="fhj-scrim" role="dialog" aria-modal="true" aria-label="Add a measurement">
      <div className="fhj-sheet fhj-labs-add">
        <div className="fhj-sheet-grab" aria-hidden />

        {!test && !custom ? (
          <>
            <div className="fhj-sheet-head">
              <h2 className="fhj-page-title" style={{ fontSize: 22 }}>What was measured?</h2>
            </div>
            <div className="fhj-sheet-body">
            <input
              className="fhj-input"
              placeholder="Search — vitamin d, a1c, bp…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <div className="fhj-labs-catalog">
              {grouped.map(([cat, tests]) => (
                <div key={cat}>
                  <div className="fhj-eyebrow">{CATEGORY_LABEL[cat]}</div>
                  <div className="fhj-chip-row">
                    {tests.map((t) => (
                      <button key={t.key} type="button" className="fhj-chip" onClick={() => pick(t)}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="fhj-btn fhj-btn-outline fhj-btn-block"
                onClick={() => setCustom(query.trim() || "My measurement")}
              >
                Something else{query.trim() ? ` — “${query.trim()}”` : ""}
              </button>
            </div>
            </div>
            <div className="fhj-sheet-actions">
              <button type="button" className="fhj-btn fhj-btn-ghost" onClick={onClose}>Cancel</button>
            </div>
          </>
        ) : (
          <>
            <div className="fhj-sheet-head">
              <h2 className="fhj-page-title" style={{ fontSize: 22 }}>{test?.label || custom}</h2>
            </div>
            <div className="fhj-sheet-body">
            {!test && (
              <>
                <div className="fhj-label" id="lab-custom">Name</div>
                <input className="fhj-input" aria-labelledby="lab-custom" value={custom} onChange={(e) => setCustom(e.target.value)} />
              </>
            )}

            <div className="fhj-labs-fields">
              <label className="fhj-labs-field">
                <span className="fhj-label">{test?.paired ? "Systolic" : "Value"}</span>
                <input className="fhj-input" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
              </label>
              {test?.paired && (
                <label className="fhj-labs-field">
                  <span className="fhj-label">{test.pairedLabel || "Second value"}</span>
                  <input className="fhj-input" inputMode="decimal" value={value2} onChange={(e) => setValue2(e.target.value)} />
                </label>
              )}
              <label className="fhj-labs-field">
                <span className="fhj-label">Unit</span>
                {test && test.units.length > 1 ? (
                  <select className="fhj-input" value={unit} onChange={(e) => setUnit(e.target.value)}>
                    {test.units.map((u) => (
                      <option key={u.unit} value={u.unit}>{u.unit}</option>
                    ))}
                  </select>
                ) : (
                  <input className="fhj-input" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="mg/dL" />
                )}
              </label>
              <label className="fhj-labs-field">
                <span className="fhj-label">Date</span>
                <input className="fhj-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
            </div>

            <div className="fhj-label">Reference range, as your lab printed it</div>
            <div className="fhj-labs-fields">
              <label className="fhj-labs-field">
                <span className="fhj-label">Low</span>
                <input className="fhj-input" inputMode="decimal" value={refLow} onChange={(e) => setRefLow(e.target.value)} />
              </label>
              <label className="fhj-labs-field">
                <span className="fhj-label">High</span>
                <input className="fhj-input" inputMode="decimal" value={refHigh} onChange={(e) => setRefHigh(e.target.value)} />
              </label>
            </div>
            {test && (test.typicalLow !== undefined || test.typicalHigh !== undefined) && (
              <p className="fhj-note">
                Filled in from a common range so you have something to correct. Replace it with the one on your
                report — ranges differ between labs, and yours is the one that counts.
              </p>
            )}

            <div className="fhj-label">Fasting</div>
            <div className="fhj-chip-row">
              {[
                { v: undefined, l: "Not recorded" },
                { v: true, l: "Fasting" },
                { v: false, l: "Not fasting" },
              ].map((o) => (
                <button
                  key={String(o.v)}
                  type="button"
                  className={"fhj-chip" + (fasting === o.v ? " is-active" : "")}
                  onClick={() => setFasting(o.v)}
                >
                  {o.l}
                </button>
              ))}
            </div>

            <div className="fhj-label" id="lab-provider">Lab or provider</div>
            <input className="fhj-input" aria-labelledby="lab-provider" value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="Optional" />

            <div className="fhj-label" id="lab-note">Note</div>
            <input className="fhj-input" aria-labelledby="lab-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
            </div>

            <div className="fhj-sheet-actions">
              <button type="button" className="fhj-btn fhj-btn-ghost" onClick={() => { setTest(null); setCustom(""); }}>
                Back
              </button>
              <button
                type="button"
                className="fhj-btn fhj-btn-primary"
                disabled={!canSave}
                onClick={() =>
                  onSave({
                    test: test ? test.key : `custom:${slug(custom)}`,
                    name: test ? test.label : custom.trim(),
                    value: Number(value),
                    value2: value2.trim() && Number.isFinite(Number(value2)) ? Number(value2) : undefined,
                    unit: unit.trim(),
                    date,
                    refLow: refLow.trim() && Number.isFinite(Number(refLow)) ? Number(refLow) : undefined,
                    refHigh: refHigh.trim() && Number.isFinite(Number(refHigh)) ? Number(refHigh) : undefined,
                    fasting,
                    provider: provider.trim() || undefined,
                    note: note.trim() || undefined,
                  })
                }
              >
                Save result
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "measurement";

function fmtDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** Every date in a period, so tapping it can light the whole stretch up. */
function daysBetweenList(from: string, to: string): string[] {
  const out: string[] = [];
  const [y, m, d] = from.split("-").map(Number);
  const cur = new Date(y, m - 1, d);
  const [ey, em, ed] = to.split("-").map(Number);
  const end = new Date(ey, em - 1, ed);
  const pad = (n: number) => String(n).padStart(2, "0");
  let guard = 0;
  while (cur <= end && guard < 1200) {
    out.push(`${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`);
    cur.setDate(cur.getDate() + 1);
    guard += 1;
  }
  return out;
}

export { LAB_TESTS };
