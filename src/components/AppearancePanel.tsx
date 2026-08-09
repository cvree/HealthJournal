/* The appearance controls, in one place.

   This panel is mounted twice: once as the first-run "make it yours" step, and
   once inside Settings. It is deliberately the *same* component in both, not
   two arrangements of the same four controls — the first-run screen and the
   settings screen drifting apart is how you end up with an option you can only
   reach on day one.

   Every control writes straight through to lib/theme, which repaints the whole
   app synchronously. There is no draft state and no Apply button: the preview
   is the app itself, already wearing the choice. */

import React, { useEffect, useState } from "react";
import {
  BackdropStyle, C, DEFAULT_HUE, ThemePreference, effectiveHue, getBackdrop, getHue,
  getNightLight, getThemePreference, hslToHex, onAppearanceChange, readableInk,
  setBackdrop, setHue, setNightLight, setThemePreference,
} from "../lib/theme";

/** Re-render whenever anything about the appearance changes, including changes
    made by the *other* copy of this panel or by the OS flipping dark/light. */
export function useAppearance(): number {
  const [rev, setRev] = useState(0);
  useEffect(() => onAppearanceChange(setRev), []);
  return rev;
}

const label: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};

/* ---------- backdrop ---------- */

const BACKDROPS: { value: BackdropStyle; name: string; desc: string }[] = [
  { value: "fog", name: "Fog", desc: "Soft drifting clouds" },
  { value: "aurora", name: "Aurora", desc: "Tall raking curtains" },
  { value: "off", name: "None", desc: "A plain, flat surface" },
];

function BackdropChoice({
  option,
  active,
  onPick,
}: {
  option: (typeof BACKDROPS)[number];
  active: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={active}
      className="fhj-backdrop-choice"
      style={{
        borderColor: active ? C.accent : C.line,
        background: C.card,
        boxShadow: active ? C.shadowPop : "none",
      }}
    >
      <span className="fhj-backdrop-choice-preview" style={{ background: C.bg }}>
        {option.value === "off" ? (
          <span className="fhj-backdrop-choice-flat" />
        ) : (
          <span
            className={`fhj-backdrop fhj-backdrop-preview fhj-backdrop-${option.value}`}
            aria-hidden="true"
          >
            <span className="fhj-backdrop-layer" />
            <span className="fhj-backdrop-layer" />
            <span className="fhj-backdrop-layer" />
          </span>
        )}
      </span>
      <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.ink }}>
        {option.name}
      </span>
      <span style={{ display: "block", fontSize: 11, color: C.subtle, lineHeight: 1.35 }}>
        {option.desc}
      </span>
    </button>
  );
}

/* ---------- hue ---------- */

function HueSlider({ hue, night, onChange }: { hue: number; night: boolean; onChange: (h: number) => void }) {
  const shown = effectiveHue(hue, night);
  const swatch = hslToHex(shown, 60, 58);
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span style={{ ...label, color: C.subtle }}>Colour</span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            color: C.subtle,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 14,
              height: 14,
              borderRadius: 999,
              background: swatch,
              border: `1px solid ${C.line}`,
            }}
          />
          {shown}°
        </span>
      </div>
      <input
        className="fhj-hue-slider"
        type="range"
        min={0}
        max={359}
        step={1}
        value={hue}
        aria-label="Accent colour hue"
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ ["--fhj-thumb" as any]: swatch }}
      />
      <p style={{ fontSize: 11.5, lineHeight: 1.5, color: C.subtle, marginTop: 8 }}>
        {night
          ? "Night Light is on, so the slider moves within the warm end of the range — anything colder would put blue light back on the screen."
          : "Sets the accent colour used across buttons, charts and the backdrop. Every position stays contrast-checked, so nothing here can make text hard to read."}
      </p>
    </div>
  );
}

/* ---------- theme + night light ---------- */

const THEMES: { value: ThemePreference; name: string }[] = [
  { value: "dark", name: "Dark" },
  { value: "light", name: "Light" },
  { value: "system", name: "System" },
];

export default function AppearancePanel({ onChoice }: { onChoice?: () => void }) {
  useAppearance();
  const hue = getHue();
  const night = getNightLight();
  const theme = getThemePreference();
  const backdrop = getBackdrop();
  const ping = () => onChoice?.();

  return (
    <div>
      <div style={{ ...label, color: C.subtle, marginBottom: 10 }}>Backdrop</div>
      <div className="fhj-backdrop-choices">
        {BACKDROPS.map((o) => (
          <BackdropChoice
            key={o.value}
            option={o}
            active={backdrop === o.value}
            onPick={() => {
              setBackdrop(o.value);
              ping();
            }}
          />
        ))}
      </div>

      <div style={{ marginTop: 20 }}>
        <HueSlider
          hue={hue}
          night={night}
          onChange={(h) => {
            setHue(h);
          }}
        />
      </div>

      <div style={{ marginTop: 20 }}>
        <div style={{ ...label, color: C.subtle, marginBottom: 8 }}>Theme</div>
        <div className="fhj-seg" role="group" aria-label="Theme">
          {THEMES.map((t) => {
            const active = theme === t.value;
            return (
              <button
                key={t.value}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setThemePreference(t.value);
                  ping();
                }}
                style={{
                  background: active ? C.accent : "transparent",
                  color: active ? C.onAccent : C.sub,
                }}
              >
                {t.name}
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          setNightLight(!night);
          ping();
        }}
        aria-pressed={night}
        className="fhj-night-row"
        style={{ borderColor: night ? C.accentLine : C.line, background: night ? C.accentSoft : "transparent" }}
      >
        <span style={{ minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: C.ink }}>
            Night Light
          </span>
          <span style={{ display: "block", fontSize: 11.5, color: C.subtle, lineHeight: 1.45, marginTop: 2 }}>
            Takes the blue out of every colour on screen — not a tint laid over
            the top, the actual pixels change. Best in the hour before bed.
          </span>
        </span>
        <span
          aria-hidden="true"
          style={{
            width: 46,
            height: 27,
            flexShrink: 0,
            borderRadius: 999,
            padding: 3,
            background: night ? C.accent : C.faint,
            border: `1px solid ${night ? C.accent : C.lineStrong}`,
            transition: "background 140ms",
          }}
        >
          <span
            style={{
              display: "block",
              width: 19,
              height: 19,
              borderRadius: 999,
              background: night ? readableInk(C.accent) : C.sub,
              marginLeft: night ? "auto" : 0,
              transition: "margin 140ms",
            }}
          />
        </span>
      </button>

      {(hue !== DEFAULT_HUE || night || backdrop !== "fog" || theme !== "dark") && (
        <button
          type="button"
          onClick={() => {
            setHue(DEFAULT_HUE);
            setNightLight(false);
            setBackdrop("fog");
            setThemePreference("dark");
            ping();
          }}
          style={{
            marginTop: 14,
            fontSize: 12,
            fontWeight: 600,
            color: C.subtle,
            textDecoration: "underline",
            textUnderlineOffset: 3,
          }}
        >
          Reset to the original look
        </button>
      )}
    </div>
  );
}
