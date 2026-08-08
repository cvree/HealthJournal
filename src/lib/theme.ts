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

   Dark takes its cues from the deep charcoal/slate + blurple family: a near
   black-blue ground, surfaces that lift by a few points of lightness rather
   than by shadow, hairline borders, and exactly one saturated accent. Light is
   the same structure rebuilt for paper-white, not the dark palette inverted.

   Accent fills always carry `onAccent` text; `accentText` is the separate,
   contrast-checked value for accent-coloured *text* on a page background. */

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
  /* chrome */
  overlay: string;
  shimmer: string;
  shadow: string;
  shadowLg: string;
  focus: string;
  /* charts */
  grid: string;
  avgLine: string;
  chart2: string;
  chart3: string;
  chart4: string;
};

const DARK: Tokens = {
  bg: "#0E1015",
  bgElevated: "#14171E",
  card: "#171A22",
  cardHover: "#1C2029",
  faint: "#20242E",
  faintHover: "#272C37",

  line: "#252A34",
  lineStrong: "#343B49",

  ink: "#E8EAF0",
  sub: "#9AA2B4",
  subtle: "#838BA0",
  muted: "#666F85",

  accent: "#5B63E8",
  accentHover: "#6D74F0",
  accentText: "#A8AEFF",
  accentSoft: "rgba(91,99,232,0.18)",
  accentLine: "rgba(91,99,232,0.42)",
  onAccent: "#FFFFFF",

  good: "#4FBF87",
  warn: "#DFAE4B",
  alert: "#E5854F",
  bad: "#EC6A63",
  goodSoft: "rgba(79,191,135,0.16)",
  dangerBg: "rgba(236,106,99,0.14)",
  dangerInk: "#F09B95",

  overlay: "rgba(5,7,11,0.74)",
  shimmer: "#252A34",
  shadow: "0 4px 16px rgba(0,0,0,0.36)",
  shadowLg: "0 12px 36px rgba(0,0,0,0.48)",
  focus: "#8B92FF",

  grid: "#232833",
  avgLine: "#5D6577",
  chart2: "#E0B45C",
  chart3: "#4FB3D9",
  chart4: "#EC6A63",
};

const LIGHT: Tokens = {
  bg: "#F6F7F9",
  bgElevated: "#FFFFFF",
  card: "#FFFFFF",
  cardHover: "#FAFBFD",
  faint: "#EEF0F4",
  faintHover: "#E5E8EF",

  line: "#E3E6EC",
  lineStrong: "#CBD1DB",

  ink: "#1A1D26",
  sub: "#5C6474",
  subtle: "#646C7E",
  muted: "#7C8494",

  accent: "#4F57DF",
  accentHover: "#4149CE",
  accentText: "#4048CE",
  accentSoft: "rgba(79,87,223,0.10)",
  accentLine: "rgba(79,87,223,0.32)",
  onAccent: "#FFFFFF",

  good: "#2A8256",
  warn: "#966D12",
  // Kept a step darker than it looks like it needs to be: at #B65F2C it lands
  // within a hair of the white/black ink crossover, where neither label clears
  // AA on it. See the readableInk test.
  alert: "#AE5526",
  bad: "#C0413A",
  goodSoft: "rgba(42,130,86,0.10)",
  dangerBg: "#FBECEA",
  dangerInk: "#98302A",

  overlay: "rgba(26,29,38,0.44)",
  shimmer: "#F2F4F8",
  shadow: "0 2px 10px rgba(26,29,38,0.06)",
  shadowLg: "0 10px 32px rgba(26,29,38,0.10)",
  focus: "#4F57DF",

  grid: "#E8EBF0",
  avgLine: "#A6AEBD",
  chart2: "#B8862A",
  chart3: "#2E7FA8",
  chart4: "#C0413A",
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
