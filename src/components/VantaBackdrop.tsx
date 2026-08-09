/* Ambient backdrop (Vanta FOG). On by default, and deliberately quiet:
   - on for new installs, one switch in Settings, remembered per device
   - lazy-loads three + vanta *after* first paint, at idle, so a WebGL scene
     never competes with the app booting or with the first tap of a log
   - stands down on its own under prefers-reduced-motion, on a low-memory or
     low-core device, and while the tab is in the background
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

/* A full-screen shader on a two-core phone with 2GB of RAM costs more than the
   atmosphere is worth. Both hints are advisory and widely absent, so the test
   only rejects devices that positively report being small. */
function deviceCanAfford(): boolean {
  if (typeof navigator === "undefined") return false;
  const mem = (navigator as any).deviceMemory;
  if (typeof mem === "number" && mem > 0 && mem < 4) return false;
  const cores = navigator.hardwareConcurrency;
  if (typeof cores === "number" && cores > 0 && cores < 4) return false;
  return true;
}

/** Wait for the browser to be genuinely idle, falling back to a plain timeout
    where requestIdleCallback isn't implemented (Safari, at time of writing). */
function whenIdle(fn: () => void): () => void {
  const ric = (window as any).requestIdleCallback;
  if (typeof ric === "function") {
    const id = ric(fn, { timeout: 2500 });
    return () => (window as any).cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(fn, 1200);
  return () => window.clearTimeout(id);
}

export default function VantaBackdrop({ enabled }: { enabled: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const effectRef = useRef<any>(null);
  const [theme, setTheme] = useState(getTheme);
  /* Reduced-motion is a live preference, not a boot-time constant: someone
     turning it on in the OS should see the fog stop without reloading. */
  const [reduced, setReduced] = useState(prefersReducedMotion);
  const [visible, setVisible] = useState(true);

  useEffect(() => onThemeChange(setTheme), []);

  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  /* Backgrounding the tab already stops rAF, but Vanta keeps a WebGL context
     and its buffers alive. Dropping the scene entirely gives the GPU memory
     back while the app isn't on screen. */
  useEffect(() => {
    const onVis = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const active = enabled && !reduced && visible && deviceCanAfford();

  useEffect(() => {
    let cancelled = false;
    const teardown = () => {
      if (effectRef.current) {
        effectRef.current.destroy();
        effectRef.current = null;
      }
    };

    if (!active || !ref.current) {
      teardown();
      return;
    }

    teardown(); // rebuild on a theme change rather than tint a stale scene
    const cancelIdle = whenIdle(() => {
      if (cancelled) return;
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
    });

    return () => {
      cancelled = true;
      cancelIdle();
      teardown();
    };
  }, [active, theme]);

  if (!active) return null;
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
