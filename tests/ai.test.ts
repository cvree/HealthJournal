/* Optional AI pattern analysis.

   The interesting tests here are the negative ones: what does *not* leave the
   device, what does *not* end up in a backup, and what happens to output that
   ignores the "no causation" instruction. Those are the promises the Settings
   copy makes on the app's behalf, so they get pinned. */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  buildAnalysisInput, summariseInput, normaliseAnalysis, scrubCausalLanguage,
  maskKey, looksLikeKey, redact, strengthLabel, testApiKey, runPatternAnalysis,
  saveKey, loadKey, clearKey, hasStoredKey, AiError,
} from "../src/lib/ai";
import { __internals as I } from "../src/App";

const FIELDS = [
  { k: "itch", label: "Itch", type: "scale", dir: "sym" },
  { k: "sleep_quality", label: "Sleep quality", type: "scale", dir: "pos" },
  { k: "moisturized", label: "Moisturized today", type: "toggle" },
  { k: "weight", label: "Weight", type: "number", unit: "lb", dir: "neutral" },
  { k: "notes_field", label: "Free text", type: "text" },
  { k: "triggers", label: "Possible triggers", type: "chips" },
  { k: "hidden", label: "Not charted", type: "scale", chart: false },
];

const ENTRIES = [
  { date: "2026-06-01", answers: { itch: 6, sleep_quality: 4, moisturized: true, weight: 201.15, notes_field: "scratched all night", triggers: ["heat"], hidden: 3 } },
  { date: "2026-06-02", answers: { itch: 3, sleep_quality: 8, moisturized: false } },
  { date: "2026-06-03", answers: {} },                    // nothing usable
  { date: "2026-05-01", answers: { itch: 9 } },           // before the window
  { date: "2026-07-01", answers: { itch: 1 } },           // after the window
];

describe("buildAnalysisInput — only the minimum leaves the device", () => {
  const input = buildAnalysisInput(FIELDS, ENTRIES, "2026-06-01", "2026-06-30");
  const wire = JSON.stringify(input);

  it("sends no free text, chips, or photos", () => {
    expect(wire).not.toContain("scratched all night");
    expect(wire).not.toContain("heat");
    expect(wire).not.toContain("Free text");
    expect(wire).not.toContain("Possible triggers");
  });

  it("omits fields the user excluded from charts", () => {
    expect(wire).not.toContain("Not charted");
    expect(input.fields.map((f) => f.k)).not.toContain("hidden");
  });

  it("clips to the window on both sides", () => {
    // 2026-06-01 and 06-02 only: 05-01 and 07-01 are outside, 06-03 is empty.
    expect(input.days).toHaveLength(2);
  });

  it("numbers days from the window start instead of sending dates", () => {
    expect(input.days[0].day).toBe(1);
    expect(input.days[1].day).toBe(2);
    expect(JSON.stringify(input.days)).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("keeps the weekday, which timing patterns need", () => {
    expect(input.days[0].weekday).toBe("Mon");
  });

  it("coerces booleans to 0/1 and rounds floats", () => {
    expect(input.days[0].values.moisturized).toBe(1);
    expect(input.days[1].values.moisturized).toBe(0);
    expect(input.days[0].values.weight).toBe(201.15);
  });

  it("only describes metrics that actually have answers", () => {
    // sleep_quality and moisturized appear; nothing else from the tail of the
    // field list should be described.
    expect(input.fields.map((f) => f.k).sort()).toEqual(["itch", "moisturized", "sleep_quality", "weight"]);
  });

  it("summarises itself in terms a person can check", () => {
    const s = summariseInput(input);
    expect(s.days).toBe(2);
    expect(s.metrics).toBe(4);
    expect(s.values).toBeGreaterThan(0);
    expect(s.approxKB).toBeGreaterThanOrEqual(1);
    expect(s.metricLabels).toContain("Itch");
  });

  it("sends nothing at all from a journal with no logged days", () => {
    const empty = buildAnalysisInput(FIELDS, [], "2026-06-01", "2026-06-30");
    expect(empty.days).toEqual([]);
    expect(empty.fields).toEqual([]);
  });
});

describe("causal language never survives to the UI", () => {
  it("softens the phrases the prompt forbids", () => {
    expect(scrubCausalLanguage("Stress causes flares")).toBe("Stress coincides with flares");
    expect(scrubCausalLanguage("because of heat")).toBe("alongside heat");
    expect(scrubCausalLanguage("this leads to worse days")).toBe("this is often followed by worse days");
    expect(scrubCausalLanguage("dairy triggers itch")).toBe("dairy co-occurs with itch");
    expect(scrubCausalLanguage("the data proves it")).toBe("the data suggests it");
  });

  it("scrubs every rendered field of a model response", () => {
    const input = buildAnalysisInput(FIELDS, ENTRIES, "2026-06-01", "2026-06-30");
    const out = normaliseAnalysis({
      patterns: [{
        title: "Stress causes flares", detail: "Because of stress, itch was higher.",
        evidence: "This proves the link and leads to worse days.",
        metrics: ["Itch"], strength: "moderate", kind: "co-occurrence", dayFrom: 1, dayTo: 2,
      }],
    }, input);
    const wire = JSON.stringify(out);
    expect(wire).not.toMatch(/\bcauses\b/i);
    expect(wire).not.toMatch(/\bbecause of\b/i);
    expect(wire).not.toMatch(/\bproves\b/i);
    expect(wire).not.toMatch(/\bleads to\b/i);
  });

  it("passes the app's own causal-language audit", async () => {
    const { causalLanguageAudit } = await import("../src/lib/validate");
    const input = buildAnalysisInput(FIELDS, ENTRIES, "2026-06-01", "2026-06-30");
    const out = normaliseAnalysis({
      patterns: [{
        title: "Itch caused by stress", detail: "It causes your flares.",
        evidence: "n=2", metrics: ["Itch"], strength: "weak", kind: "other",
      }],
    }, input);
    expect(causalLanguageAudit(out)).toEqual([]);
  });
});

describe("normaliseAnalysis — untrusted output becomes safe to render", () => {
  const input = buildAnalysisInput(FIELDS, ENTRIES, "2026-06-01", "2026-06-30");

  it("drops metric names the app never sent", () => {
    const out = normaliseAnalysis({
      patterns: [{ title: "t", detail: "d", evidence: "e", strength: "weak", kind: "other",
        metrics: ["Itch", "Blood pressure", "Cortisol"] }],
    }, input);
    expect(out.patterns[0].metrics).toEqual(["Itch"]);
  });

  it("falls back to the weakest strength for an unknown value", () => {
    const out = normaliseAnalysis({
      patterns: [{ title: "t", detail: "d", evidence: "e", strength: "certain", kind: "other", metrics: [] }],
    }, input);
    expect(out.patterns[0].strength).toBe("weak");
  });

  it("clamps day ranges to the window and renders them as dates", () => {
    const out = normaliseAnalysis({
      patterns: [{ title: "t", detail: "d", evidence: "e", strength: "weak", kind: "other",
        metrics: [], dayFrom: -50, dayTo: 9999 }],
    }, input);
    expect(out.patterns[0].range).toMatch(/^\w{3} \d+ – \w{3} \d+$/);
  });

  it("caps the list and discards patterns with no title or detail", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      title: i === 0 ? "" : `p${i}`, detail: "d", evidence: "e", strength: "weak", kind: "other", metrics: [],
    }));
    const out = normaliseAnalysis({ patterns: many }, input);
    expect(out.patterns.length).toBeLessThanOrEqual(6);
    expect(out.patterns.every((p) => p.title && p.detail)).toBe(true);
  });

  it("survives junk without throwing", () => {
    expect(normaliseAnalysis(null, input).patterns).toEqual([]);
    expect(normaliseAnalysis({ patterns: "nope" }, input).patterns).toEqual([]);
    expect(normaliseAnalysis({}, input).patterns).toEqual([]);
  });

  it("carries the note through when the model found nothing", () => {
    const out = normaliseAnalysis({ patterns: [], note: "Nothing repeated often enough." }, input);
    expect(out.patterns).toEqual([]);
    expect(out.note).toContain("Nothing repeated");
  });

  it("describes strength in words, never as a number", () => {
    for (const s of ["weak", "moderate", "strong"] as const) {
      const { label, help } = strengthLabel(s);
      expect(label).toBeTruthy();
      expect(help).toBeTruthy();
      expect(label).not.toMatch(/\d/);
    }
  });
});

describe("the key is handled like a credential", () => {
  const KEY = "AIzaSyEXAMPLEexampleEXAMPLEexample1234";

  beforeEach(async () => { await clearKey(); });
  afterEach(async () => { await clearKey(); vi.unstubAllGlobals(); });

  it("only ever shows a masked form", () => {
    expect(maskKey(KEY)).toBe("AIzaS…1234");
    expect(maskKey(KEY)).not.toContain("EXAMPLE");
    expect(maskKey("short")).not.toContain("short");
  });

  it("masks the newer AQ. key format too", () => {
    const aq = "AQ.Ab8RN6JexampleEXAMPLEexample1234wxyz";
    expect(maskKey(aq)).toBe("AQ.Ab…wxyz");
    expect(maskKey(aq)).not.toContain("example");
  });

  it("redacts key-shaped strings out of anything headed for the screen", () => {
    expect(redact(`bad request for key=${KEY}`)).not.toContain(KEY);
    expect(redact("quota exceeded", KEY)).toBe("quota exceeded");
  });

  it("redacts every credential format the app can be given, not just Google's old one", () => {
    const aq = "AQ.Ab8RN6JexampleEXAMPLEexample1234wxyz";
    const sk = "sk-or-v1-exampleEXAMPLEexampleEXAMPLE1234";
    expect(redact(`failed with ${aq}`)).not.toContain(aq);
    expect(redact(`failed with ${sk}`)).not.toContain(sk);
    expect(redact("Authorization: Bearer abcdefghijklmnopqrstuvwx")).toContain("[key hidden]");
  });

  it("rejects obvious non-keys before making a request", async () => {
    expect(looksLikeKey(KEY)).toBe(true);
    expect(looksLikeKey("   ")).toBe(false);
    expect(looksLikeKey("has a space in it")).toBe(false);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const res = await testApiKey("nope");
    expect(res.ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("session mode never writes the key to storage", async () => {
    await saveKey(KEY, "session");
    expect(await loadKey()).toBe(KEY);          // usable this tab
    expect(await hasStoredKey()).toBe(false);   // but nothing persisted
  });

  it("persist mode stores it, and clearing removes it", async () => {
    await saveKey(KEY, "persist");
    expect(await hasStoredKey()).toBe(true);
    await clearKey();
    expect(await hasStoredKey()).toBe(false);
    expect(await loadKey()).toBe(null);
  });

  it("is never part of the journal blob a backup would contain", async () => {
    await saveKey(KEY, "persist");
    const db = I.migrateDb({ ...I.genSampleData(), ack: true, onboarded: true });
    expect(JSON.stringify(db)).not.toContain(KEY);
    expect(JSON.stringify(db)).not.toContain("AIza");
  });

  it("sends the key as a header, not in the URL where it would be logged", async () => {
    const calls: any[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: any) => {
      calls.push({ url, init });
      if (String(url).endsWith("/models")) {
        return { ok: true, json: async () => ({ models: [{ name: "models/gemini-9-flash" }] }) } as any;
      }
      return {
        ok: true,
        json: async () => ({ candidates: [{ content: { parts: [{ text: '{"patterns":[]}' }] } }] }),
      } as any;
    }));
    const input = buildAnalysisInput(
      FIELDS,
      Array.from({ length: 6 }, (_, i) => ({ date: `2026-06-0${i + 1}`, answers: { itch: i + 1 } })),
      "2026-06-01", "2026-06-30"
    );
    await runPatternAnalysis(KEY, input);
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) {
      expect(c.url).toContain("generativelanguage.googleapis.com");
      expect(c.url).not.toContain(KEY);
      expect(c.init.headers["x-goog-api-key"]).toBe(KEY);
    }
  });
});

describe("analysis error paths stay useful and quiet", () => {
  const KEY = "AIzaSyEXAMPLEexampleEXAMPLEexample1234";
  const enoughDays = () => buildAnalysisInput(
    FIELDS,
    Array.from({ length: 6 }, (_, i) => ({ date: `2026-06-0${i + 1}`, answers: { itch: i + 1 } })),
    "2026-06-01", "2026-06-30"
  );
  afterEach(() => vi.unstubAllGlobals());

  /** Model discovery always succeeds; the chat call behaves as the test wants. */
  const stubChat = (chatResponse: any) =>
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (String(url).endsWith("/models")) {
        return { ok: true, json: async () => ({ models: [{ name: "models/gemini-9-flash" }] }) } as any;
      }
      return typeof chatResponse === "function" ? chatResponse() : chatResponse;
    }));

  it("refuses to spend a request on too little data", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const thin = buildAnalysisInput(FIELDS, ENTRIES, "2026-06-01", "2026-06-30");
    await expect(runPatternAnalysis(KEY, thin)).rejects.toMatchObject({ kind: "not-enough-data" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("maps a rejected key to an actionable error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 403, text: async () => "denied" }) as any));
    await expect(runPatternAnalysis(KEY, enoughDays())).rejects.toMatchObject({ kind: "auth" });
  });

  it("maps rate limiting separately, so the advice differs", async () => {
    stubChat({ ok: false, status: 429, text: async () => "slow down" });
    await expect(runPatternAnalysis(KEY, enoughDays())).rejects.toMatchObject({ kind: "rate" });
  });

  it("never leaks the key through an error body", async () => {
    stubChat({ ok: false, status: 500, text: async () => `internal error processing key=${KEY}` });
    await expect(runPatternAnalysis(KEY, enoughDays())).rejects.toSatisfy(
      (e: AiError) => !e.message.includes(KEY) && e.message.includes("[key hidden]")
    );
  });

  it("turns a network failure into plain language, not a stack trace", async () => {
    stubChat(() => { throw new TypeError("Failed to fetch"); });
    await expect(runPatternAnalysis(KEY, enoughDays())).rejects.toMatchObject({ kind: "network" });
  });

  it("reports unparseable output rather than rendering it", async () => {
    stubChat({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: "not json" }] } }] }) });
    await expect(runPatternAnalysis(KEY, enoughDays())).rejects.toMatchObject({ kind: "response" });
  });
});
