/* Optional ambient backdrop (Vanta FOG). Deliberately quiet:
   - opt-in via Settings ("Ambient backdrop"), off by default
   - lazy-loads three + vanta only when enabled (keeps initial bundle lean)
   - disabled automatically under prefers-reduced-motion
   - fixed behind the app at low opacity so cards/text stay fully readable
   - keyed to the active theme: the fog is built from the same tokens as the
     rest of the app, and torn down and rebuilt when the theme changes, so a
     dark journal never sits on top of a pale green cloud */

import React, { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../lib/motion";
import { C, getTheme, onThemeChange } from "../lib/theme";

/** "#5b63e8" → 0x5b63e8. Vanta wants numbers, the tokens are CSS strings. */
function hexToInt(hex: string, fallback: number): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  return m ? parseInt(m[1], 16) : fallback;
}

export default function VantaBackdrop({ enabled }: { enabled: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const effectRef = useRef<any>(null);
  const [theme, setTheme] = useState(getTheme);

  useEffect(() => onThemeChange(setTheme), []);

  useEffect(() => {
    let cancelled = false;
    const teardown = () => {
      if (effectRef.current) {
        effectRef.current.destroy();
        effectRef.current = null;
      }
    };

    if (enabled && !prefersReducedMotion() && ref.current) {
      teardown(); // rebuild on a theme change rather than tint a stale scene
      Promise.all([import("three"), import("vanta/dist/vanta.fog.min")]).then(
        ([THREE, VANTA]: any[]) => {
          if (cancelled || !ref.current) return;
          effectRef.current = VANTA.default({
            el: ref.current,
            THREE,
            mouseControls: false,
            touchControls: false,
            gyroControls: false,
            highlightColor: hexToInt(C.accent, 0x5b63e8),
            midtoneColor: hexToInt(C.card, 0x171a22),
            lowlightColor: hexToInt(C.bg, 0x0e1015),
            baseColor: hexToInt(C.bg, 0x0e1015),
            blurFactor: 0.7,
            speed: 0.6,
            zoom: 0.7,
          });
        },
        () => {} /* load failure -> plain background, no error surfaced */
      );
    } else {
      teardown();
    }

    return () => {
      cancelled = true;
      teardown();
    };
  }, [enabled, theme]);

  if (!enabled || prefersReducedMotion()) return null;
  return (
    <div
      ref={ref}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        // Lower in dark: an additive-looking fog over a near-black ground
        // washes out card edges much faster than it does over paper.
        opacity: theme === "dark" ? 0.34 : 0.5,
        pointerEvents: "none",
      }}
    />
  );
}
