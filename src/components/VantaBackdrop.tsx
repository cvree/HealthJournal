/* Optional ambient backdrop (Vanta FOG). Deliberately quiet:
   - opt-in via Settings ("Ambient backdrop"), off by default
   - lazy-loads three + vanta only when enabled (keeps initial bundle lean)
   - disabled automatically under prefers-reduced-motion
   - fixed behind the app at low opacity so cards/text stay fully readable */

import React, { useEffect, useRef } from "react";
import { prefersReducedMotion } from "../lib/motion";

export default function VantaBackdrop({ enabled }: { enabled: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const effectRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    if (enabled && !prefersReducedMotion() && ref.current && !effectRef.current) {
      Promise.all([import("three"), import("vanta/dist/vanta.fog.min")]).then(
        ([THREE, VANTA]: any[]) => {
          if (cancelled || !ref.current) return;
          effectRef.current = VANTA.default({
            el: ref.current,
            THREE,
            mouseControls: false,
            touchControls: false,
            gyroControls: false,
            highlightColor: 0xdfe9e2,
            midtoneColor: 0xcfe0d6,
            lowlightColor: 0xf2f4f1,
            baseColor: 0xf2f4f1,
            blurFactor: 0.7,
            speed: 0.6,
            zoom: 0.7,
          });
        },
        () => {} /* load failure -> plain background, no error surfaced */
      );
    }
    if (!enabled && effectRef.current) {
      effectRef.current.destroy();
      effectRef.current = null;
    }
    return () => {
      cancelled = true;
      if (effectRef.current) {
        effectRef.current.destroy();
        effectRef.current = null;
      }
    };
  }, [enabled]);

  if (!enabled || prefersReducedMotion()) return null;
  return (
    <div
      ref={ref}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        opacity: 0.5,
        pointerEvents: "none",
      }}
    />
  );
}
