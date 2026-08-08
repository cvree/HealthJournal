/* Providers, model discovery, and recovery.

   This file exists because of a real outage. The first version hard-coded
   `gemini-2.5-flash`; Google retired it for newly-created keys months before
   the published shutdown date, and every new user got a 404 from a build that
   had worked the week before. Nothing here lets a model name become
   load-bearing again. */
import { describe, it, expect, afterEach, vi } from "vitest";
import {
  PROVIDERS, providerOf, baseUrlFor, scoreModel, pickModel, listModels,
  isModelGone, OPENAI_NOTE, type Connection,
} from "../src/lib/aiProviders";
import { runPatternAnalysis, testConnection, buildAnalysisInput, clearKey } from "../src/lib/ai";

const KEY = "AQ.Ab8RN6JexampleEXAMPLEexample1234wxyz";

const FIELDS = [{ k: "itch", label: "Itch", type: "scale", dir: "sym" }];
const enoughDays = () =>
  buildAnalysisInput(
    FIELDS,
    Array.from({ length: 6 }, (_, i) => ({ date: `2026-06-0${i + 1}`, answers: { itch: i + 1 } })),
    "2026-06-01", "2026-06-30"
  );

afterEach(async () => { vi.unstubAllGlobals(); await clearKey(); });

describe("provider catalogue", () => {
  it("offers Gemini as the recommended route", () => {
    expect(PROVIDERS.gemini.recommended).toBe(true);
    expect(PROVIDERS.gemini.keyUrl).toContain("aistudio.google.com");
  });

  it("gives every provider what the wizard needs to walk someone through it", () => {
    for (const p of Object.values(PROVIDERS)) {
      expect(p.label).toBeTruthy();
      expect(p.blurb).toBeTruthy();
      expect(p.free).toBeTruthy();
      expect(p.keyHint).toBeTruthy();
      expect(p.steps.length).toBeGreaterThanOrEqual(3);
      p.steps.forEach(([title, body]) => {
        expect(title).toBeTruthy();
        expect(body).toBeTruthy();
      });
      // Anything without its own console must ask for an endpoint instead.
      if (!p.keyUrl) expect(p.needsBaseUrl).toBe(true);
    }
  });

  it("explains the OpenAI situation rather than leaving people to hit the wall", () => {
    expect(OPENAI_NOTE).toMatch(/browser/i);
    expect(OPENAI_NOTE).toMatch(/server/i);
  });

  it("falls back to Gemini for an unknown provider id", () => {
    expect(providerOf(undefined as any).id).toBe("gemini");
    expect(providerOf("nonsense" as any).id).toBe("gemini");
  });

  it("uses the provider's own base URL unless a custom one is given", () => {
    expect(baseUrlFor({ provider: "gemini", key: KEY })).toContain("generativelanguage");
    expect(baseUrlFor({ provider: "custom", key: KEY, baseUrl: "https://x.test/v1/" })).toBe("https://x.test/v1");
  });
});

describe("model scoring picks something sane without knowing the names", () => {
  it("rejects models that can't answer a chat request", () => {
    for (const id of ["text-embedding-004", "imagen-4.0", "gemini-tts", "whisper-large", "sora-2"]) {
      expect(scoreModel(id), id).toBeLessThan(0);
    }
  });

  it("prefers a newer version of the same family", () => {
    expect(scoreModel("gemini-3.5-flash")).toBeGreaterThan(scoreModel("gemini-2.5-flash"));
  });

  it("prefers small fast models over frontier ones for this job", () => {
    expect(scoreModel("gemini-3.5-flash")).toBeGreaterThan(scoreModel("gemini-3.5-pro"));
    expect(scoreModel("claude-haiku-4.5")).toBeGreaterThan(scoreModel("claude-opus-4.5"));
  });

  it("prefers a free model when one is on offer", () => {
    expect(scoreModel("meta-llama/llama-3.3-70b-instruct:free"))
      .toBeGreaterThan(scoreModel("meta-llama/llama-3.3-70b-instruct"));
  });

  it("avoids preview and thinking variants when a stable one exists", () => {
    expect(scoreModel("gemini-3.5-flash")).toBeGreaterThan(scoreModel("gemini-3.5-flash-preview"));
    expect(scoreModel("gemini-3.5-flash")).toBeGreaterThan(scoreModel("gemini-3.5-flash-thinking"));
  });

  it("picks the best of what a key can actually see", () => {
    expect(pickModel([
      "text-embedding-004", "gemini-2.5-flash", "gemini-3.5-flash", "gemini-3.5-pro",
    ])).toBe("gemini-3.5-flash");
  });

  it("returns null rather than guessing when nothing is usable", () => {
    expect(pickModel([])).toBeNull();
    expect(pickModel(["text-embedding-004", "imagen-4.0"])).toBeNull();
  });

  it("would have survived the outage that caused all this", () => {
    // The list a new key sees now that 2.5 is gone: no hard-coded name to miss.
    expect(pickModel(["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-3.5-pro"])).toBeTruthy();
  });
});

describe("listing models", () => {
  it("reads Google's shape and drops anything that can't generate", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        models: [
          { name: "models/gemini-3.5-flash", supportedGenerationMethods: ["generateContent"] },
          { name: "models/text-embedding-004", supportedGenerationMethods: ["embedContent"] },
        ],
      }),
    }) as any));
    const ids = await listModels({ provider: "gemini", key: KEY });
    expect(ids).toEqual(["gemini-3.5-flash"]);
  });

  it("reads the OpenAI-compatible shape", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: [{ id: "llama-3.3-70b:free" }, { id: "gpt-oss-20b" }] }),
    }) as any));
    const ids = await listModels({ provider: "openrouter", key: "sk-or-v1-example" });
    expect(ids).toEqual(["llama-3.3-70b:free", "gpt-oss-20b"]);
  });

  it("authenticates Google by header and the rest by bearer token", async () => {
    const calls: any[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: any) => {
      calls.push({ url, init });
      return { ok: true, json: async () => ({ models: [], data: [] }) } as any;
    }));
    await listModels({ provider: "gemini", key: KEY });
    expect(calls[0].init.headers["x-goog-api-key"]).toBe(KEY);
    await listModels({ provider: "openrouter", key: "sk-or-v1-example" });
    expect(calls[1].init.headers.Authorization).toBe("Bearer sk-or-v1-example");
  });
});

describe("testConnection is the whole check in one round trip", () => {
  it("confirms the key, the endpoint, and that a usable model exists", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ models: [{ name: "models/gemini-3.5-flash" }] }),
    }) as any));
    const res = await testConnection({ provider: "gemini", key: KEY });
    expect(res.ok).toBe(true);
    expect(res.model).toBe("gemini-3.5-flash");
  });

  it("says so when the key works but nothing usable is behind it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true, json: async () => ({ models: [{ name: "models/text-embedding-004" }] }),
    }) as any));
    const res = await testConnection({ provider: "gemini", key: KEY });
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/no usable chat model/i);
  });

  it("names CORS as the likely cause for a custom endpoint that won't answer", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    const res = await testConnection({ provider: "custom", key: KEY, baseUrl: "https://nope.test/v1" });
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/CORS/);
  });

  it("asks for an endpoint before spending a request on a custom provider", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await testConnection({ provider: "custom", key: KEY });
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/endpoint/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a rejected key with advice, not a status code", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 401, text: async () => "bad key" }) as any));
    const res = await testConnection({ provider: "gemini", key: KEY });
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/rejected that key/i);
  });
});

describe("a retired model recovers itself", () => {
  it("recognises the shapes providers use to say a model is gone", () => {
    expect(isModelGone(404, "This model models/gemini-2.5-flash is no longer available")).toBe(true);
    expect(isModelGone(404, "model not found")).toBe(true);
    expect(isModelGone(400, "The model has been deprecated")).toBe(true);
    expect(isModelGone(429, "rate limited")).toBe(false);
    expect(isModelGone(404, "user not found")).toBe(false);
  });

  it("re-resolves and retries instead of surfacing the exact 404 that broke this feature", async () => {
    const seen: string[] = [];
    let served = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const u = String(url);
      seen.push(u);
      if (u.endsWith("/models")) {
        return { ok: true, json: async () => ({ models: [{ name: "models/gemini-3.5-flash" }] }) } as any;
      }
      // The stale model 404s once; the freshly-resolved one answers.
      if (u.includes("gemini-2.5-flash") && served++ === 0) {
        return {
          ok: false, status: 404,
          text: async () => 'This model models/gemini-2.5-flash is no longer available to new users.',
        } as any;
      }
      return {
        ok: true,
        json: async () => ({ candidates: [{ content: { parts: [{ text: '{"patterns":[]}' }] } }] }),
      } as any;
    }));

    const out = await runPatternAnalysis(
      { provider: "gemini", key: KEY, model: "gemini-2.5-flash" },
      enoughDays()
    );
    expect(out.patterns).toEqual([]);
    expect(seen.some((u) => u.includes("gemini-2.5-flash"))).toBe(true);
    expect(seen.some((u) => u.includes("gemini-3.5-flash"))).toBe(true);
  });

  it("gives up after one retry rather than looping on a broken provider", async () => {
    let chats = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (String(url).endsWith("/models")) {
        return { ok: true, json: async () => ({ models: [{ name: "models/gemini-3.5-flash" }] }) } as any;
      }
      chats++;
      return { ok: false, status: 404, text: async () => "model not found" } as any;
    }));
    await expect(
      runPatternAnalysis({ provider: "gemini", key: KEY, model: "gemini-2.5-flash" }, enoughDays())
    ).rejects.toBeTruthy();
    expect(chats).toBe(2); // the original attempt and exactly one retry
  });

  it("resolves a model on its own when the connection has none stored", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      urls.push(String(url));
      if (String(url).endsWith("/models")) {
        return { ok: true, json: async () => ({ models: [{ name: "models/gemini-3.5-flash" }] }) } as any;
      }
      return {
        ok: true,
        json: async () => ({ candidates: [{ content: { parts: [{ text: '{"patterns":[]}' }] } }] }),
      } as any;
    }));
    const out = await runPatternAnalysis({ provider: "gemini", key: KEY }, enoughDays());
    expect(out.model).toBe("gemini-3.5-flash");
    expect(urls.some((u) => u.includes("gemini-3.5-flash:generateContent"))).toBe(true);
  });
});

describe("OpenAI-compatible providers", () => {
  const conn: Connection = {
    provider: "openrouter", key: "sk-or-v1-example", model: "llama-3.3-70b:free",
  };

  it("posts chat completions with a system and user message", async () => {
    let body: any = null;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: any) => {
      if (String(url).endsWith("/models")) {
        return { ok: true, json: async () => ({ data: [{ id: "llama-3.3-70b:free" }] }) } as any;
      }
      body = JSON.parse(init.body);
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: '{"patterns":[]}' } }] }),
      } as any;
    }));
    await runPatternAnalysis(conn, enoughDays());
    expect(body.model).toBe("llama-3.3-70b:free");
    expect(body.messages.map((m: any) => m.role)).toEqual(["system", "user"]);
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("unwraps a markdown fence some models add despite being told not to", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (String(url).endsWith("/models")) {
        return { ok: true, json: async () => ({ data: [{ id: "llama-3.3-70b:free" }] }) } as any;
      }
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '```json\n{"patterns":[],"note":"Steady."}\n```' } }],
        }),
      } as any;
    }));
    const out = await runPatternAnalysis(conn, enoughDays());
    expect(out.note).toBe("Steady.");
  });
});
