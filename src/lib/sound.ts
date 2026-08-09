/* The Health Journal voice.

   The old feedback layer was six sine beeps at fixed pitches — the sound of a
   microwave, on a screen where someone is recording how much pain they were in
   today. This is a deliberate replacement: a small instrument, synthesised on
   the fly, that sounds like the app looks. Soft clinical with a neobrutalist
   edge — warm wood and felt, with one clean edge on it.

   The rules it is built to:

   - **Quiet.** Master sits around -24 dBFS. It should be pleasant at the
     volume someone already has their phone at, and inaudible to the room.
   - **Short.** Taps are under 90ms. Nothing but the completion moment runs
     past a third of a second.
   - **Warm.** Triangle and sine partials, a lowpass around 2.6kHz so nothing
     ever gets glassy, and a tiny amount of filtered noise on tactile sounds so
     a tap reads as a finger on a surface and not as a tone generator.
   - **Never the same twice.** Every voice detunes by a few cents, and the
     tactile sounds walk a pentatonic scale in a shuffled order rather than
     repeating one pitch. Twenty taps in a row should feel like an instrument
     being played, not like a notification firing twenty times.
   - **Only on intent.** Nothing here is wired to scroll, hover, or focus. The
     app calls it on taps, saves, and completions.

   Everything is one shared AudioContext, created lazily on the first real
   gesture (iOS will not let us do otherwise) and left suspended until then.
   Every node is one-shot and disconnects itself on `ended`, so a long logging
   session doesn't accumulate a graph. */

type Ctx = AudioContext & { fhjMaster?: GainNode };

let ctx: Ctx | null = null;
let master: GainNode | null = null;
let enabled = false;
let volume = 1;

/** dBFS-ish master trim. Deliberately low; the app is used in bed and at work. */
const MASTER_GAIN = 0.16;

const now = () => (ctx ? ctx.currentTime : 0);
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
/** cents -> ratio. Used everywhere, so nothing lands on the same exact pitch. */
const cents = (c: number) => Math.pow(2, c / 1200);

function ensureContext(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (!ctx) {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return false;
      ctx = new AC() as Ctx;

      // master -> soft limiter -> lowpass -> out.
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 24;
      comp.ratio.value = 6;
      comp.attack.value = 0.003;
      comp.release.value = 0.18;

      const tone = ctx.createBiquadFilter();
      tone.type = "lowpass";
      tone.frequency.value = 2600;
      tone.Q.value = 0.6;

      master = ctx.createGain();
      master.gain.value = MASTER_GAIN;
      master.connect(comp);
      comp.connect(tone);
      tone.connect(ctx.destination);
      ctx.fhjMaster = master;
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx.state !== "closed";
  } catch {
    ctx = null;
    master = null;
    return false;
  }
}

/* ---------- voices ----------

   `blip` is the whole instrument: one oscillator, one envelope, one optional
   bandpass. Every named sound below is a couple of blips in a shape. Keeping
   it to a single primitive is what keeps the family sounding related. */

type Blip = {
  f: number;          // frequency, Hz
  t?: number;         // start offset, seconds
  d?: number;         // duration, seconds
  g?: number;         // peak gain
  type?: OscillatorType;
  bend?: number;      // multiply frequency by this across the tail
  filter?: number;    // bandpass centre; omitted = straight through
  attack?: number;
};

function blip(b: Blip) {
  if (!ctx || !master) return;
  const t0 = now() + (b.t || 0);
  const dur = b.d ?? 0.07;
  const peak = (b.g ?? 0.5) * volume;
  const attack = b.attack ?? 0.006;

  const osc = ctx.createOscillator();
  osc.type = b.type || "triangle";
  const f = b.f * cents(rnd(-6, 6)); // never twice the same pitch
  osc.frequency.setValueAtTime(f, t0);
  if (b.bend && b.bend !== 1) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f * b.bend), t0 + dur);
  }

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  let tail: AudioNode = gain;
  if (b.filter) {
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = b.filter;
    bp.Q.value = 1.1;
    gain.connect(bp);
    tail = bp;
  }

  osc.connect(gain);
  tail.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
  osc.onended = () => { try { osc.disconnect(); gain.disconnect(); } catch { /* already gone */ } };
}

/** A few milliseconds of filtered noise. This is the "finger on a surface"
    part of a tap — without it, a tap is a tone; with it, it's a touch. */
let noiseBuf: AudioBuffer | null = null;
function tick(at = 0, gain = 0.12, freq = 1700, dur = 0.022) {
  if (!ctx || !master) return;
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.05), ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const t0 = now() + at;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = freq * rnd(0.92, 1.08);
  bp.Q.value = 2.2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain * volume, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(bp); bp.connect(g); g.connect(master);
  src.start(t0);
  src.stop(t0 + dur + 0.01);
  src.onended = () => { try { src.disconnect(); bp.disconnect(); g.disconnect(); } catch { /* already gone */ } };
}

/* ---------- pitch material ----------

   One key for the whole app: F major pentatonic, which has no semitone clashes,
   so any two notes played close together still agree. Repeated taps walk it in
   a shuffled bag rather than cycling, so there is no audible loop. */

const SCALE = [349.23, 392.0, 440.0, 523.25, 587.33, 698.46]; // F G A C D F
let bag: number[] = [];
function nextNote(): number {
  if (!bag.length) {
    bag = SCALE.slice(0, 5);
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
  }
  return bag.pop()!;
}

/* ---------- the palette ----------

   Named for what the person did, not for what it sounds like, so call sites
   read as intent. Everything unlisted falls back to `tap`. */

const VOICES: Record<string, () => void> = {
  /* A finger landing on something. Mostly noise, a whisper of pitch under it. */
  tap() {
    tick(0, 0.1, 1750, 0.02);
    blip({ f: nextNote() * 2, d: 0.045, g: 0.16, type: "sine", bend: 0.96, attack: 0.004 });
  },

  /* Choosing a thing — a shade brighter and more definite than a tap. */
  select() {
    tick(0, 0.08, 2100, 0.016);
    blip({ f: nextNote() * 2, d: 0.06, g: 0.24, type: "triangle", bend: 1.02 });
  },

  /* A switch going on: two notes up. Going off: the same interval, down. */
  toggleOn() {
    const f = 440;
    blip({ f, d: 0.05, g: 0.2, type: "triangle" });
    blip({ f: f * 1.5, t: 0.045, d: 0.075, g: 0.22, type: "sine" });
    tick(0, 0.05, 2200, 0.012);
  },
  toggleOff() {
    const f = 660;
    blip({ f, d: 0.05, g: 0.16, type: "triangle" });
    blip({ f: f / 1.5, t: 0.045, d: 0.085, g: 0.18, type: "sine" });
    tick(0, 0.04, 1400, 0.012);
  },

  /* Opening or closing a drawer. Barely there — this fires a lot. */
  expand() {
    tick(0, 0.06, 1200, 0.026);
    blip({ f: 294, d: 0.055, g: 0.1, type: "sine", bend: 1.12, attack: 0.01 });
  },

  /* Moving between screens: quiet, low, and distinctly not a confirmation. */
  nav() {
    blip({ f: 261.6, d: 0.075, g: 0.13, type: "sine", bend: 1.06, attack: 0.012 });
    tick(0.01, 0.04, 900, 0.02);
  },

  /* Something is saved. Warm, resolved, a rising third — the app's signature. */
  save() {
    blip({ f: 392, d: 0.09, g: 0.26, type: "triangle" });
    blip({ f: 523.25, t: 0.06, d: 0.16, g: 0.24, type: "sine" });
    blip({ f: 1046.5, t: 0.065, d: 0.11, g: 0.06, type: "sine", filter: 2400 });
    tick(0, 0.06, 1600, 0.016);
  },

  /* Quick Add. The most-used button in the app, so it gets the most satisfying
     sound: a short wooden pluck with a little upward lift under it. */
  quickadd() {
    tick(0, 0.14, 2400, 0.018);
    blip({ f: 587.33, d: 0.075, g: 0.3, type: "triangle", bend: 1.03 });
    blip({ f: 293.66, d: 0.13, g: 0.13, type: "sine", bend: 1.05, attack: 0.008 });
  },

  /* A batch of answers accepted at once — the same idea, doubled. */
  batch() {
    blip({ f: 440, d: 0.06, g: 0.2, type: "triangle" });
    blip({ f: 587.33, t: 0.055, d: 0.09, g: 0.2, type: "sine" });
    tick(0, 0.06, 1800, 0.014);
  },

  /* Passing on a question. Soft, downward, no hint of failure about it. */
  skip() {
    blip({ f: 349.23, d: 0.07, g: 0.13, type: "sine", bend: 0.88, attack: 0.01 });
  },

  /* Reordering. A small wooden knock — physical, no pitch statement. */
  reorder() {
    tick(0, 0.13, 950, 0.026);
    blip({ f: 196, d: 0.04, g: 0.1, type: "triangle", bend: 0.94 });
  },

  /* Removing something. Low and brief; it should feel like a decision, and it
     should never sound like an error alarm. */
  delete() {
    blip({ f: 293.66, d: 0.06, g: 0.14, type: "triangle", bend: 0.8, attack: 0.008 });
    tick(0.02, 0.06, 700, 0.03);
  },

  /* The day's journal is finished. The one moment allowed to be a small piece
     of music: F–A–C, arpeggiated, with a soft bell riding the top. */
  complete() {
    const chord = [349.23, 440.0, 523.25];
    chord.forEach((f, i) => {
      blip({ f, t: i * 0.075, d: 0.34 - i * 0.05, g: 0.2, type: "triangle", attack: 0.012 });
      blip({ f: f * 2, t: i * 0.075 + 0.005, d: 0.22, g: 0.05, type: "sine", filter: 2200 });
    });
    blip({ f: 1046.5, t: 0.19, d: 0.5, g: 0.07, type: "sine", filter: 2500, attack: 0.03 });
    tick(0, 0.05, 1500, 0.014);
  },

  /* A streak milestone. `complete`, opened out one note further and lifted. */
  milestone() {
    const notes = [349.23, 440.0, 523.25, 698.46];
    notes.forEach((f, i) => {
      blip({ f, t: i * 0.078, d: 0.36 - i * 0.045, g: 0.19, type: "triangle", attack: 0.012 });
      blip({ f: f * 2, t: i * 0.078 + 0.006, d: 0.2, g: 0.05, type: "sine", filter: 2300 });
    });
    blip({ f: 1396.9, t: 0.3, d: 0.62, g: 0.06, type: "sine", filter: 2600, attack: 0.04 });
  },
};

/* `include` is the swipe deck keeping a card; it reads as a gentle yes. */
VOICES.include = VOICES.batch;
VOICES.photo = VOICES.quickadd;

/* ---------- throttling ----------

   Two guards. A short floor between any two sounds, so a fast double-tap is
   one sound rather than a rattle. And a per-voice floor on the long ones, so a
   completion chord can never overlap itself into mush. */

let lastAt = 0;
const lastByVoice: Record<string, number> = {};
const LONG = new Set(["complete", "milestone", "save"]);
/* Once-a-day moments skip the rattle floor. Their own per-voice floor still
   stops them stacking, so a celebration can't overlap itself into mush. */
const UNMISSABLE = new Set(["complete", "milestone"]);

export type SoundName = keyof typeof VOICES | string;

export function setSoundEnabled(on: boolean) {
  enabled = !!on;
  if (enabled) ensureContext();
}

export function setSoundVolume(v: number) {
  volume = Math.max(0, Math.min(1.5, v));
}

export function isSoundEnabled() {
  return enabled;
}

/** Play a named voice. Silent and side-effect-free when sound is off, when
    audio is unavailable, or when it would stack on top of itself. */
export function playSound(name: SoundName) {
  if (!enabled) return;
  const t = Date.now();
  if (t - lastAt < 45 && !UNMISSABLE.has(name as string)) return;
  const voice = VOICES[name as string] || VOICES.tap;
  const floor = LONG.has(name as string) ? 700 : 60;
  if (t - (lastByVoice[name as string] || 0) < floor) return;
  if (!ensureContext()) return;
  lastAt = t;
  lastByVoice[name as string] = t;
  try {
    voice();
  } catch {
    /* An audio failure must never take a save down with it. */
  }
}

/** Let go of the audio hardware when the app is backgrounded, and pick it back
    up on return. Mobile browsers otherwise keep the output route warm. */
export function suspendSound() {
  if (ctx && ctx.state === "running") void ctx.suspend();
}
export function resumeSound() {
  if (enabled && ctx && ctx.state === "suspended") void ctx.resume();
}

/** Test hook: the sound layer has no visible output to assert on. */
export const __soundInternals = { VOICES, SCALE, nextNote };
