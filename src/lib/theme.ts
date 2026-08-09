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

export const THEME_STORAGE_KEY = "fhj_theme_v1";

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

/* ---------- applying a theme ---------- */

const CSS_VAR = (k: string) => `--fhj-${k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())}`;

type Listener = (theme: ThemeName) => void;
const listeners = new Set<Listener>();

let preference: ThemePreference = "dark";
let resolved: ThemeName = "dark";

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

function paint(theme: ThemeName) {
  const palette = PALETTES[theme];
  Object.assign(C, palette);
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  for (const [k, v] of Object.entries(palette)) root.style.setProperty(CSS_VAR(k), v);
  // Address-bar / status-bar tint on mobile, and the PWA splash surface.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", palette.bg);
  const scheme = document.querySelector('meta[name="color-scheme"]');
  if (scheme) scheme.setAttribute("content", theme);
}

/** Set (and persist) the user's choice. `system` follows the OS live. */
export function setThemePreference(pref: ThemePreference) {
  preference = pref;
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    /* a theme we can't remember is still a theme we can show */
  }
  const next = resolveTheme(pref);
  resolved = next;
  paint(next);
  listeners.forEach((fn) => fn(next));
}

export const getThemePreference = (): ThemePreference => preference;
export const getTheme = (): ThemeName => resolved;

/** Subscribe to resolved-theme changes (including OS flips under `system`). */
export function onThemeChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let systemWatcher: MediaQueryList | null = null;

/** Idempotent. Called once on import so tokens are correct before first paint. */
export function initTheme() {
  preference = readThemePreference();
  resolved = resolveTheme(preference);
  paint(resolved);

  if (typeof window === "undefined" || !window.matchMedia || systemWatcher) return;
  systemWatcher = window.matchMedia("(prefers-color-scheme: light)");
  const onSystem = () => {
    if (preference !== "system") return;
    const next = resolveTheme("system");
    if (next === resolved) return;
    resolved = next;
    paint(next);
    listeners.forEach((fn) => fn(next));
  };
  if (systemWatcher.addEventListener) systemWatcher.addEventListener("change", onSystem);
  else if ((systemWatcher as any).addListener) (systemWatcher as any).addListener(onSystem);
}

initTheme();
