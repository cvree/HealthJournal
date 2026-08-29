/* Which AI services this app can talk to, and how.

   Two hard constraints shape everything here.

   **1. There is no backend.** This is a static, local-first site, so every
   request goes straight from the user's browser to the provider. That means a
   provider is only usable if it sends CORS headers. OpenAI's API does not, so
   "just use ChatGPT" is not an option that exists for an app with no server —
   see OPENAI_NOTE, which is shown in the picker rather than left for people to
   discover by hitting a wall.

   **2. Model IDs rot.** The first version of this feature hard-coded
   `gemini-2.5-flash`, and Google retired it for new keys months before the
   published shutdown date — every new user got a 404 from a build that had
   worked fine the week before. So no model name is hard-coded as a
   requirement. Each provider lists what the *user's own key* can actually
   reach and a scorer picks the best of those, which also means a provider
   shipping a better model tomorrow needs no release here. */

export type ProviderId = "gemini" | "openrouter" | "custom";

/** An image to reason over. Base64 *without* the `data:` prefix — both wire
    formats want the bare payload, and carrying the prefix around is how it
    ends up double-encoded in one of them. */
export type ChatImage = {
  mime: string; // "image/jpeg" | "image/png" | …
  data: string; // base64
};

export type ChatRequest = {
  system: string;
  user: string;
  /** Optional image input. Only sent when the caller supplies one, which is
      only ever after the user has explicitly asked for photo analysis. */
  image?: ChatImage | null;
  /** Several images, for the one caller that reads a set of them at once —
      a chat log screenshotted in four goes is one document, and asking the
      model to read it four times loses the thread between them. Sent in the
      order given, before `image` if both are supplied. */
  images?: ChatImage[] | null;
  /** JSON schema the reply must match. Defaults to the pattern-analysis one so
      existing callers are unchanged. */
  schema?: Record<string, unknown>;
  /** Shape description appended to the system prompt for OpenAI-compatible
      providers, which accept `json_object` but not a schema. */
  jsonHint?: string;
  maxTokens?: number;
  signal?: AbortSignal;
};

export type Connection = {
  provider: ProviderId;
  key: string;
  /** Only meaningful for `custom`; the others carry their own. */
  baseUrl?: string;
  /** Chosen by `pickModel` at setup time, re-resolved if it ever 404s. */
  model?: string;
};

export type ProviderDef = {
  id: ProviderId;
  label: string;
  /** One line under the name in the picker. */
  blurb: string;
  /** What the free tier actually is, in the user's terms. */
  free: string;
  /** Set for the option we steer people to. */
  recommended?: boolean;
  /** Where to create a key. Empty for `custom`, which has no single console. */
  keyUrl: string;
  keyUrlLabel: string;
  /** Shown under the key field, e.g. "starts with AIza… or AQ.…". */
  keyHint: string;
  /** Numbered instructions for that provider's console. */
  steps: [string, string][];
  /** `custom` asks for an endpoint as well as a key. */
  needsBaseUrl?: boolean;
  defaultBaseUrl: string;
  baseUrlHint?: string;
};

export const OPENAI_NOTE =
  "OpenAI (ChatGPT) can't be offered here. Their API doesn't allow requests straight from a browser, so using it would mean running a server to relay your journal through — which is exactly the thing this app doesn't do. OpenRouter, listed here, can reach OpenAI's models on your behalf if you want them.";

export const PROVIDERS: Record<ProviderId, ProviderDef> = {
  gemini: {
    id: "gemini",
    label: "Google Gemini",
    blurb: "The simplest option. A Google account is all you need.",
    free: "Free tier, no card required.",
    recommended: true,
    keyUrl: "https://aistudio.google.com/app/apikey",
    keyUrlLabel: "Google AI Studio",
    keyHint: "Usually starts with “AQ.” — older keys start with “AIza”. Both work.",
    steps: [
      ["Sign in", "with any Google account. It's the same account you already use — nothing new to create."],
      ["Press “Create API key”", "on the page that opens. If it asks which project, any of them is fine."],
      ["Copy the key", "with the copy button next to it."],
      ["Come back here", "and paste it on the next step. That's the whole thing."],
    ],
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    blurb: "One key, many models — including free ones from several makers.",
    free: "Free models available, no card required.",
    keyUrl: "https://openrouter.ai/keys",
    keyUrlLabel: "OpenRouter",
    keyHint: "Starts with “sk-or-”.",
    steps: [
      ["Sign in", "with Google, GitHub, or an email address."],
      ["Press “Create key”", "and give it any name you like — “Bellwether” works."],
      ["Copy the key", "shown once when it's created. You can't view it again afterwards."],
      ["Come back here", "and paste it on the next step."],
    ],
    defaultBaseUrl: "https://openrouter.ai/api/v1",
  },
  custom: {
    id: "custom",
    label: "Something else",
    blurb: "Any OpenAI-compatible endpoint — Groq, Mistral, or a model running on your own machine.",
    free: "Depends on what you point it at.",
    keyUrl: "",
    keyUrlLabel: "",
    keyHint: "Whatever your provider issued.",
    steps: [
      ["Find your provider's API page", "and create a key there. Anything that accepts OpenAI-style /chat/completions requests will work."],
      ["Copy its base URL", "— the part before /chat/completions. For Groq that's https://api.groq.com/openai/v1."],
      ["Copy the key", "as well."],
      ["Come back here", "and paste both on the next step."],
    ],
    needsBaseUrl: true,
    defaultBaseUrl: "",
    baseUrlHint: "e.g. https://api.groq.com/openai/v1 — the part before /chat/completions",
  },
};

export const providerOf = (id: ProviderId | undefined): ProviderDef =>
  PROVIDERS[id as ProviderId] || PROVIDERS.gemini;

const trimSlash = (u: string) => u.replace(/\/+$/, "");

export const baseUrlFor = (conn: Connection): string =>
  trimSlash(conn.baseUrl || providerOf(conn.provider).defaultBaseUrl);

/* ---------- model choice ----------

   Scored rather than listed, so a provider renaming or superseding a model
   doesn't need a release here. Higher is better; anything scoring below zero
   is treated as unusable for this job. */

const DISQUALIFYING = [
  "embedding", "embed", "aqa", "tts", "audio", "speech", "whisper",
  "image", "imagen", "vision-only", "video", "veo", "moderation", "rerank",
  "guard", "dall-e", "sora",
];

/** Pull the biggest version-looking number out of a model id, so "3.5" beats
    "2.5" without needing to know either name in advance. */
function versionScore(id: string): number {
  const nums = id.match(/\d+(?:\.\d+)?/g);
  if (!nums) return 0;
  return Math.max(...nums.map(Number).filter((n) => n < 100));
}

export function scoreModel(rawId: string): number {
  const id = rawId.toLowerCase();
  if (DISQUALIFYING.some((bad) => id.includes(bad))) return -1;

  let score = versionScore(id) * 10;
  // Small, fast models are the right shape for this job: one short structured
  // reply over a few hundred numbers. A frontier reasoning model costs more
  // and answers no better.
  if (id.includes("flash") || id.includes("mini") || id.includes("haiku") || id.includes("small")) score += 55;
  if (id.includes("free")) score += 70;               // OpenRouter's :free tier
  if (id.includes("lite")) score += 20;
  if (id.includes("instruct") || id.includes("chat")) score += 8;
  if (id.includes("preview") || id.includes("exp")) score -= 25; // less stable
  if (id.includes("thinking")) score -= 30;            // slow, and unnecessary here
  if (id.includes("pro") || id.includes("opus") || id.includes("large")) score -= 15;
  return score;
}

/** Best usable model from what the key can actually see, or null. */
export function pickModel(ids: string[]): string | null {
  const ranked = ids
    .map((id) => ({ id, score: scoreModel(id) }))
    .filter((m) => m.score >= 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return ranked.length ? ranked[0].id : null;
}

/* ---------- wire formats ---------- */

const JSON_INSTRUCTION =
  "\n\nReply with JSON only — no prose, no markdown fence — matching: " +
  '{"patterns":[{"title":string,"detail":string,"evidence":string,"metrics":string[],' +
  '"strength":"weak"|"moderate"|"strong","kind":string,"dayFrom":number,"dayTo":number}],"note":string}';

export const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    patterns: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
          evidence: { type: "string" },
          metrics: { type: "array", items: { type: "string" } },
          strength: { type: "string", enum: ["weak", "moderate", "strong"] },
          kind: {
            type: "string",
            enum: [
              "co-occurrence", "after-activity", "sleep-mood", "timing",
              "trend", "association", "deviation", "other",
            ],
          },
          dayFrom: { type: "integer" },
          dayTo: { type: "integer" },
        },
        required: ["title", "detail", "evidence", "metrics", "strength", "kind"],
      },
    },
    note: { type: "string" },
  },
  required: ["patterns"],
};

const authHeaders = (conn: Connection): Record<string, string> => {
  const key = conn.key.trim();
  if (conn.provider === "gemini") {
    // Works for both the legacy AIza keys and the newer AQ. auth keys.
    return { "x-goog-api-key": key };
  }
  const headers: Record<string, string> = { Authorization: `Bearer ${key}` };
  if (conn.provider === "openrouter") {
    // OpenRouter attributes browser traffic with these; they are optional but
    // keep the request from looking anonymous.
    headers["HTTP-Referer"] = typeof location !== "undefined" ? location.origin : "https://bellwether.app";
    headers["X-Title"] = "Bellwether";
  }
  return headers;
};

/** Model IDs this key can actually reach. Doubles as the key check: if this
    succeeds, the key is valid, the endpoint is reachable, and CORS allows it. */
export async function listModels(conn: Connection): Promise<string[]> {
  const base = baseUrlFor(conn);
  const res = await fetch(`${base}/models`, {
    method: "GET",
    headers: { ...authHeaders(conn) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw Object.assign(new Error(body.slice(0, 200)), { status: res.status });
  }
  const data = await res.json();

  if (conn.provider === "gemini") {
    const models = Array.isArray(data?.models) ? data.models : [];
    return models
      .filter((m: any) => !Array.isArray(m?.supportedGenerationMethods)
        || m.supportedGenerationMethods.includes("generateContent"))
      .map((m: any) => String(m?.name || "").replace(/^models\//, ""))
      .filter(Boolean);
  }
  // OpenAI-compatible shape: { data: [{ id }] }
  const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
  return list.map((m: any) => String(m?.id || "")).filter(Boolean);
}

/** One chat round trip. Returns the model's raw text, which the caller parses.
    Throws `{ status }`-tagged errors so callers can map them to advice. */
export async function chat(conn: Connection, req: ChatRequest): Promise<string> {
  const base = baseUrlFor(conn);
  const model = conn.model;
  if (!model) throw Object.assign(new Error("No model selected"), { status: 0 });
  const schema = req.schema || RESPONSE_SCHEMA;
  const maxTokens = req.maxTokens || 2400;

  /* One list, in the order it will be sent. `images` first so a caller passing
     a set reads left to right, and `image` after it so the single-image callers
     are unchanged. */
  const images: ChatImage[] = [...(req.images || []), ...(req.image ? [req.image] : [])];

  if (conn.provider === "gemini") {
    /* Gemini takes each image as an inline part alongside the text. Images
       first is deliberate: the model reads parts in order, and the text is
       usually "here is what I ate", which only means something once it has
       seen the picture. */
    const userParts: any[] = images.map((img) => ({
      inlineData: { mimeType: img.mime, data: img.data },
    }));
    userParts.push({ text: req.user });

    const res = await fetch(`${base}/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(conn) },
      signal: req.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [{ role: "user", parts: userParts }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: maxTokens,
          responseMimeType: "application/json",
          responseSchema: schema,
        },
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw Object.assign(new Error(body.slice(0, 300)), { status: res.status, body });
    }
    const payload = await res.json();
    const parts = payload?.candidates?.[0]?.content?.parts;
    return Array.isArray(parts)
      ? parts.map((p: any) => (typeof p?.text === "string" ? p.text : "")).join("")
      : "";
  }

  // OpenAI-compatible. Images go in the multipart content array as data URLs;
  // providers that support vision all take this shape, and take several.
  const content: any = images.length
    ? [
        ...images.map((img) => ({
          type: "image_url", image_url: { url: `data:${img.mime};base64,${img.data}` },
        })),
        { type: "text", text: req.user },
      ]
    : req.user;

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(conn) },
    signal: req.signal,
    body: JSON.stringify({
      model,
      temperature: 0.3,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: req.system + (req.jsonHint || JSON_INSTRUCTION) },
        { role: "user", content },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw Object.assign(new Error(body.slice(0, 300)), { status: res.status, body });
  }
  const payload = await res.json();
  return String(payload?.choices?.[0]?.message?.content ?? "");
}

/** True when a provider error means "this model can't look at pictures".

    There is no way to tell a vision model from a text model by its ID without
    hard-coding a list of names, which is the exact mistake that broke this
    feature once already. So photo analysis attempts the request and reads the
    refusal — which providers do report clearly, because it is a common thing
    to get wrong. The caller turns this into "this model is text-only, pick
    another or describe the meal instead" rather than a raw 400. */
export function isNoVision(status: number, body: string): boolean {
  if (status !== 400 && status !== 415 && status !== 422) return false;
  const t = String(body || "");
  return (
    /does not support (image|vision|multimodal)/i.test(t) ||
    /(image|vision|multimodal).{0,24}not supported/i.test(t) ||
    /only supports text/i.test(t) ||
    /invalid.{0,20}image/i.test(t)
  );
}

/** True when a provider error means "that model is gone", which is recoverable
    by re-resolving rather than something to show the user. */
export function isModelGone(status: number, body: string): boolean {
  if (status !== 404 && status !== 400) return false;
  const text = String(body || "");
  // "no longer available" / "deprecated" are unambiguous on their own. A bare
  // "not found" is not — a 404 saying "user not found" is a different problem,
  // and retrying it would just burn a second request.
  if (/no longer available|decommission|deprecat|has been (retired|removed)/i.test(text)) return true;
  return /\bmodels?\b/i.test(text) && /not found|does not exist|unsupported|invalid/i.test(text);
}
