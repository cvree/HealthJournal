/* Food and bowel analysis.

   Two guarantees are load-bearing here and neither is visible in the happy
   path, so both get pinned:

   1. **An image is only ever on the wire because the user asked for it.** No
      call path sends one implicitly, and the text-only path must be provably
      image-free.
   2. **The bowel path never returns a diagnosis.** The prompt says so four
      times, but a prompt is a request, not a guarantee — `normaliseBowelResult`
      is the guarantee, so it is tested against output that ignores it. */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  analyseFood, analyseBowelPhoto, normaliseBowelResult, isDiagnosticText,
  summariseFoodRequest, AiError,
} from "../src/lib/ai";
import { isNoVision } from "../src/lib/aiProviders";

const KEY = "AQ.Ab8RN6JexampleEXAMPLEexample1234wxyz";
const CONN = { provider: "gemini" as const, key: KEY, model: "gemini-9-flash" };
const IMAGE = { mime: "image/jpeg", data: "QUJDREVGRw==" };

/** Mock a Gemini round trip and hand back every request body seen. */
function mockGemini(reply: unknown) {
  const bodies: any[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: any) => {
    if (String(url).endsWith("/models")) {
      return { ok: true, json: async () => ({ models: [{ name: "models/gemini-9-flash" }] }) } as any;
    }
    bodies.push(JSON.parse(init.body));
    return {
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(reply) }] } }] }),
    } as any;
  }));
  return bodies;
}

function mockFailure(status: number, body: string) {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (String(url).endsWith("/models")) {
      return { ok: true, json: async () => ({ models: [{ name: "models/gemini-9-flash" }] }) } as any;
    }
    return { ok: false, status, text: async () => body } as any;
  }));
}

afterEach(() => vi.unstubAllGlobals());

describe("nothing is sent that the user did not offer", () => {
  it("sends no image on the text-only path", async () => {
    const bodies = mockGemini({ nutrition: { calories: 400 }, confidence: "medium" });
    await analyseFood(CONN, { description: "Two eggs on toast" });
    const wire = JSON.stringify(bodies[0]);
    expect(wire).not.toContain("inlineData");
    expect(wire).not.toContain("image");
    expect(wire).toContain("Two eggs on toast");
  });

  it("sends the image only when one was passed in", async () => {
    const bodies = mockGemini({ nutrition: { calories: 400 }, confidence: "low" });
    await analyseFood(CONN, { description: "lunch", image: IMAGE });
    const parts = bodies[0].contents[0].parts;
    expect(parts[0].inlineData.data).toBe(IMAGE.data);
    expect(parts[0].inlineData.mimeType).toBe("image/jpeg");
  });

  it("refuses to send anything at all when there is nothing to analyse", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await expect(analyseFood(CONN, {})).rejects.toBeInstanceOf(AiError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("describes the payload before it goes, for the confirmation sheet", () => {
    expect(summariseFoodRequest({ description: "Soup", serving: "1 bowl" }))
      .toEqual({ sendsPhoto: false, sendsText: true, textParts: ["Soup", "1 bowl"] });
    expect(summariseFoodRequest({ image: IMAGE }))
      .toEqual({ sendsPhoto: true, sendsText: false, textParts: [] });
    expect(summariseFoodRequest({ quantity: 150, unit: "g" }).textParts).toEqual(["150 g"]);
  });

  it("never puts the key in the URL", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: any) => {
      calls.push(String(url));
      if (String(url).endsWith("/models")) {
        return { ok: true, json: async () => ({ models: [{ name: "models/gemini-9-flash" }] }) } as any;
      }
      return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: "{}" }] } }] }) } as any;
    }));
    await analyseFood(CONN, { description: "toast" });
    for (const u of calls) expect(u).not.toContain(KEY);
  });
});

describe("the three food modes", () => {
  it("tells the model when it has a photo and nothing else", async () => {
    const bodies = mockGemini({ identified: "Bowl of soup", nutrition: {}, confidence: "low" });
    const res = await analyseFood(CONN, { image: IMAGE });
    expect(res.source).toBe("photo");
    expect(JSON.stringify(bodies[0])).toContain("did not describe it");
  });

  it("marks a text-only run as text", async () => {
    mockGemini({ nutrition: { calories: 300 }, confidence: "medium" });
    expect((await analyseFood(CONN, { description: "porridge" })).source).toBe("text");
  });

  it("marks a combined run as photo+text", async () => {
    mockGemini({ nutrition: { calories: 300 }, confidence: "high" });
    const res = await analyseFood(CONN, { description: "porridge", image: IMAGE });
    expect(res.source).toBe("photo+text");
  });

  it("instructs the model that a stated quantity outranks its own guess", async () => {
    const bodies = mockGemini({ nutrition: { calories: 300 }, confidence: "high" });
    await analyseFood(CONN, { description: "rice", quantity: 150, unit: "g", image: IMAGE });
    const wire = JSON.stringify(bodies[0]);
    expect(wire).toContain("150 g");
    expect(wire).toMatch(/treat these as fact/i);
    // and the system prompt carries the same rule, independent of the user turn
    expect(wire).toMatch(/TREAT THAT AS FACT/);
  });

  it("returns what the model thinks the food is, so a photo can be checked", async () => {
    mockGemini({ identified: "Grilled salmon with greens", nutrition: { calories: 480 }, confidence: "medium" });
    const res = await analyseFood(CONN, { image: IMAGE });
    expect(res.identified).toBe("Grilled salmon with greens");
  });
});

describe("model output is not trusted", () => {
  it("drops nutrition values that are impossible", async () => {
    mockGemini({
      nutrition: { calories: -100, protein: "lots", carbs: 1e9, fat: 22, fiber: 3 },
      confidence: "high",
    });
    const res = await analyseFood(CONN, { description: "x" });
    expect(res.nutrition).toEqual({ fat: 22, fiber: 3 });
  });

  it("caps and cleans the micronutrient list", async () => {
    mockGemini({
      nutrition: {
        calories: 100,
        micros: [
          ...Array.from({ length: 20 }, (_, i) => ({ label: `M${i}`, amount: "1 mg" })),
          { label: "", amount: "2 mg" },
          "not an object",
        ],
      },
      confidence: "low",
    });
    const res = await analyseFood(CONN, { description: "x" });
    expect(res.nutrition.micros!.length).toBeLessThanOrEqual(8);
    expect(res.nutrition.micros!.every((m) => m.label && m.amount)).toBe(true);
  });

  it("defaults an unrecognised confidence to the cautious end", async () => {
    mockGemini({ nutrition: { calories: 100 }, confidence: "certain" });
    expect((await analyseFood(CONN, { description: "x" })).confidence).toBe("low");
  });

  it("softens causal language in the food note", async () => {
    mockGemini({
      nutrition: { calories: 100 },
      confidence: "low",
      note: "The high sodium causes bloating.",
    });
    const res = await analyseFood(CONN, { description: "x" });
    expect(res.note).not.toMatch(/causes/i);
    expect(res.note).toMatch(/coincides with/i);
  });

  it("survives a model that wraps its JSON in a markdown fence", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (String(url).endsWith("/models")) {
        return { ok: true, json: async () => ({ models: [{ name: "models/gemini-9-flash" }] }) } as any;
      }
      return {
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: '```json\n{"nutrition":{"calories":250},"confidence":"low"}\n```' }] } }],
        }),
      } as any;
    }));
    expect((await analyseFood(CONN, { description: "x" })).nutrition.calories).toBe(250);
  });
});

describe("the bowel path never diagnoses", () => {
  it("keeps plain descriptive fields", () => {
    const r = normaliseBowelResult(
      { bristol: 4, color: "dark brown", consistency: "formed", form: "single smooth log", confidence: "medium" },
      "m"
    );
    expect(r.bristol).toBe(4);
    expect(r.color).toBe("dark brown");
    expect(r.consistency).toBe("formed");
    expect(r.form).toBe("single smooth log");
  });

  it("drops a field that has turned into an interpretation", () => {
    const r = normaliseBowelResult({
      bristol: 6,
      color: "pale, which can indicate a liver condition",
      consistency: "loose — this is abnormal",
      form: "fragmented",
      confidence: "high",
    });
    expect(r.color).toBeUndefined();
    expect(r.consistency).toBeUndefined();
    expect(r.form).toBe("fragmented"); // the one that stayed descriptive
    expect(r.bristol).toBe(6);
  });

  it("drops a note that strays into advice", () => {
    expect(normaliseBowelResult({ confidence: "low", note: "You should see a doctor about this." }).note)
      .toBeUndefined();
    expect(normaliseBowelResult({ confidence: "low", note: "This looks normal." }).note).toBeUndefined();
    expect(normaliseBowelResult({ confidence: "low", note: "Lighting makes the colour hard to judge." }).note)
      .toBe("Lighting makes the colour hard to judge.");
  });

  it("recognises the language it must refuse", () => {
    for (const bad of [
      "possible IBS", "signs of an infection", "consult your doctor", "this is concerning",
      "appears abnormal", "may indicate celiac disease", "I recommend a stool test",
    ]) {
      expect(isDiagnosticText(bad), bad).toBe(true);
    }
    for (const ok of ["dark brown", "single smooth log", "several soft pieces", "watery"]) {
      expect(isDiagnosticText(ok), ok).toBe(false);
    }
  });

  it("clamps Bristol to the scale's real range", () => {
    expect(normaliseBowelResult({ bristol: 0, confidence: "low" }).bristol).toBeUndefined();
    expect(normaliseBowelResult({ bristol: 9, confidence: "low" }).bristol).toBeUndefined();
    expect(normaliseBowelResult({ bristol: 3.4, confidence: "low" }).bristol).toBe(3);
  });

  it("accepts an entirely empty answer as a valid one", () => {
    const r = normaliseBowelResult({ confidence: "low" });
    expect(r.bristol).toBeUndefined();
    expect(r.color).toBeUndefined();
    expect(r.confidence).toBe("low");
  });

  it("sends the image and the no-diagnosis instructions together", async () => {
    const bodies = mockGemini({ bristol: 4, confidence: "medium" });
    await analyseBowelPhoto(CONN, IMAGE);
    const wire = JSON.stringify(bodies[0]);
    expect(wire).toContain(IMAGE.data);
    expect(wire).toMatch(/Never name, suggest, hint at/);
    expect(wire).toMatch(/ABSOLUTE RULES/);
  });

  it("refuses without a photo rather than sending an empty request", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await expect(analyseBowelPhoto(CONN, { mime: "image/jpeg", data: "" })).rejects.toBeInstanceOf(AiError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("failures a person can act on", () => {
  it("names the text-only-model problem instead of showing a raw 400", async () => {
    mockFailure(400, "This model does not support image input.");
    await expect(analyseFood(CONN, { description: "x", image: IMAGE }))
      .rejects.toThrow(/reads text but not images/i);
  });

  it("recognises the shapes providers use to say that", () => {
    expect(isNoVision(400, "model does not support vision")).toBe(true);
    expect(isNoVision(415, "image input not supported for this model")).toBe(true);
    expect(isNoVision(400, "this model only supports text")).toBe(true);
    // A generic 400 must not be misread as a vision problem.
    expect(isNoVision(400, "missing required field")).toBe(false);
    expect(isNoVision(500, "model does not support vision")).toBe(false);
  });

  it("does not claim a vision problem on the text path", async () => {
    mockFailure(400, "This model does not support image input.");
    await expect(analyseFood(CONN, { description: "x" })).rejects.not.toThrow(/reads text but not images/i);
  });

  it("keeps the key out of an error message that echoes the request", async () => {
    mockFailure(400, `bad request for key=${KEY}`);
    await expect(analyseFood(CONN, { description: "x" })).rejects.toSatisfy((e: Error) => {
      expect(e.message).not.toContain(KEY);
      return true;
    });
  });

  it("explains an expired key rather than restating the status code", async () => {
    mockFailure(401, "unauthorized");
    await expect(analyseFood(CONN, { description: "x" })).rejects.toThrow(/rejected that key/i);
  });

  it("re-resolves once when the chosen model has been retired", async () => {
    let chatCalls = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (String(url).endsWith("/models")) {
        return { ok: true, json: async () => ({ models: [{ name: "models/gemini-9-flash" }] }) } as any;
      }
      chatCalls += 1;
      if (chatCalls === 1) {
        return { ok: false, status: 404, text: async () => "model gemini-old is no longer available" } as any;
      }
      return {
        ok: true,
        json: async () => ({ candidates: [{ content: { parts: [{ text: '{"nutrition":{"calories":300},"confidence":"low"}' }] } }] }),
      } as any;
    }));
    const res = await analyseFood({ provider: "gemini", key: KEY, model: "gemini-old" }, { description: "x" });
    expect(res.nutrition.calories).toBe(300);
    expect(chatCalls).toBe(2); // tried once, re-resolved, succeeded — and stopped
  });
});

describe("the bowel path judges amount too", () => {
  it("keeps one of the three buckets the form offers", () => {
    for (const amount of ["small", "medium", "large"]) {
      expect(normaliseBowelResult({ amount, confidence: "medium" }).amount).toBe(amount);
    }
    expect(normaliseBowelResult({ amount: "LARGE", confidence: "medium" }).amount).toBe("large");
  });

  it("drops anything outside them rather than mapping it by guesswork", () => {
    for (const amount of ["moderate", "a fair bit", "3", "", null, undefined]) {
      expect(normaliseBowelResult({ amount, confidence: "low" }).amount).toBeUndefined();
    }
  });

  it("asks for it in the prompt, so the model has a chance of returning it", async () => {
    const bodies = mockGemini({ bristol: 4, amount: "medium", confidence: "high" });
    const r = await analyseBowelPhoto(CONN, IMAGE);
    expect(r.amount).toBe("medium");
    const sent = JSON.stringify(bodies[bodies.length - 1]);
    expect(sent).toContain("amount");
    expect(sent).toContain("small");
  });
});
