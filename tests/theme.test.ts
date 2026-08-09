/* Theme tokens and preference handling.

   The load-bearing promises: dark unless someone chose otherwise, the choice
   survives a reload, every token exists in both palettes, and the contrast
   pairs the UI actually uses clear WCAG AA. That last group is the reason a
   redesign can't quietly regress into unreadable grey-on-grey. */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  PALETTES, C, luminance, readableInk, initTheme, setThemePreference,
  readThemePreference, getTheme, getThemePreference, resolveTheme, onThemeChange,
  THEME_STORAGE_KEY, HUE_STORAGE_KEY, NIGHT_STORAGE_KEY, BACKDROP_STORAGE_KEY,
  DEFAULT_HUE, NIGHT_HUE_MIN, NIGHT_HUE_MAX, BACKDROP_STYLES,
  deriveTokens, effectiveHue, stripBlue, contrastRatio, setHue, getHue,
  setNightLight, getNightLight, setBackdrop, getBackdrop, onAppearanceChange,
} from "../src/lib/theme";

const contrast = (a: string, b: string) => {
  const la = luminance(a), lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
};

beforeEach(() => {
  localStorage.clear();
  initTheme();
});

describe("preference", () => {
  it("defaults to dark when nothing is stored", () => {
    expect(readThemePreference()).toBe("dark");
    expect(getTheme()).toBe("dark");
  });

  it("ignores a stored value that isn't a theme", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "chartreuse");
    expect(readThemePreference()).toBe("dark");
  });

  it("persists a choice and re-reads it on the next boot", () => {
    setThemePreference("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    initTheme(); // simulate a reload
    expect(getThemePreference()).toBe("light");
    expect(getTheme()).toBe("light");
  });

  it("resolves \"system\" to dark when the OS has no opinion", () => {
    expect(resolveTheme("system")).toBe("dark");
  });

  it("notifies subscribers so the React tree can re-read tokens", () => {
    const seen: string[] = [];
    const off = onThemeChange((t) => seen.push(t));
    setThemePreference("light");
    setThemePreference("dark");
    off();
    setThemePreference("light");
    expect(seen).toEqual(["light", "dark"]);
  });
});

describe("applying a theme", () => {
  it("mutates the shared token object in place, so every C.x read follows", () => {
    setThemePreference("light");
    expect(C.bg).toBe(PALETTES.light.bg);
    setThemePreference("dark");
    expect(C.bg).toBe(PALETTES.dark.bg);
  });

  it("mirrors every token onto :root as a CSS custom property", () => {
    setThemePreference("light");
    const root = document.documentElement;
    expect(root.dataset.theme).toBe("light");
    expect(root.style.getPropertyValue("--fhj-bg")).toBe(PALETTES.light.bg);
    expect(root.style.getPropertyValue("--fhj-line-strong")).toBe(PALETTES.light.lineStrong);
    // The accent family is derived from the hue rather than copied from the
    // palette, so it is asserted as a colour, not as a fixed string.
    expect(root.style.getPropertyValue("--fhj-accent-text")).toMatch(/^#[0-9a-f]{6}$/i);
    // Everything the backdrop reads has to be published too, or a hue drag
    // repaints the app and leaves the background on the old colour.
    expect(root.style.getPropertyValue("--fhj-hue")).toBe(String(DEFAULT_HUE));
    expect(root.style.getPropertyValue("--fhj-accent-rgb")).toMatch(/^\d+, \d+, \d+$/);
  });

  it("tells the browser which scheme to render native controls in", () => {
    setThemePreference("light");
    expect(document.documentElement.style.colorScheme).toBe("light");
    setThemePreference("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });
});

describe("palettes", () => {
  it("define the same token set, so no screen can fall through a gap", () => {
    expect(Object.keys(PALETTES.dark).sort()).toEqual(Object.keys(PALETTES.light).sort());
  });

  it("have no empty values", () => {
    for (const [name, palette] of Object.entries(PALETTES)) {
      for (const [token, value] of Object.entries(palette)) {
        expect(value, `${name}.${token}`).toBeTruthy();
      }
    }
  });
});

describe("contrast", () => {
  // 4.5:1 is AA for body text; 3:1 is AA for large text and UI boundaries.
  const BODY = 4.5;
  const LARGE = 3;

  for (const [name, p] of Object.entries(PALETTES)) {
    describe(name, () => {
      it("body text on the page and on a card", () => {
        expect(contrast(p.ink, p.bg)).toBeGreaterThanOrEqual(BODY);
        expect(contrast(p.ink, p.card)).toBeGreaterThanOrEqual(BODY);
        expect(contrast(p.ink, p.faint)).toBeGreaterThanOrEqual(BODY);
      });

      it("secondary text stays readable rather than decorative", () => {
        expect(contrast(p.sub, p.bg)).toBeGreaterThanOrEqual(BODY);
        expect(contrast(p.sub, p.card)).toBeGreaterThanOrEqual(BODY);
      });

      it("captions and eyebrows are body copy, so they clear the body bar", () => {
        // These carry section labels and helper text at 11px. They looked
        // fine as "decoration" until an audit measured them at 3.1:1.
        expect(contrast(p.subtle, p.bg)).toBeGreaterThanOrEqual(BODY);
        expect(contrast(p.subtle, p.card)).toBeGreaterThanOrEqual(BODY);
        expect(contrast(p.subtle, p.faint)).toBeGreaterThanOrEqual(BODY);
      });

      it("placeholders and empty-value dashes stay perceivable", () => {
        expect(contrast(p.muted, p.card)).toBeGreaterThanOrEqual(LARGE);
        expect(contrast(p.muted, p.faint)).toBeGreaterThanOrEqual(LARGE);
      });

      it("labels on an accent button", () => {
        expect(contrast(p.onAccent, p.accent)).toBeGreaterThanOrEqual(BODY);
        expect(contrast(p.onAccent, p.accentHover)).toBeGreaterThanOrEqual(LARGE);
      });

      it("accent used as text, not as a fill", () => {
        expect(contrast(p.accentText, p.bg)).toBeGreaterThanOrEqual(BODY);
        expect(contrast(p.accentText, p.card)).toBeGreaterThanOrEqual(BODY);
      });

      it("the whole severity ramp reads on a card", () => {
        for (const step of ["good", "warn", "alert", "bad"] as const) {
          expect(contrast(p[step], p.card), step).toBeGreaterThanOrEqual(LARGE);
        }
      });

      it("destructive actions", () => {
        expect(contrast(p.dangerInk, p.card)).toBeGreaterThanOrEqual(BODY);
      });

      it("chart series stay apart from the surface behind them", () => {
        for (const series of [p.accent, p.chart2, p.chart3, p.chart4]) {
          expect(contrast(series, p.card)).toBeGreaterThanOrEqual(LARGE);
        }
      });

      /* The category hues are what tell a food card from a bowel card from a
         symptom card before any label is read, so they carry the same burden
         the accent does: legible as a fill, and legible as text. */
      it("category hues read as fills", () => {
        for (const hue of ["sage", "lavender", "clay"] as const) {
          expect(contrast(p[hue], p.card), hue).toBeGreaterThanOrEqual(LARGE);
          expect(contrast(readableInk(p[hue]), p[hue]), `ink on ${hue}`).toBeGreaterThanOrEqual(BODY);
        }
      });

      it("category hues read as text", () => {
        for (const hue of ["sageText", "lavenderText", "clayText"] as const) {
          expect(contrast(p[hue], p.card), hue).toBeGreaterThanOrEqual(BODY);
          expect(contrast(p[hue], p.bg), hue).toBeGreaterThanOrEqual(BODY);
        }
      });

      it("offset shadows are hard-edged, not blurred", () => {
        // A neobrutalist drop with a blur radius is just a soft shadow wearing
        // a costume. Both offsets must have a zero third length.
        for (const s of [p.shadowPop, p.shadowPopLg]) {
          expect(s).toMatch(/^-?\d+px -?\d+px 0 /);
        }
      });
    });
  }
});

/* The inline script in index.html/viewer.html paints --fhj-bg before React
   mounts, so a cold start doesn't flash the wrong colour. It has to duplicate
   two values from the palettes, which means it can silently drift out of sync
   with them — this is the only thing stopping that. */
describe("pre-paint script", () => {
  // Not import.meta.url — this suite runs under jsdom, where that resolves to
  // an http: URL that readFileSync refuses.
  const html = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
  const viewer = readFileSync(resolve(process.cwd(), "viewer.html"), "utf8");

  it("uses the real palette background in both documents", () => {
    for (const [name, doc] of [["index", html], ["viewer", viewer]] as const) {
      expect(doc, name).toContain(`"${PALETTES.light.bg}" : "${PALETTES.dark.bg}"`);
      expect(doc, name).toContain(`content="${PALETTES.dark.bg}"`);
    }
  });

  it("uses the real palette secondary ink where it sets one", () => {
    expect(html).toContain(`"${PALETTES.light.sub}" : "${PALETTES.dark.sub}"`);
  });
});

/* ---------------------------------------------------------------------------
   Hue, Night Light and the backdrop.

   The contrast suite above pins down two hand-tuned palettes. Once the accent
   became a slider, "the designer checked it" stopped being a strategy: there
   are 360 accents now, and any one of them can be the one someone picks. So
   the guarantee is re-stated as a property — *every* hue clears the same bar
   the hand-tuned blue did — and checked across the whole wheel, in both
   themes, with Night Light on and off. That is 1,440 palettes per assertion,
   which is the only reason a hue slider is safe to ship in an app whose job is
   reading numbers off a screen.
   ------------------------------------------------------------------------ */

const EVERY_HUE = Array.from({ length: 72 }, (_, i) => i * 5);
const BOTH: ("dark" | "light")[] = ["dark", "light"];

describe("the hue slider", () => {
  it("keeps label-on-button readable at every hue", () => {
    for (const theme of BOTH) {
      for (const night of [false, true]) {
        for (const h of EVERY_HUE) {
          const t = deriveTokens(theme, h, night);
          expect(contrastRatio(t.onAccent, t.accent), `${theme} h${h} night=${night}`)
            .toBeGreaterThanOrEqual(4.5);
          expect(contrastRatio(t.onAccent, t.accentHover), `hover ${theme} h${h}`)
            .toBeGreaterThanOrEqual(3);
        }
      }
    }
  });

  it("keeps accent-as-text readable on both the page and a card, at every hue", () => {
    for (const theme of BOTH) {
      for (const night of [false, true]) {
        for (const h of EVERY_HUE) {
          const t = deriveTokens(theme, h, night);
          expect(contrastRatio(t.accentText, t.bg), `${theme} h${h} bg`).toBeGreaterThanOrEqual(4.5);
          expect(contrastRatio(t.accentText, t.card), `${theme} h${h} card`).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it("actually changes the accent — the slider is not decorative", () => {
    const a = deriveTokens("dark", 0, false).accent;
    const b = deriveTokens("dark", 120, false).accent;
    const c = deriveTokens("dark", 240, false).accent;
    expect(new Set([a, b, c]).size).toBe(3);
  });

  it("leaves the surfaces and the semantic ramp alone", () => {
    // A food card, a bowel card and a symptom card are told apart by hue. If
    // the accent slider dragged those with it, the categories would stop being
    // distinguishable at exactly the settings a user liked the look of.
    const base = deriveTokens("dark", DEFAULT_HUE, false);
    const far = deriveTokens("dark", 40, false);
    for (const k of ["bg", "card", "ink", "good", "warn", "alert", "bad", "sage", "lavender", "clay"] as const) {
      expect(far[k], k).toBe(base[k]);
    }
  });

  it("wraps rather than clamping, so the slider has no dead ends", () => {
    expect(effectiveHue(360, false)).toBe(0);
    expect(effectiveHue(-30, false)).toBe(330);
    expect(effectiveHue(725, false)).toBe(5);
  });

  it("persists and re-reads across a reload", () => {
    setHue(97);
    expect(localStorage.getItem(HUE_STORAGE_KEY)).toBe("97");
    initTheme();
    expect(getHue()).toBe(97);
  });
});

describe("night light", () => {
  it("removes blue from every colour it touches", () => {
    for (const theme of BOTH) {
      const day = deriveTokens(theme, DEFAULT_HUE, false);
      const night = deriveTokens(theme, DEFAULT_HUE, true);
      for (const k of ["bg", "card", "faint", "bgElevated"] as const) {
        const b = (hex: string) => parseInt(hex.slice(5, 7), 16);
        expect(b(night[k]), `${theme}.${k}`).toBeLessThan(b(day[k]));
      }
    }
  });

  it("is a real transform of the pixels, not an overlay", () => {
    // #FFFFFF has nothing to hide behind: if the mode worked by laying a warm
    // sheet over the top, white would still be reported as white.
    const warmed = stripBlue("#FFFFFF");
    const b = parseInt(warmed.slice(5, 7), 16);
    expect(b).toBeLessThan(200);
    expect(parseInt(warmed.slice(1, 3), 16)).toBe(255);
  });

  it("rewrites colours inside rgba() and box-shadow strings too", () => {
    expect(stripBlue("rgba(143, 176, 227, 0.4)")).toMatch(/^rgba\(143, \d+, \d+, 0\.4\)$/);
    expect(stripBlue("0 4px 16px rgba(0,0,0,0.34)")).toContain("0 4px 16px");
  });

  it("holds every readability promise the daylight palettes hold", () => {
    for (const theme of BOTH) {
      const t = deriveTokens(theme, DEFAULT_HUE, true);
      expect(contrastRatio(t.ink, t.bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(t.ink, t.card)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(t.sub, t.card)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(t.subtle, t.faint)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(t.muted, t.faint)).toBeGreaterThanOrEqual(3);
      for (const k of ["good", "warn", "alert", "bad"] as const) {
        expect(contrastRatio(t[k], t.card), k).toBeGreaterThanOrEqual(3);
      }
      for (const k of ["sageText", "lavenderText", "clayText"] as const) {
        expect(contrastRatio(t[k], t.card), k).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("pulls the accent into the warm band whatever the slider says", () => {
    // An accent is the largest saturated area on screen. Letting it stay blue
    // would leave the mode's one promise unkept at the loudest point.
    for (const h of EVERY_HUE) {
      const e = effectiveHue(h, true);
      expect(e, `h${h}`).toBeGreaterThanOrEqual(NIGHT_HUE_MIN);
      expect(e, `h${h}`).toBeLessThanOrEqual(NIGHT_HUE_MAX);
    }
  });

  it("still lets the slider do something inside that band", () => {
    expect(effectiveHue(0, true)).not.toBe(effectiveHue(350, true));
  });

  it("persists and re-reads across a reload", () => {
    setNightLight(true);
    expect(localStorage.getItem(NIGHT_STORAGE_KEY)).toBe("1");
    initTheme();
    expect(getNightLight()).toBe(true);
    setNightLight(false);
  });
});

describe("the backdrop choice", () => {
  it("defaults to fog, and remembers any of the three", () => {
    expect(getBackdrop()).toBe("fog");
    for (const style of BACKDROP_STYLES) {
      setBackdrop(style);
      expect(localStorage.getItem(BACKDROP_STORAGE_KEY)).toBe(style);
      initTheme();
      expect(getBackdrop()).toBe(style);
    }
  });

  it("publishes the choice on :root so CSS can act on it without a render", () => {
    setBackdrop("aurora");
    expect(document.documentElement.dataset.backdrop).toBe("aurora");
    setNightLight(true);
    expect(document.documentElement.dataset.night).toBe("on");
    setNightLight(false);
    expect(document.documentElement.dataset.night).toBe("off");
  });

  it("ignores a stored value that isn't a style", () => {
    localStorage.setItem(BACKDROP_STORAGE_KEY, "kaleidoscope");
    initTheme();
    expect(getBackdrop()).toBe("fog");
  });
});

describe("appearance subscribers", () => {
  /* onThemeChange passes the theme name, so a hue change looks like no change
     at all to React and the tree never re-renders. This is the subscription
     that exists for that case, and this is the test that would have caught it. */
  it("fires for a hue change, which never alters the theme name", () => {
    const seen: number[] = [];
    const off = onAppearanceChange((r) => seen.push(r));
    setHue(10);
    setHue(20);
    setNightLight(true);
    setBackdrop("off");
    off();
    setHue(30);
    expect(seen.length).toBe(4);
    expect(new Set(seen).size).toBe(4); // strictly increasing revisions
  });
});

describe("readableInk", () => {
  it("picks dark text on a light swatch and light text on a dark one", () => {
    expect(readableInk("#FFFFFF")).toBe("#12151C");
    expect(readableInk("#000000")).toBe("#FFFFFF");
  });

  it("clears AA against every severity colour it is used with", () => {
    for (const p of Object.values(PALETTES)) {
      for (const step of ["good", "warn", "alert", "bad"] as const) {
        expect(contrast(readableInk(p[step]), p[step]), `${step}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("survives a non-colour without throwing", () => {
    expect(readableInk("var(--nope)")).toBeTruthy();
  });
});
