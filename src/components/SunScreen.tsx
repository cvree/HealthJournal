/* Sun & Outdoor Light.

   Two states, one screen.

   **Idle** answers the question somebody opens this screen with — *is it worth
   going out, and when?* — with today's actual solar arc, the window where
   there is UVB to be had, and one enormous button.

   **Live** is the session. One tap gets here and one tap leaves. Everything on
   it is a number that is genuinely changing: the clock, the sun's height, the
   UV, the accumulated dose, the estimate. The estimate is drawn as a range in
   the app's ordinary ink; the burn scale beside it is the only thing allowed
   to change colour, because it is the only thing on the screen that can go
   wrong.

   The rule that shaped the layout: nothing here may cost a tap. Starting a
   session does not ask what you are wearing — it uses what you told it once,
   in Settings, and the finish sheet is where a correction is cheap because the
   session is already recorded. */

import React, { useEffect, useMemo, useRef, useState } from "react";
import SolarArc from "./SolarArc";
import {
  EXPOSURE_LEVELS, SHADE_LABELS, clockLabel, dayLight, durationLabel,
  morningLightWindow, nextVitaminDWindow, stopwatchLabel, uvBand,
  UV_BAND_LABEL, vitaminDRangeLabel, vitaminDWindow,
  type Coords, type ExposureLevel, type ShadeLevel, type SkinType,
} from "../lib/solar";
import {
  autoEndArmed, autoEndStatus, burnState, confirmPrompt, endNote, firstLightAfterWaking, readout,
  sessionSummary, sunDay, sunTotals, unconfirmed,
  type LiveSession, type SunSession,
} from "../lib/sun";
import { presenceLine } from "../lib/presence";
import { automationDecided, automationOn, type AutomationSettings } from "../lib/automation";

type Props = {
  coords: Coords | null;
  /** Today, YYYY-MM-DD, from the app's own clock helper. */
  today: string;
  sessions: SunSession[];
  skin?: SkinType;
  exposure?: ExposureLevel;
  wake?: string;
  age?: number;
  /** Forecast UV for right now, when daily context has one. */
  forecastUV?: number | null;
  cloudCover?: number;
  viewer?: boolean;
  /** The running session, owned by App so it survives leaving this screen. */
  live?: LiveSession | null;
  onStart?: () => void;
  onFinish?: (opts: FinishPatch) => void;
  onDiscard?: () => void;
  onAdjust?: (patch: Partial<LiveSession>) => void;
  /** Which automations are on, and the one door for changing that. */
  automations?: AutomationSettings;
  onDecideAutomation?: (id: "sun-auto-end", on: boolean) => void;
  /** Answering an end time the app guessed. */
  onConfirm?: (id: string) => void;
  onRevise?: (id: string, end: Date) => void;
  onDelete?: (id: string) => void;
  onOpenSettings?: () => void;
  onFeedback?: (kind: string) => void;
  /** Dates lit up by an insight elsewhere in the app. */
  highlight?: Set<string>;
};

type FinishPatch = { note?: string; exposure?: ExposureLevel; shade?: ShadeLevel; spf?: number };

export default function SunScreen({
  coords, today, sessions, skin, exposure = "arms", wake, age, forecastUV, cloudCover,
  viewer = false, live = null, onStart, onFinish, onDiscard, onAdjust,
  automations, onDecideAutomation, onConfirm, onRevise,
  onDelete, onOpenSettings, onFeedback, highlight,
}: Props) {
  const [now, setNow] = useState(() => new Date());
  const [finishing, setFinishing] = useState(false);

  /* This screen no longer owns the session — App does, because the session has
     to keep running when nobody is looking at it. What is left here is the
     display clock: one tick a second, because a stopwatch that jumps in
     fifteen-second steps looks broken. The sampling and the auto-end live
     upstairs with the session. */
  useEffect(() => {
    if (!live) return;
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, [!!live]);

  /* Off a session the clock still moves, so the arc's sun sits where the sun
     sits — but once a minute is plenty. */
  useEffect(() => {
    if (live) return;
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, [!!live]);

  const day = useMemo(() => dateFrom(today), [today]);
  const light = useMemo(() => (coords ? dayLight(day, coords) : null), [coords, day]);
  const dWindow = useMemo(() => (coords ? vitaminDWindow(day, coords) : null), [coords, day]);
  const morning = useMemo(() => (coords ? morningLightWindow(day, coords) : null), [coords, day]);
  const nextWindow = useMemo(() => (coords ? nextVitaminDWindow(now, coords) : null), [coords, now]);
  const todayTotals = useMemo(() => sunDay(sessions, today), [sessions, today]);

  const start = () => {
    if (viewer) return;
    setNow(new Date());
    onStart?.();
  };

  const finish = (opts: FinishPatch) => {
    if (!live) return;
    setFinishing(false);
    onFinish?.(opts);
  };

  /* Sessions the app ended by itself and nobody has looked at yet. Newest
     first, and only the newest is offered — a queue of five questions is a
     chore, and the one that just happened is the only one anybody remembers
     well enough to correct. */
  const waiting = useMemo(() => unconfirmed(sessions), [sessions]);

  if (live) {
    return (
      <LiveSessionView
        live={live}
        now={now}
        coords={coords}
        day={day}
        skin={skin}
        finishing={finishing}
        canAutoEnd={!!coords}
        autoEndDecided={automationDecided(automations, "sun-auto-end")}
        autoEndOn={automationOn(automations, "sun-auto-end")}
        onDecideAutoEnd={(on) => onDecideAutomation?.("sun-auto-end", on)}
        onOpenFinish={() => setFinishing(true)}
        onCancelFinish={() => setFinishing(false)}
        onFinish={finish}
        onDiscard={() => {
          setFinishing(false);
          onDiscard?.();
        }}
        onAdjust={(patch) => onAdjust?.(patch)}
      />
    );
  }

  return (
    <div className="fhj-sun">
      {!viewer && waiting.length > 0 && (
        <ConfirmCard
          session={waiting[0]}
          more={waiting.length - 1}
          onConfirm={() => onConfirm?.(waiting[0].id)}
          onRevise={(end) => onRevise?.(waiting[0].id, end)}
          onDelete={onDelete ? () => onDelete(waiting[0].id) : undefined}
        />
      )}

      <section className="fhj-card fhj-sun-today">
        <div className="fhj-eyebrow">Today's sun</div>
        <SolarArc coords={coords} day={day} now={now} height={132} cloudCover={cloudCover} />

        {light && (
          <div className="fhj-sun-facts">
            <Fact label="Daylight" value={light.polar
              ? light.daylightMinutes ? "All day" : "None"
              : durationLabel(light.daylightMinutes)} />
            <Fact label="Sun up" value={clockLabel(light.sunrise)} />
            <Fact label="Sun down" value={clockLabel(light.sunset)} />
            <Fact
              label="Vitamin D window"
              value={dWindow ? `${clockLabel(dWindow.start)}–${clockLabel(dWindow.end)}` : "None today"}
              sub={dWindow ? `Sun above 30°` : "The sun stays too low"}
            />
          </div>
        )}

        {!coords && (
          <p className="fhj-note" style={{ marginTop: 10 }}>
            The sun's position needs a rough idea of where you are.{" "}
            {onOpenSettings && (
              <button type="button" className="fhj-linkish" onClick={onOpenSettings}>
                Turn on daily context
              </button>
            )}
          </p>
        )}

        {!viewer && (
          <button type="button" className="fhj-btn fhj-btn-primary fhj-btn-block fhj-sun-start fhj-pop-lg" onClick={start}>
            <SunMark />
            Start sun session
          </button>
        )}
      </section>

      {todayTotals.sessions > 0 && (
        <section className="fhj-card">
          <div className="fhj-eyebrow">Outside today</div>
          <div className="fhj-sun-total">
            <span className="fhj-sun-total-num">{durationLabel(todayTotals.minutes)}</span>
            <span className="fhj-sun-total-sub">
              across {todayTotals.sessions} {todayTotals.sessions === 1 ? "session" : "sessions"}
            </span>
          </div>
          {todayTotals.iuHigh >= 100 && (
            <EstimateBlock low={todayTotals.iuLow} high={todayTotals.iuHigh} />
          )}
          {wake && firstLightAfterWaking(todayTotals, wake) != null && (
            <p className="fhj-sun-first">
              First light {durationLabel(firstLightAfterWaking(todayTotals, wake)!)} after you usually wake.
            </p>
          )}
          <ul className="fhj-sun-list">
            {sessions
              .filter((s) => s.date === today)
              .map((s) => (
                <li key={s.id}>
                  <div>
                    <div className="fhj-sun-list-time">
                      {new Date(s.start).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    </div>
                    <div className="fhj-sun-list-meta">{sessionSummary(s)}</div>
                    {endNote(s) && <div className="fhj-sun-list-est">{endNote(s)}</div>}
                  </div>
                  {onDelete && !viewer && (
                    <button type="button" className="fhj-icon-btn fhj-icon-btn-sm" aria-label="Delete this session" onClick={() => onDelete(s.id)}>
                      ×
                    </button>
                  )}
                </li>
              ))}
          </ul>
        </section>
      )}

      <WindowsCard now={now} next={nextWindow} morning={morning} coords={coords} />
      <HistoryCard sessions={sessions} today={today} highlight={highlight} />
    </div>
  );
}

/* ---------- the live session ---------- */

function LiveSessionView({
  live, now, coords, day, skin, finishing, canAutoEnd, autoEndDecided, autoEndOn,
  onDecideAutoEnd, onOpenFinish, onCancelFinish, onFinish, onDiscard, onAdjust,
}: {
  live: LiveSession;
  now: Date;
  coords: Coords | null;
  day: Date;
  skin?: SkinType;
  finishing: boolean;
  canAutoEnd: boolean;
  autoEndDecided: boolean;
  autoEndOn: boolean;
  onDecideAutoEnd: (on: boolean) => void;
  onOpenFinish: () => void;
  onCancelFinish: () => void;
  onFinish: (opts: { note?: string; exposure?: ExposureLevel; shade?: ShadeLevel; spf?: number }) => void;
  onDiscard: () => void;
  onAdjust: (patch: Partial<LiveSession>) => void;
}) {
  const r = readout(live, now);
  const burn = burnState(r.medFraction, r.burnMinutesLeft);
  const band = uvBand(r.uv);
  const started = new Date(live.startedAt);

  return (
    <div className="fhj-sun-live" data-burn={burn.level}>
      <div className="fhj-sun-live-sky" aria-hidden />

      <SolarArc coords={coords} day={day} now={now} span={[started, now]} variant="hero" height={190} cloudCover={live.cloudCover} />

      <div className="fhj-sun-clock" role="timer" aria-live="off">
        {stopwatchLabel(r.elapsedMs)}
      </div>
      <div className="fhj-sun-clock-sub">
        Outside since {started.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
      </div>

      <div className="fhj-sun-live-grid">
        <LiveStat
          label="UV index"
          value={r.uvSource === "none" ? "—" : String(r.uv)}
          sub={r.uvSource === "none" ? "No location" : `${UV_BAND_LABEL[band]}${r.uvSource === "modelled" ? " · modelled" : ""}`}
        />
        <LiveStat label="Sun height" value={`${Math.round(r.elevation)}°`} sub={compass(r.azimuth)} />
        <LiveStat label="Outdoor light" value={`${r.minutes}`} sub="minutes" />
        <LiveStat label="Ambient UV dose" value={r.sed.toFixed(2)} sub="SED" />
      </div>

      <div className="fhj-sun-estimate">
        <div className="fhj-eyebrow">Estimated vitamin D</div>
        <div className="fhj-sun-iu">{vitaminDRangeLabel(r.estimate)}</div>
        <div className="fhj-sun-iu-note">Research-model estimate · not a measurement</div>
        {r.estimate.belowThreshold && (
          <p className="fhj-sun-below">
            The sun is too low for much UVB right now. This is still daylight, and still worth having — it just
            isn't a vitamin D session.
          </p>
        )}
      </div>

      {/* The one thing on this screen allowed to change colour. */}
      <div className="fhj-sun-burn" data-level={burn.level}>
        <div className="fhj-sun-burn-bar">
          <span style={{ transform: `scaleX(${Math.min(1, burn.fraction)})` }} />
        </div>
        <div className="fhj-sun-burn-text">
          <strong>{burn.headline}</strong>
          <span>{burn.detail}</span>
        </div>
      </div>

      <AutoEndStrip
        live={live}
        now={now}
        canAutoEnd={canAutoEnd}
        decided={autoEndDecided}
        on={autoEndOn}
        onDecide={onDecideAutoEnd}
      />

      <div className="fhj-sun-live-actions">
        <button type="button" className="fhj-btn fhj-btn-primary fhj-btn-block fhj-pop-lg" onClick={onOpenFinish}>
          Finish
        </button>
        <button type="button" className="fhj-btn fhj-btn-ghost fhj-btn-block" onClick={onDiscard}>
          Discard
        </button>
      </div>

      {finishing && (
        <FinishSheet
          minutes={r.minutes}
          estimateLabel={vitaminDRangeLabel(r.estimate)}
          initialExposure={live.exposure}
          initialShade={live.shade}
          initialSpf={live.spf}
          skin={skin}
          onAdjust={onAdjust}
          onCancel={onCancelFinish}
          onSave={onFinish}
        />
      )}
    </div>
  );
}

function LiveStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="fhj-sun-stat">
      <div className="fhj-eyebrow">{label}</div>
      <div className="fhj-sun-stat-val">{value}</div>
      {sub && <div className="fhj-sun-stat-sub">{sub}</div>}
    </div>
  );
}

/* ---------- finishing ---------- */

function FinishSheet({
  minutes, estimateLabel, initialExposure, initialShade, initialSpf, skin, onAdjust, onCancel, onSave,
}: {
  minutes: number;
  estimateLabel: string;
  initialExposure: ExposureLevel;
  initialShade: ShadeLevel;
  initialSpf?: number;
  skin?: SkinType;
  onAdjust: (patch: Partial<LiveSession>) => void;
  onCancel: () => void;
  onSave: (opts: { note?: string; exposure?: ExposureLevel; shade?: ShadeLevel; spf?: number }) => void;
}) {
  const [exposure, setExposure] = useState<ExposureLevel>(initialExposure);
  const [shade, setShade] = useState<ShadeLevel>(initialShade);
  const [spf, setSpf] = useState<number | undefined>(initialSpf);
  const [note, setNote] = useState("");

  /* Adjusting here changes the live session too, so the estimate above the
     sheet moves as the answer changes — the correction is visibly worth
     making rather than a form to fill in. */
  const adjust = (patch: Partial<LiveSession>) => {
    onAdjust(patch);
    if (patch.exposure) setExposure(patch.exposure);
    if (patch.shade) setShade(patch.shade);
    if ("spf" in patch) setSpf(patch.spf);
  };

  return (
    <div className="fhj-scrim" role="dialog" aria-modal="true" aria-label="Finish sun session">
      <div className="fhj-sheet fhj-sun-finish">
        <div className="fhj-sheet-grab" aria-hidden />
        <div className="fhj-sheet-head">
          <div>
            <h2 className="fhj-page-title" style={{ fontSize: 22, marginBottom: 2 }}>
              {durationLabel(minutes)} outside
            </h2>
            <p className="fhj-sun-finish-est">{estimateLabel} estimated</p>
          </div>
        </div>
        <div className="fhj-sheet-body">
        <div className="fhj-label">What was in the sun?</div>
        <div className="fhj-chip-row">
          {EXPOSURE_LEVELS.map((e) => (
            <button
              key={e.id}
              type="button"
              className={"fhj-chip" + (exposure === e.id ? " is-active" : "")}
              onClick={() => adjust({ exposure: e.id })}
            >
              {e.label}
            </button>
          ))}
        </div>

        <div className="fhj-label">Shade</div>
        <div className="fhj-chip-row">
          {(Object.keys(SHADE_LABELS) as ShadeLevel[]).map((s) => (
            <button
              key={s}
              type="button"
              className={"fhj-chip" + (shade === s ? " is-active" : "")}
              onClick={() => adjust({ shade: s })}
            >
              {SHADE_LABELS[s]}
            </button>
          ))}
        </div>

        <div className="fhj-label">Sunscreen</div>
        <div className="fhj-chip-row">
          {[undefined, 15, 30, 50].map((v) => (
            <button
              key={String(v)}
              type="button"
              className={"fhj-chip" + (spf === v ? " is-active" : "")}
              onClick={() => adjust({ spf: v })}
            >
              {v ? `SPF ${v}` : "None"}
            </button>
          ))}
        </div>

        <div className="fhj-label" id="sun-note-label">Note</div>
        <input
          className="fhj-input"
          aria-labelledby="sun-note-label"
          placeholder="Lunch in the park"
          value={note}
          maxLength={200}
          onChange={(e) => setNote(e.target.value)}
        />

        {skin === undefined && (
          <p className="fhj-note" style={{ marginTop: 10 }}>
            The estimate uses a middle skin type until you set yours. It changes the answer more than anything else here.
          </p>
        )}
        </div>

        <div className="fhj-sheet-actions">
          <button type="button" className="fhj-btn fhj-btn-ghost" onClick={onCancel}>
            Keep going
          </button>
          <button
            type="button"
            className="fhj-btn fhj-btn-primary"
            onClick={() => onSave({ note: note.trim() || undefined, exposure, shade, spf })}
          >
            Save session
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- the automation, said out loud ----------

   Three states, and the app is in exactly one of them at any moment:

   · **Never asked.** One offer, here, the first time somebody runs a session on
     a device that could actually do it. Not in a settings screen they will
     never open — here, while they are standing outside holding the phone, which
     is the only moment the feature is self-explanatory.
   · **On.** A line saying what it currently thinks, updated as it thinks it.
     This is not decoration. An automation whose reasoning is invisible is one
     that feels like a malfunction the first time it is wrong, and this one will
     sometimes be wrong.
   · **On, but blind.** Position has dried up. Say so, plainly, while there is
     still time to do something about it — a promise quietly not being kept is
     the worst of the three. */

function AutoEndStrip({
  live, now, canAutoEnd, decided, on, onDecide,
}: {
  live: LiveSession;
  now: Date;
  canAutoEnd: boolean;
  decided: boolean;
  on: boolean;
  onDecide: (on: boolean) => void;
}) {
  if (!canAutoEnd) return null;

  if (!decided) {
    return (
      <div className="fhj-sun-auto fhj-sun-auto-offer">
        <div className="fhj-sun-auto-text">
          <strong>End this by itself when you head in?</strong>
          <span>
            Your phone can tell roughly when it stops seeing open sky, and close the session at
            that time rather than whenever you remember. It reads how accurate its own position
            is — not where you are — and asks you to confirm the time afterwards.
          </span>
        </div>
        <div className="fhj-sun-auto-actions">
          <button type="button" className="fhj-btn fhj-btn-ghost fhj-btn-sm" onClick={() => onDecide(false)}>
            No, I'll finish it
          </button>
          <button type="button" className="fhj-btn fhj-btn-primary fhj-btn-sm" onClick={() => onDecide(true)}>
            Yes, do that
          </button>
        </div>
      </div>
    );
  }

  if (!on || !live.autoEnd) return null;

  const status = autoEndStatus(live, now);
  const armed = status === "armed";
  const line =
    status === "blocked"
      ? "Your phone isn't giving this app a position, so you'll need to finish this one yourself."
      : status === "waiting"
        ? "Waiting for a first fix."
        : live.presence
          ? presenceLine(live.presence, now.getTime())
          : "Waiting for a first fix.";

  return (
    <div className="fhj-sun-auto" data-armed={armed ? "true" : "false"}>
      <div className="fhj-sun-auto-text">
        <strong>
          {armed
            ? "Ending itself when you head in"
            : status === "blocked"
              ? "Can't watch for that on this device"
              : "Watching, but not getting a position"}
        </strong>
        <span>{line}</span>
      </div>
      <button type="button" className="fhj-btn fhj-btn-ghost fhj-btn-sm" onClick={() => onDecide(false)}>
        Turn off
      </button>
    </div>
  );
}

/* ---------- confirming an end the app chose ----------

   The whole cost of the automation, in one card, and it is deliberately a card
   rather than a modal: it does not block anything, it does not come back a
   second time louder, and scrolling past it is a legitimate way to use this
   app forever. The session underneath it is already saved and already counted.

   The correction is a slider over minutes rather than a time picker, because
   the question a person can actually answer is "was it more like forty" and not
   "was it 3:47 or 3:52". */

function ConfirmCard({
  session, more, onConfirm, onRevise, onDelete,
}: {
  session: SunSession;
  more: number;
  onConfirm: () => void;
  onRevise: (end: Date) => void;
  onDelete?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [minutes, setMinutes] = useState(session.minutes);

  /* A new session arriving while this card is open must not leave the slider
     holding the previous one's duration. */
  useEffect(() => {
    setMinutes(session.minutes);
    setEditing(false);
  }, [session.id, session.minutes]);

  const start = new Date(session.start);
  const proposed = new Date(start.getTime() + minutes * 60000);
  const ceiling = Math.max(session.minutes * 2, session.minutes + 60);

  return (
    <section className="fhj-card fhj-sun-confirm">
      <div className="fhj-eyebrow">One thing to check</div>
      <p className="fhj-sun-confirm-q">{confirmPrompt(session)}</p>

      {editing ? (
        <div className="fhj-sun-confirm-edit">
          <div className="fhj-sun-confirm-read">
            <strong>{durationLabel(minutes)}</strong>
            <span>
              {start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} –{" "}
              {proposed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </span>
          </div>
          <input
            className="fhj-range"
            type="range"
            min={1}
            max={ceiling}
            step={1}
            value={minutes}
            aria-label="How long you were outside, in minutes"
            onChange={(e) => setMinutes(Number(e.target.value))}
          />
          <p className="fhj-note">
            Everything else moves with it — the UV dose and the vitamin D range are worked out
            again over the shorter or longer window, not just relabelled.
          </p>
          <div className="fhj-sun-confirm-actions">
            <button type="button" className="fhj-btn fhj-btn-ghost fhj-btn-sm" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="fhj-btn fhj-btn-primary fhj-btn-sm"
              onClick={() => onRevise(proposed)}
            >
              Save {durationLabel(minutes)}
            </button>
          </div>
        </div>
      ) : (
        <div className="fhj-sun-confirm-actions">
          {onDelete && (
            <button type="button" className="fhj-btn fhj-btn-ghost fhj-btn-sm" onClick={onDelete}>
              Wasn't outside
            </button>
          )}
          <button type="button" className="fhj-btn fhj-btn-ghost fhj-btn-sm" onClick={() => setEditing(true)}>
            Change the time
          </button>
          <button type="button" className="fhj-btn fhj-btn-primary fhj-btn-sm" onClick={onConfirm}>
            That's right
          </button>
        </div>
      )}

      {more > 0 && (
        <p className="fhj-note" style={{ marginTop: 10 }}>
          {more} more {more === 1 ? "session is" : "sessions are"} waiting on the same question. They
          are saved either way — the label is the only thing an answer changes.
        </p>
      )}
    </section>
  );
}

/* ---------- the cards under it ---------- */

function WindowsCard({
  now, next, morning, coords,
}: {
  now: Date;
  next: ReturnType<typeof nextVitaminDWindow>;
  morning: ReturnType<typeof morningLightWindow>;
  coords: Coords | null;
}) {
  if (!coords) return null;
  return (
    <section className="fhj-card">
      <div className="fhj-eyebrow">Windows</div>
      <ul className="fhj-sun-windows">
        {morning && (
          <li>
            <span className="fhj-sun-win-when">
              {clockLabel(morning.start)} – {clockLabel(morning.end)}
            </span>
            <span className="fhj-sun-win-what">
              <strong>Morning light</strong>
              <em>Low sun and almost no UVB — this one is about the body clock, not vitamin D.</em>
            </span>
          </li>
        )}
        <li>
          <span className="fhj-sun-win-when">
            {next ? `${clockLabel(next.start)} – ${clockLabel(next.end)}` : "—"}
          </span>
          <span className="fhj-sun-win-what">
            <strong>Next vitamin-D window</strong>
            <em>
              {next
                ? next.start.toDateString() === now.toDateString()
                  ? `${durationLabel(next.minutes)} left today, peaking around UV ${Math.round(next.peakUV)}.`
                  : `${next.start.toLocaleDateString(undefined, { weekday: "long" })}, ${durationLabel(next.minutes)} of it.`
                : "None in the next week — the sun does not get high enough where you are at this time of year."}
            </em>
          </span>
        </li>
      </ul>
    </section>
  );
}

function HistoryCard({ sessions, today, highlight }: { sessions: SunSession[]; today: string; highlight?: Set<string> }) {
  const days = useMemo(() => lastNDays(today, 30), [today]);
  const totals = useMemo(() => sunTotals(sessions, days), [sessions, days]);
  if (!sessions.length) return null;
  const max = Math.max(30, ...days.map((d) => sunDay(sessions, d).minutes));

  return (
    <section className="fhj-card">
      <div className="fhj-eyebrow">Last 30 days</div>
      <div className="fhj-sun-hist" role="img" aria-label={`${totals.minutes} minutes outside across ${totals.days} days in the last 30.`}>
        {days.map((d) => {
          const day = sunDay(sessions, d);
          const h = day.minutes ? Math.max(4, (day.minutes / max) * 100) : 0;
          return (
            <span
              key={d}
              className={"fhj-sun-hist-bar" + (highlight?.has(d) ? " is-lit" : "")}
              style={{ height: `${h}%` }}
              data-empty={day.minutes ? undefined : "true"}
              title={`${d}: ${day.minutes ? durationLabel(day.minutes) : "nothing recorded"}`}
            />
          );
        })}
      </div>
      <div className="fhj-sun-hist-legend">
        <span>{durationLabel(totals.minutes)} outside</span>
        <span>{totals.days} of 30 days</span>
        {totals.iuHigh >= 100 && (
          <span>
            ~{totals.iuLow.toLocaleString("en-US")}–{totals.iuHigh.toLocaleString("en-US")} IU estimated
          </span>
        )}
      </div>
    </section>
  );
}

function EstimateBlock({ low, high }: { low: number; high: number }) {
  return (
    <div className="fhj-sun-est-block">
      <div className="fhj-eyebrow">Estimated vitamin D</div>
      <div className="fhj-sun-iu-sm">
        ~{low.toLocaleString("en-US")}–{high.toLocaleString("en-US")} IU
      </div>
      <div className="fhj-sun-iu-note">Research-model estimate · not a measurement</div>
    </div>
  );
}

function Fact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="fhj-sun-fact">
      <div className="fhj-eyebrow">{label}</div>
      <div className="fhj-sun-fact-val">{value}</div>
      {sub && <div className="fhj-sun-fact-sub">{sub}</div>}
    </div>
  );
}

function SunMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="4.2" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <line
          key={a}
          x1={12 + Math.cos((a * Math.PI) / 180) * 7}
          y1={12 + Math.sin((a * Math.PI) / 180) * 7}
          x2={12 + Math.cos((a * Math.PI) / 180) * 9.2}
          y2={12 + Math.sin((a * Math.PI) / 180) * 9.2}
        />
      ))}
    </svg>
  );
}

/* ---------- helpers ---------- */

function dateFrom(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

function lastNDays(today: string, n: number): string[] {
  const [y, m, d] = today.split("-").map(Number);
  const out: string[] = [];
  const pad = (x: number) => String(x).padStart(2, "0");
  for (let i = n - 1; i >= 0; i -= 1) {
    const dt = new Date(y, m - 1, d - i);
    out.push(`${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`);
  }
  return out;
}

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const compass = (az: number): string => COMPASS[Math.round(((az % 360) / 45)) % 8];
