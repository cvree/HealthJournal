/* Ambient backdrop — the soft moving field behind the app.

   This replaces a Vanta/three.js WebGL scene, which had three problems that
   between them meant most people never saw a backdrop at all:

   1. It needed a working WebGL context. Software rendering disabled, iOS
      Lockdown Mode, a lost context after a tab sleep, a driver blocklist — any
      of those and the scene silently never appeared.
   2. It stood itself down on any device reporting fewer than 4 cores or less
      than 4GB of RAM. That is not an exotic phone, that is a normal one, and
      the feature was off on exactly the hardware most likely to be running it.
   3. It cost ~613KB of three.js in the bundle to draw what is, visually, a few
      blurred gradients.

   So it is CSS now. It runs on the compositor, it works everywhere a gradient
   works, it costs nothing to download, and it re-tints live from --fhj-hue as
   the hue slider moves — the colour is read from custom properties rather than
   passed through React, so a drag repaints on the same frame as the rest of
   the app instead of one render behind it.

   Everything visible lives in index.css under "ambient backdrop"; this file
   only decides whether to mount and which class to hang on the element. */

import React, { useEffect, useState } from "react";
import { prefersReducedMotion } from "../lib/motion";
import { BackdropStyle, getBackdrop, onAppearanceChange } from "../lib/theme";

export default function AmbientBackdrop() {
  const [style, setStyle] = useState<BackdropStyle>(getBackdrop);
  /* Reduced motion is a live preference, not a boot-time constant: turning it
     on in the OS should still the backdrop without a reload. The field stays
     on screen, it just stops moving — a still gradient is the atmosphere
     without the vestibular cost, which is what the setting is asking for. */
  const [reduced, setReduced] = useState(prefersReducedMotion);

  useEffect(() => onAppearanceChange(() => setStyle(getBackdrop())), []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  if (style === "off") return null;

  return (
    <div
      className={`fhj-backdrop fhj-backdrop-${style}${reduced ? " fhj-backdrop-still" : ""}`}
      aria-hidden="true"
    >
      <span className="fhj-backdrop-layer" />
      <span className="fhj-backdrop-layer" />
      <span className="fhj-backdrop-layer" />
    </div>
  );
}
