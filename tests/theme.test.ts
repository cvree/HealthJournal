/* Theme tokens and preference handling.

   The load-bearing promises: dark unless someone chose otherwise, the choice
   survives a reload, every token exists in both palettes, and the contrast
   pairs the UI actually uses clear WCAG AA. That last group is the reason a
   redesign can't quietly regress into unreadable grey-on-grey. */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  PALETTES, C, luminance, readableInk, initTheme, setThemePreference,
  readThemePreference, getTheme, getThemePreference, resolveTheme, onThemeChange,
  THEME_STORAGE_KEY,
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
    expect(root.style.getPropertyValue("--fhj-accent-text")).toBe(PALETTES.light.accentText);
    expect(root.style.getPropertyValue("--fhj-line-strong")).toBe(PALETTES.light.lineStrong);
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
    });
  }
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
