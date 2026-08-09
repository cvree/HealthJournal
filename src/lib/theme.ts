/* Design tokens + theme switching.

   The app is one large single-file surface (src/App.tsx) that reads colours as
   `C.something` at render time rather than destructuring them once. That makes
   a theme swap cheap: mutate the token object in place, re-render the tree, and
   every surface picks up the new palette. The same values are mirrored onto
   :root as CSS custom properties so plain stylesheet rules (index.css, the
   global <style> block, scrollbars, selection colours) stay in sync from one
   source of truth.

   Dark is the default. Light is a first-class option, not an afterthought, and
   the choice is remembered in localStorage — it has to be readable *before*
   React mounts (see the inline script in index.html) so the first paint is
   already the right colour instead of flashing white. */

export type ThemeName = "dark" | "light";
export type ThemePreference = ThemeName | "system";

/** Which ambient backdrop is drawn behind the app. `off` is a real choice, not
    an absence of one — it is what someone picks who wants a plain surface. */
export type BackdropStyle = "fog" | "aurora" | "off";
export const BACKDROP_STYLES: BackdropStyle[] = ["fog", "aurora", "off"];

export const THEME_STORAGE_KEY = "fhj_theme_v1";
export const HUE_STORAGE_KEY = "fhj_hue_v1";
export const NIGHT_STORAGE_KEY = "fhj_night_v1";
export const BACKDROP_STORAGE_KEY = "fhj_backdrop_v1";

/* The accent hue the app has always shipped with — the muted blue the Soft
   Clinical palette was built around. A saved hue replaces it; this is only the
   starting point on the slider. */
export const DEFAULT_HUE = 218;

/* Night Light narrows the accent to the amber band. "Removes all blue light"
   has to mean the accent too, or the one most-saturated surface on screen is
   still emitting exactly what the mode exists to remove. */
export const NIGHT_HUE_MIN = 20;
export const NIGHT_HUE_MAX = 52;

/* ---------- palettes ----------

   Soft Clinical. The reference is a well-made paper notebook and a calm
   clinic waiting room, not a hospital chart and not a SaaS dashboard.

   Dark is **soft graphite**: a warm-neutral charcoal, deliberately not the
   blue-black that every developer tool ships. Surfaces lift by a few points of
   lightness; borders are visible rather than hairline, because the neobrutalist
   half of the brief needs an edge it can thicken.

   Light is **warm off-white** — paper, with a faint cream cast — rebuilt at
   the same structure rather than inverted from dark.

   The accent family is muted blue (primary), sage (steady/positive), lavender
   (anything the AI touched) and clay (the earthier of the two new tracking
   categories). They are chosen to sit next to each other in a chart without
   competing, and to stay calm at large fill sizes.

   Accent fills always carry `onAccent` text; `accentText` is the separate,
   contrast-checked value for accent-coloured *text* on a page background.

   In dark mode the accent is a *light* blue carrying dark ink, not a saturated
   fill carrying white. Two reasons: white-on-blue can only clear AA if the blue
   is dark enough to look muddy against graphite, and a chunky light-on-dark
   button is what makes the neobrutalist press feel tactile instead of heavy. */

export type Tokens = {
  /* surfaces */
  bg: string;
  bgElevated: string;
  card: string;
  cardHover: string;
  faint: string;
  faintHover: string;
  /* borders */
  line: string;
  lineStrong: string;
  /* text.
     Three readable weights, not "two readable and one decorative": `subtle`
     carries eyebrows, captions and helper copy at 11px, so it has to clear AA
     against card, page and inset surfaces just like `sub` does. The hierarchy
     between them comes from size, weight and capitals — which survives a
     contrast fix, where a lighter grey does not. `muted` is the only
     non-text-carrying tone: placeholders and the "no value yet" dash. */
  ink: string;
  sub: string;
  subtle: string;
  muted: string;
  /* accent */
  accent: string;
  accentHover: string;
  accentText: string;
  accentSoft: string;
  accentLine: string;
  onAccent: string;
  /* status ramp (low → high severity) */
  good: string;
  warn: string;
  alert: string;
  bad: string;
  goodSoft: string;
  dangerBg: string;
  dangerInk: string;
  /* category accents.
     Each tracking category owns one hue so a food card, a bowel card and a
     symptom card are told apart before any label is read. `*Text` is the
     contrast-checked value for that hue used as *text*; the bare token is a
     fill/stroke and is only guaranteed against `card` at large-text ratio. */
  sage: string;
  sageText: string;
  sageSoft: string;
  lavender: string;
  lavenderText: string;
  lavenderSoft: string;
  clay: string;
  clayText: string;
  claySoft: string;
  /* chrome */
  overlay: string;
  shimmer: string;
  shadow: string;
  shadowLg: string;
  /* Neobrutalist offset shadows: a hard, un-blurred drop with no alpha ramp.
     Used sparingly — primary buttons, the selected metric, Quick Add tiles —
     and always paired with a visible border, which is what keeps it reading as
     "tactile" rather than "1990s bevel". */
  shadowPop: string;
  shadowPopLg: string;
  focus: string;
  /* charts */
  grid: string;
  avgLine: string;
  chart2: string;
  chart3: string;
  chart4: string;
};

const DARK: Tokens = {
  bg: "#141519",
  bgElevated: "#1A1C21",
  card: "#1E2026",
  cardHover: "#25272E",
  faint: "#2A2D35",
  faintHover: "#32353E",

  line: "#31343D",
  lineStrong: "#464A55",

  ink: "#ECEBE7",
  sub: "#ADAFB8",
  subtle: "#9A9CA6",
  muted: "#787B86",

  accent: "#8FB0E3",
  accentHover: "#A3C0EA",
  accentText: "#A6C3EA",
  accentSoft: "rgba(143,176,227,0.15)",
  accentLine: "rgba(143,176,227,0.40)",
  onAccent: "#121419",

  good: "#7FBE9E",
  warn: "#DCBB78",
  alert: "#DFA079",
  bad: "#E08B85",
  goodSoft: "rgba(127,190,158,0.15)",
  dangerBg: "rgba(224,139,133,0.13)",
  dangerInk: "#E6A29D",

  sage: "#7FBE9E",
  sageText: "#94CBAD",
  sageSoft: "rgba(127,190,158,0.15)",
  lavender: "#B49EE0",
  lavenderText: "#C3B1E8",
  lavenderSoft: "rgba(180,158,224,0.16)",
  clay: "#D9A183",
  clayText: "#E3B49B",
  claySoft: "rgba(217,161,131,0.15)",

  overlay: "rgba(10,11,14,0.72)",
  shimmer: "#2A2D35",
  shadow: "0 4px 16px rgba(0,0,0,0.34)",
  shadowLg: "0 14px 38px rgba(0,0,0,0.46)",
  shadowPop: "3px 3px 0 rgba(0,0,0,0.55)",
  shadowPopLg: "5px 5px 0 rgba(0,0,0,0.55)",
  focus: "#A6C3EA",

  grid: "#2B2E36",
  avgLine: "#6A6E7A",
  chart2: "#DCBB78",
  chart3: "#7BC2B6",
  chart4: "#B49EE0",
};

const LIGHT: Tokens = {
  bg: "#F4F1EB",
  bgElevated: "#FFFFFF",
  card: "#FDFBF7",
  cardHover: "#F8F5EF",
  faint: "#EDE9E1",
  faintHover: "#E4DFD5",

  line: "#E0DACE",
  lineStrong: "#C4BCAB",

  ink: "#23252B",
  sub: "#5A5E68",
  subtle: "#63666F",
  // Dark enough to clear 3:1 on `faint`, which is the warmest/darkest surface
  // a placeholder ever sits on. At #878A93 it measured 2.85 there.
  muted: "#7F828B",

  accent: "#3D6AAF",
  accentHover: "#345C99",
  accentText: "#355F9F",
  accentSoft: "rgba(61,106,175,0.10)",
  accentLine: "rgba(61,106,175,0.30)",
  onAccent: "#FFFFFF",

  good: "#33795A",
  warn: "#8A6516",
  // Kept a step darker than it looks like it needs to be: at #B65F2C it lands
  // within a hair of the white/black ink crossover, where neither label clears
  // AA on it. See the readableInk test.
  alert: "#A85427",
  bad: "#B54039",
  goodSoft: "rgba(51,121,90,0.10)",
  dangerBg: "#F9EAE7",
  dangerInk: "#8F2F29",

  sage: "#33795A",
  sageText: "#2E6E52",
  sageSoft: "rgba(51,121,90,0.10)",
  lavender: "#68499F",
  lavenderText: "#5F4293",
  lavenderSoft: "rgba(104,73,159,0.10)",
  clay: "#A05A34",
  clayText: "#8F502D",
  claySoft: "rgba(160,90,52,0.10)",

  overlay: "rgba(35,37,43,0.42)",
  shimmer: "#EFEBE3",
  shadow: "0 2px 10px rgba(60,50,35,0.07)",
  shadowLg: "0 10px 32px rgba(60,50,35,0.11)",
  shadowPop: "3px 3px 0 rgba(60,50,35,0.18)",
  shadowPopLg: "5px 5px 0 rgba(60,50,35,0.18)",
  focus: "#3D6AAF",

  grid: "#E6E1D7",
  avgLine: "#A9A395",
  chart2: "#946A18",
  chart3: "#276F66",
  chart4: "#68499F",
};

export const PALETTES: Record<ThemeName, Tokens> = { dark: DARK, light: LIGHT };

/* The live token object. Mutated in place by applyTheme so every `C.x` read in
   the render tree resolves to the active theme without threading a context
   through ~7k lines of markup. Never reassign it — always Object.assign. */
export const C: Tokens = { ...DARK };

/* ---------- contrast helpers ---------- */

function channel(v: number) {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance of a #rgb / #rrggbb colour. Non-hex input → 0.5. */
export function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return 0.5;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/* Where white and near-black text are exactly as legible on the same fill:
   (L + 0.05)² = 1.05 × 0.05  ⇒  L ≈ 0.1791. Above it, dark ink wins; below it,
   white does. Guessing a rounder number here picks the wrong ink for the
   mid-tone half of the severity ramp, which is most of it. */
const INK_CROSSOVER = 0.1791;

/** Text colour that stays readable on top of an arbitrary fill. Used for the
    severity ramp, where the same swatch is a background in one place and needs
    a label on top in another. */
export function readableInk(background: string): string {
  return luminance(background) > INK_CROSSOVER ? "#12151C" : "#FFFFFF";
}

/** WCAG contrast ratio between two colours. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/* ---------- colour space helpers ----------

   Everything below works in HSL because a hue slider is, literally, the H of
   HSL. The catch is that HSL lightness is not perceptual: yellow at L=70 is far
   brighter than blue at L=70. So nothing here trusts a fixed L to land on a
   readable colour — the derivation below solves for contrast instead. */

type RGB = { r: number; g: number; b: number };

function parseHex(hex: string): RGB | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

const clamp255 = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
const hex2 = (n: number) => clamp255(n).toString(16).padStart(2, "0");
const toHex = ({ r, g, b }: RGB) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;

export function hslToHex(h: number, s: number, l: number): string {
  const hn = ((h % 360) + 360) % 360 / 360;
  const sn = Math.max(0, Math.min(1, s / 100));
  const ln = Math.max(0, Math.min(1, l / 100));
  if (sn === 0) {
    const v = ln * 255;
    return toHex({ r: v, g: v, b: v });
  }
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  const channelAt = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return toHex({
    r: channelAt(hn + 1 / 3) * 255,
    g: channelAt(hn) * 255,
    b: channelAt(hn - 1 / 3) * 255,
  });
}

/** `#8FB0E3` → `143,176,227`, so a token can become an rgba() at any alpha. */
function rgbTriplet(hex: string): string {
  const c = parseHex(hex);
  return c ? `${c.r}, ${c.g}, ${c.b}` : "0, 0, 0";
}

type HSL = { h: number; s: number; l: number };

function hexToHsl(hex: string): HSL | null {
  const c = parseHex(hex);
  if (!c) return null;
  const r = c.r / 255, g = c.g / 255, b = c.b / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: h * 360, s: s * 100, l: l * 100 };
}

/* Nudge a colour until it clears `target` against every surface it is used on,
   keeping its hue and saturation. A no-op whenever the colour already passes,
   which is every token in the shipped palettes — this only ever fires for
   colours the Night Light transform pushed under the bar. */
function ensureContrast(color: string, surfaces: string[], target: number): string {
  const worst = (c: string) => Math.min(...surfaces.map((s) => contrastRatio(c, s)));
  if (worst(color) >= target) return color;
  const hsl = hexToHsl(color);
  if (!hsl) return color;
  // Move away from the surfaces: lighter if the text is already the lighter of
  // the pair, darker if it is the darker one.
  const surfaceLum = surfaces.reduce((a, s) => a + luminance(s), 0) / surfaces.length;
  const dir = luminance(color) >= surfaceLum ? 1 : -1;
  let l = hsl.l;
  for (let i = 0; i < 200; i++) {
    l += dir * 0.5;
    if (l < 0 || l > 100) break;
    const candidate = hslToHex(hsl.h, hsl.s, l);
    if (worst(candidate) >= target) return candidate;
  }
  return dir > 0 ? "#FFFFFF" : "#000000";
}

/* ---------- night light ----------

   The honest implementation. A warm overlay only *looks* like less blue while
   the panel keeps emitting exactly as much of it; the pixels have to actually
   change. Every colour the app paints is pushed through this, so what leaves
   the screen really is short-wavelength-poor.

   Green is trimmed far less than blue: melatonin suppression peaks around
   480nm, and cutting green as hard as blue only makes the screen muddy without
   buying anything.

   Blue is cut hard but not to zero, and that is deliberate. At B=0 a white
   card renders as pure #FFFF00 — the mode stops reading as "warm screen" and
   starts reading as "broken screen", and nobody leaves it on. This is roughly a
   2700K white point: about as far as a display can be pushed while a page of
   text still looks like a page of text. */
const NIGHT_BLUE = 0.55;
const NIGHT_GREEN = 0.86;

function warmChannel(c: RGB): RGB {
  return { r: c.r, g: c.g * NIGHT_GREEN, b: c.b * NIGHT_BLUE };
}

/** Strip blue from any CSS colour string, leaving non-colour text untouched.
    Handles the `#rgb`/`#rrggbb` and `rgba()` forms the tokens actually use,
    including the ones embedded in box-shadow values. */
export function stripBlue(value: string): string {
  let out = String(value).replace(/#([0-9a-f]{3}|[0-9a-f]{6})\b/gi, (m) => {
    const c = parseHex(m);
    return c ? toHex(warmChannel(c)) : m;
  });
  out = out.replace(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/gi,
    (_m, r, g, b, a) => {
      const c = warmChannel({ r: +r, g: +g, b: +b });
      const rgb = `${clamp255(c.r)}, ${clamp255(c.g)}, ${clamp255(c.b)}`;
      return a === undefined ? `rgb(${rgb})` : `rgba(${rgb}, ${a})`;
    }
  );
  return out;
}

/* ---------- accent derivation ----------

   The hue slider may not be allowed to make the app unreadable, and "pick a
   sensible lightness per hue" is not good enough — the whole point of the
   contrast suite is that no colour decision is left to taste alone. So the
   accent is *solved*: walk lightness until the pair actually measures at the
   ratio it has to hit, then stop. Every hue on the slider therefore clears the
   same bar the hand-tuned blue did. */

function solveLightness(
  hue: number,
  sat: number,
  against: string[],
  target: number,
  from: number,
  step: number
): string {
  let l = from;
  let best = hslToHex(hue, sat, l);
  for (let i = 0; i < 200; i++) {
    const candidate = hslToHex(hue, sat, l);
    const worst = Math.min(...against.map((s) => contrastRatio(candidate, s)));
    if (worst >= target) return candidate;
    best = candidate;
    l += step;
    if (l < 0 || l > 100) break;
  }
  return best;
}

export type AccentTokens = Pick<
  Tokens,
  "accent" | "accentHover" | "accentText" | "accentSoft" | "accentLine" | "onAccent" | "focus"
>;

/** Build the accent family for a hue so it clears AA on the given surfaces. */
export function deriveAccent(
  hue: number,
  theme: ThemeName,
  surfaces: { bg: string; card: string }
): AccentTokens {
  const both = [surfaces.bg, surfaces.card];
  if (theme === "dark") {
    // Dark carries dark ink on a light accent — see the palette notes above.
    const onAccent = "#121419";
    const accent = solveLightness(hue, 55, [onAccent], 4.5, 72, 1);
    const accentHover = solveLightness(hue, 58, [onAccent], 3, 80, 1);
    /* Accent-as-text is checked against *both* surfaces, not the page alone:
       in dark the card is the lighter of the two and therefore the harder one,
       and in light it is the other way round. Solving against one of them ships
       a colour that quietly misses AA on the other. */
    const accentText = solveLightness(hue, 52, both, 4.5, 74, 1);
    return {
      accent,
      accentHover,
      accentText,
      accentSoft: `rgba(${rgbTriplet(accent)}, 0.15)`,
      accentLine: `rgba(${rgbTriplet(accent)}, 0.40)`,
      onAccent,
      focus: accentText,
    };
  }
  const onAccent = "#FFFFFF";
  const accent = solveLightness(hue, 48, [onAccent], 4.5, 46, -1);
  const accentHover = solveLightness(hue, 50, [onAccent], 3, 40, -1);
  const accentText = solveLightness(hue, 50, both, 4.5, 42, -1);
  return {
    accent,
    accentHover,
    accentText,
    accentSoft: `rgba(${rgbTriplet(accent)}, 0.10)`,
    accentLine: `rgba(${rgbTriplet(accent)}, 0.30)`,
    onAccent,
    focus: accentText,
  };
}

/** Clamp a hue into the warm band when Night Light is on. */
export function effectiveHue(hue: number, nightLight: boolean): number {
  const h = ((Math.round(hue) % 360) + 360) % 360;
  if (!nightLight) return h;
  // Map the full wheel onto the amber band rather than snapping every cold hue
  // to one value — the slider still does something under Night Light.
  return Math.round(NIGHT_HUE_MIN + (h / 360) * (NIGHT_HUE_MAX - NIGHT_HUE_MIN));
}

/** The full token set actually painted: base palette, optionally stripped of
    blue, with an accent family solved against the resulting surfaces. */
export function deriveTokens(theme: ThemeName, hue: number, nightLight: boolean): Tokens {
  const base = PALETTES[theme];
  const t: Tokens = nightLight
    ? (Object.fromEntries(
        Object.entries(base).map(([k, v]) => [k, stripBlue(v)])
      ) as Tokens)
    : { ...base };

  /* Repair pass. Scaling every channel toward amber preserves the *order* of
     two colours' luminance but not the ratio between them, so a pair that
     measured 3.02:1 in daylight can land at 2.89:1 once the blue is gone. Each
     token is pushed back over its own bar here, which is what keeps Night Light
     from being an accessibility regression wearing a feature's clothes.

     Every one of these is a no-op unless Night Light moved the colour: the
     shipped palettes already clear these bars, and that is what theme.test.ts
     asserts independently. */
  if (nightLight) {
    const BODY = 4.5;
    const LARGE = 3;
    t.ink = ensureContrast(t.ink, [t.bg, t.card, t.faint], BODY);
    t.sub = ensureContrast(t.sub, [t.bg, t.card], BODY);
    t.subtle = ensureContrast(t.subtle, [t.bg, t.card, t.faint], BODY);
    t.muted = ensureContrast(t.muted, [t.card, t.faint], LARGE);
    t.dangerInk = ensureContrast(t.dangerInk, [t.card], BODY);
    for (const k of ["good", "warn", "alert", "bad", "sage", "lavender", "clay",
                     "chart2", "chart3", "chart4"] as const) {
      t[k] = ensureContrast(t[k], [t.card], LARGE);
    }
    for (const k of ["sageText", "lavenderText", "clayText"] as const) {
      t[k] = ensureContrast(t[k], [t.card, t.bg], BODY);
    }
  }

  const accent = deriveAccent(effectiveHue(hue, nightLight), theme, {
    bg: t.bg,
    card: t.card,
  });
  return { ...t, ...accent };
}

/* ---------- applying a theme ---------- */

const CSS_VAR = (k: string) => `--fhj-${k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())}`;

type Listener = (theme: ThemeName) => void;
const listeners = new Set<Listener>();

/* Hue and Night Light change every colour on screen without changing which
   *theme* is active, so a listener keyed on the theme name would never fire for
   them — React bails out of a setState that lands on the same string. The
   revision counter is what the render tree actually subscribes to. */
type AppearanceListener = (revision: number) => void;
const appearanceListeners = new Set<AppearanceListener>();
let revision = 0;

let preference: ThemePreference = "dark";
let resolved: ThemeName = "dark";
let hue: number = DEFAULT_HUE;
let nightLight = false;
let backdrop: BackdropStyle = "fog";

/** What the OS is asking for, or null when it has no opinion / no matchMedia. */
export function systemTheme(): ThemeName | null {
  if (typeof window === "undefined" || !window.matchMedia) return null;
  if (window.matchMedia("(prefers-color-scheme: light)").matches) return "light";
  if (window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
  return null;
}

export function resolveTheme(pref: ThemePreference): ThemeName {
  if (pref === "system") return systemTheme() ?? "dark";
  return pref;
}

/** Read the saved preference. Dark whenever nothing valid is stored — the
    default is a decision, not an accident of what the OS happens to prefer. */
export function readThemePreference(): ThemePreference {
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    /* storage blocked (private mode, embedded frame) — fall through to dark */
  }
  return "dark";
}

/** Read a saved hue. Anything unparseable falls back to the shipped blue. */
export function readHue(): number {
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(HUE_STORAGE_KEY);
    const n = Number(raw);
    if (raw !== null && Number.isFinite(n)) return ((Math.round(n) % 360) + 360) % 360;
  } catch {
    /* storage blocked — the default hue is still a usable app */
  }
  return DEFAULT_HUE;
}

export function readNightLight(): boolean {
  try {
    if (typeof localStorage === "undefined") return false;
    return localStorage.getItem(NIGHT_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function readBackdrop(): BackdropStyle {
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(BACKDROP_STORAGE_KEY);
    if (raw === "fog" || raw === "aurora" || raw === "off") return raw;
  } catch {
    /* fall through */
  }
  return "fog";
}

function paint(theme: ThemeName) {
  const palette = deriveTokens(theme, hue, nightLight);
  Object.assign(C, palette);
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.night = nightLight ? "on" : "off";
  root.dataset.backdrop = backdrop;
  root.style.colorScheme = theme;
  for (const [k, v] of Object.entries(palette)) root.style.setProperty(CSS_VAR(k), v);
  /* The backdrop paints from these rather than from React state, so a hue drag
     re-tints the fog on the same frame as the rest of the app. */
  root.style.setProperty("--fhj-hue", String(effectiveHue(hue, nightLight)));
  root.style.setProperty("--fhj-accent-rgb", rgbTriplet(palette.accent));
  // Address-bar / status-bar tint on mobile, and the PWA splash surface.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", palette.bg);
  const scheme = document.querySelector('meta[name="color-scheme"]');
  if (scheme) scheme.setAttribute("content", theme);
}

function announce(theme: ThemeName) {
  revision++;
  listeners.forEach((fn) => fn(theme));
  appearanceListeners.forEach((fn) => fn(revision));
}

function persist(key: string, value: string) {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
  } catch {
    /* a choice we can't remember is still a choice we can show */
  }
}

/** Set (and persist) the user's choice. `system` follows the OS live. */
export function setThemePreference(pref: ThemePreference) {
  preference = pref;
  persist(THEME_STORAGE_KEY, pref);
  const next = resolveTheme(pref);
  resolved = next;
  paint(next);
  announce(next);
}

/** Set the accent hue. Called on every frame of a slider drag, so it stays
    cheap: one palette derivation and one batch of custom-property writes. */
export function setHue(next: number) {
  hue = ((Math.round(next) % 360) + 360) % 360;
  persist(HUE_STORAGE_KEY, String(hue));
  paint(resolved);
  announce(resolved);
}

export function setNightLight(on: boolean) {
  nightLight = !!on;
  persist(NIGHT_STORAGE_KEY, nightLight ? "1" : "0");
  paint(resolved);
  announce(resolved);
}

export function setBackdrop(style: BackdropStyle) {
  backdrop = style;
  persist(BACKDROP_STORAGE_KEY, style);
  paint(resolved);
  announce(resolved);
}

export const getThemePreference = (): ThemePreference => preference;
export const getTheme = (): ThemeName => resolved;
export const getHue = (): number => hue;
export const getNightLight = (): boolean => nightLight;
export const getBackdrop = (): BackdropStyle => backdrop;
export const getAppearanceRevision = (): number => revision;

/** Subscribe to resolved-theme changes (including OS flips under `system`). */
export function onThemeChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Subscribe to *any* appearance change — theme, hue, night light, backdrop.
    The argument is a revision number, so consumers re-render even when the
    theme name itself hasn't moved. */
export function onAppearanceChange(fn: AppearanceListener): () => void {
  appearanceListeners.add(fn);
  return () => appearanceListeners.delete(fn);
}

let systemWatcher: MediaQueryList | null = null;

/** Idempotent. Called once on import so tokens are correct before first paint. */
export function initTheme() {
  preference = readThemePreference();
  resolved = resolveTheme(preference);
  hue = readHue();
  nightLight = readNightLight();
  backdrop = readBackdrop();
  paint(resolved);

  if (typeof window === "undefined" || !window.matchMedia || systemWatcher) return;
  systemWatcher = window.matchMedia("(prefers-color-scheme: light)");
  const onSystem = () => {
    if (preference !== "system") return;
    const next = resolveTheme("system");
    if (next === resolved) return;
    resolved = next;
    paint(next);
    announce(next);
  };
  if (systemWatcher.addEventListener) systemWatcher.addEventListener("change", onSystem);
  else if ((systemWatcher as any).addListener) (systemWatcher as any).addListener(onSystem);
}

initTheme();
