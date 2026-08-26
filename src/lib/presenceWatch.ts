/* The one impure half of presence detection: the thing that talks to the
   platform.

   Kept in its own file, and kept this small, for two reasons. The first is
   testability — lib/presence is a pile of pure functions precisely because the
   interesting behaviour (hysteresis, backdating, staleness) has to be walkable
   minute by minute in a test, and none of that is possible through a browser
   API. The second is the privacy claim in lib/presence's header. That header
   says no coordinate reaches the presence model, and this is the file where
   that has to be true: `toFix` below is the only place a Position is ever
   touched, and it reads three fields off it and drops the object.

   The watch runs only while a session is running, or while somebody is sitting
   on the sun screen with auto-start switched on. It is never a background
   watch: a web app does not get one, and pretending otherwise would ship a
   feature that silently doesn't work. What the wrapper *does* get is the phone
   waking the page whenever it is foregrounded, which for the common shape of
   this — walk out, pocket, walk back in, look at phone — is enough to place the
   moment of going inside within a few minutes. */

import type { Fix } from "./presence";

export interface WatchHandle {
  stop: () => void;
}

export interface WatchOptions {
  /** Minimum gap between accepted fixes, ms. The platform will happily deliver
      one a second; the model needs one a minute, and the radio is somebody's
      battery. */
  minIntervalMs?: number;
  onFix: (fix: Fix) => void;
  /** Called once if the platform refuses, so the UI can stop promising an
      automation it is not going to get. */
  onUnavailable?: (reason: "unsupported" | "denied" | "error") => void;
}

/** Strip a platform Position down to what the model may see. The coordinates
    are read past deliberately: this function is the boundary. */
function toFix(pos: { timestamp?: number; coords: { accuracy?: number } }, lux: number | null): Fix {
  const accuracy = Number(pos.coords?.accuracy);
  return {
    t: Number(pos.timestamp) || Date.now(),
    accuracy: Number.isFinite(accuracy) ? accuracy : 0,
    lux,
  };
}

/** Start watching. Returns a handle whose `stop` is safe to call twice.

    `enableHighAccuracy` is **on** here, which is the opposite of what
    lib/context does and worth saying why. Context wants a rough place and
    should not wake the GPS for it. This wants the accuracy number itself to
    mean something: with high accuracy off, the platform is free to answer every
    fix from the network cache, and a constant sixty metres indoors and out is
    exactly the reading that makes this feature impossible. The cost is real
    battery, which is why the watch exists only while a session does. */
export function watchPresence(opts: WatchOptions): WatchHandle {
  const minGap = opts.minIntervalMs ?? 45_000;
  let stopped = false;
  let lastAt = 0;
  let watchId: number | null = null;
  let lux: number | null = null;
  let lightSensor: { stop?: () => void } | null = null;

  if (typeof navigator === "undefined" || !navigator.geolocation) {
    opts.onUnavailable?.("unsupported");
    return { stop: () => {} };
  }

  /* An ambient light sensor, if this device has one and has been granted it.
     Almost nothing outside Chrome on Android will, so the whole block is
     best-effort and its absence changes nothing — lib/presence only ever uses
     lux to rule *out* a roof. */
  try {
    const Ctor = (globalThis as any).AmbientLightSensor;
    if (typeof Ctor === "function") {
      const sensor = new Ctor({ frequency: 0.2 });
      sensor.addEventListener?.("reading", () => {
        const v = Number(sensor.illuminance);
        if (Number.isFinite(v)) lux = v;
      });
      sensor.addEventListener?.("error", () => { lux = null; });
      sensor.start?.();
      lightSensor = { stop: () => sensor.stop?.() };
    }
  } catch {
    lux = null;
  }

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      if (stopped) return;
      const now = Date.now();
      if (now - lastAt < minGap) return;
      lastAt = now;
      opts.onFix(toFix(pos as any, lux));
    },
    (err) => {
      if (stopped) return;
      /* A refusal is permanent for this page and worth reporting once. A
         timeout is not — the sky comes back — so it is swallowed, and staleness
         in the model handles the case where it doesn't. */
      if ((err as any)?.code === 1) opts.onUnavailable?.("denied");
    },
    { enableHighAccuracy: true, timeout: 30_000, maximumAge: 30_000 }
  );

  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      if (watchId != null) {
        try { navigator.geolocation.clearWatch(watchId); } catch { /* already gone */ }
      }
      try { lightSensor?.stop?.(); } catch { /* never mind */ }
    },
  };
}
