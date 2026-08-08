/* Optional AI-assisted pattern analysis (Google Gemini).

   Everything in this file is off unless the user turns it on. The app ships
   with no key, makes no request at import time, and the locally-computed
   "possible patterns" on the dashboard keep working exactly as before whether
   or not any of this is configured.

   Design rules this module exists to enforce:

   1. **No key in the source, ever.** The key comes from the user at runtime.
      There is no fallback key, no build-time env var, no default endpoint
      credential. `grep` this repo and you will find no key-shaped string.
   2. **The key never touches the journal.** It is stored under its own storage
      key, outside the `fhj_v1` blob, so it cannot ride along in a JSON backup,
      a CSV export, or the report model. Same reasoning as the PIN record.
   3. **The key never gets logged.** Nothing here console-logs, and error paths
      scrub the key out of any message before it is surfaced, because Google's
      error envelopes echo request context.
   4. **Only the minimum leaves the device.** `buildAnalysisInput` reduces the
      journal to daily numeric/boolean answers plus field labels for the
      requested window. No free-text notes, no photos, no name, no dates of
      birth, no device information. `summariseInput` describes that payload in
      plain words so the user can see what is about to be sent before it goes.
   5. **Correlation is not cause.** The prompt forbids causal and diagnostic
      language, and `scrubCausalLanguage` re-checks the model's output on the
      way back in — a model that ignores the instruction gets softened rather
      than shown as-is. */

export type StoredKeyMode = "persist" | "session";

export const AI_MODEL = "gemini-2.5-flash";
export const AI_MODEL_LABEL = "Google Gemini 2.5 Flash";
export const AI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/" + AI_MODEL + ":generateContent";

const KEY_STORAGE = "fhj_ai_key_v1";

/* ---------- key storage ----------

   Persisted keys go to the same IndexedDB store the journal uses, under their
   own key. That is genuinely better than localStorage (it is not readable by a
   stray synchronous script, and it is not in the export path) and genuinely
   *not* encryption — there is no secret on a local-first device to encrypt it
   with that an attacker with the same device access wouldn't also have. The
   Settings copy says exactly that rather than implying a vault.

   "Session" mode keeps the key in a module variable only: it dies with the tab
   and is the honest choice on a shared computer. */

let sessionKey: string | null = null;
const mem: Record<string, string> = {};

const store = {
  async get(k: string): Promise<string | null> {
    const w = typeof window === "undefined" ? null : (window as any);
    if (w?.storage) {
      try {
        const r = await w.storage.get(k);
        return r ? r.value : null;
      } catch {
        return mem[k] ?? null;
      }
    }
    return mem[k] ?? null;
  },
  async set(k: string, v: string): Promise<void> {
    const w = typeof window === "undefined" ? null : (window as any);
    if (w?.storage) {
      try {
        await w.storage.set(k, v);
        return;
      } catch {
        /* fall through to memory */
      }
    }
    mem[k] = v;
  },
  async del(k: string): Promise<void> {
    const w = typeof window === "undefined" ? null : (window as any);
    if (w?.storage) {
      try {
        await w.storage.delete(k);
      } catch {
        /* fall through */
      }
    }
    delete mem[k];
  },
};

/** Shape check only — this never contacts Google. Gemini keys are `AIza` +
    35 URL-safe characters; we stay lenient so a format change doesn't lock
    anyone out, and reject only what is obviously not a key. */
export function looksLikeKey(raw: string): boolean {
  const k = raw.trim();
  return k.length >= 20 && k.length <= 200 && !/\s/.test(k);
}

/** `AIza…4kQ8` — enough to tell two keys apart, not enough to use one. */
export function maskKey(raw: string): string {
  const k = String(raw || "").trim();
  if (k.length <= 10) return "•".repeat(Math.max(4, k.length));
  return `${k.slice(0, 4)}…${k.slice(-4)}`;
}

export async function saveKey(raw: string, mode: StoredKeyMode): Promise<void> {
  const key = raw.trim();
  sessionKey = key;
  if (mode === "persist") await store.set(KEY_STORAGE, key);
  else await store.del(KEY_STORAGE);
}

export async function loadKey(): Promise<string | null> {
  if (sessionKey) return sessionKey;
  const stored = await store.get(KEY_STORAGE);
  return stored && stored.trim() ? stored.trim() : null;
}

export async function hasStoredKey(): Promise<boolean> {
  return !!(await store.get(KEY_STORAGE));
}

export async function clearKey(): Promise<void> {
  sessionKey = null;
  await store.del(KEY_STORAGE);
}

/** Strip anything key-shaped out of text headed for a UI surface. Google's
    error bodies quote request metadata, and this app should never be the thing
    that puts a credential on screen. */
export function redact(text: string, key?: string | null): string {
  let out = String(text ?? "");
  if (key) out = out.split(key).join("[key hidden]");
  return out.replace(/AIza[0-9A-Za-z_\-]{10,}/g, "[key hidden]");
}

/* ---------- the payload ---------- */

export type AnalysisField = {
  k: string;
  label: string;
  /** "scale" | "toggle" | "number" — anything the model can reason over. */
  type: string;
  /** "sym" = higher is worse, "pos" = higher is better, "neutral" = neither. */
  dir?: string;
  unit?: string | null;
};

export type AnalysisInput = {
  /** Days are ordinals (day 1 = start of window), not calendar dates, so the
      payload cannot be tied back to a real person's timeline on its own. */
  windowDays: number;
  startDate: string;
  endDate: string;
  fields: AnalysisField[];
  /** One row per logged day: { day: 1-based index, weekday, values }. */
  days: { day: number; weekday: string; values: Record<string, number> }[];
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function weekdayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return WEEKDAYS[new Date(y, m - 1, d).getDay()] || "";
}

function dayIndex(start: string, date: string): number {
  return Math.round((Date.parse(date) - Date.parse(start)) / 86400000) + 1;
}

/** Reduce the journal to the smallest thing that can still answer the question.

    Included: field labels/types/direction, and per-day numeric or boolean
    answers inside the window.
    Excluded, deliberately: notes and any other free text, photos, the profile
    name, calendar dates on the rows themselves, anything outside the window,
    and any field the user marked as not chartable. */
export function buildAnalysisInput(
  fields: { k: string; label: string; type: string; dir?: string; unit?: string; chart?: boolean }[],
  entries: { date: string; answers?: Record<string, unknown> }[],
  start: string,
  end: string
): AnalysisInput {
  const usable = fields.filter(
    (f) => (f.type === "scale" || f.type === "toggle" || f.type === "number") && f.chart !== false
  );
  const keys = new Set(usable.map((f) => f.k));

  const rows: AnalysisInput["days"] = [];
  for (const e of entries) {
    if (!e.date || e.date < start || e.date > end) continue;
    const values: Record<string, number> = {};
    for (const [k, v] of Object.entries(e.answers || {})) {
      if (!keys.has(k)) continue;
      if (typeof v === "number" && isFinite(v)) values[k] = Math.round(v * 100) / 100;
      else if (typeof v === "boolean") values[k] = v ? 1 : 0;
      // strings, arrays (chips), objects: never sent
    }
    if (Object.keys(values).length === 0) continue;
    rows.push({ day: dayIndex(start, e.date), weekday: weekdayOf(e.date), values });
  }
  rows.sort((a, b) => a.day - b.day);

  // Only describe fields that actually appear in the rows — sending labels for
  // questions with no answers leaks the shape of someone's setup for nothing.
  const present = new Set<string>();
  rows.forEach((r) => Object.keys(r.values).forEach((k) => present.add(k)));

  return {
    windowDays: Math.max(1, dayIndex(start, end)),
    startDate: start,
    endDate: end,
    fields: usable
      .filter((f) => present.has(f.k))
      .map((f) => ({ k: f.k, label: f.label, type: f.type, dir: f.dir, unit: f.unit ?? null })),
    days: rows,
  };
}

/** Plain-language description of the payload, for the confirmation sheet. */
export function summariseInput(input: AnalysisInput): {
  days: number;
  metrics: number;
  values: number;
  approxKB: number;
  metricLabels: string[];
} {
  const values = input.days.reduce((n, d) => n + Object.keys(d.values).length, 0);
  return {
    days: input.days.length,
    metrics: input.fields.length,
    values,
    approxKB: Math.max(1, Math.round(JSON.stringify(input).length / 1024)),
    metricLabels: input.fields.map((f) => f.label),
  };
}

/* ---------- results ---------- */

export type AiPattern = {
  id: string;
  /** Cautious headline, e.g. "Your entries show itch running higher after…". */
  title: string;
  /** One or two sentences of detail, still hedged. */
  detail: string;
  /** Why the model thinks so, in the user's terms — shown behind a disclosure. */
  evidence: string;
  /** Field labels involved, for the chips on the card. */
  metrics: string[];
  /** "weak" | "moderate" | "strong" — described in words in the UI, never as
      a percentage, because a language model's confidence is not a p-value. */
  strength: "weak" | "moderate" | "strong";
  /** Human range this observation covers. */
  range: string;
  kind:
    | "co-occurrence"
    | "after-activity"
    | "sleep-mood"
    | "timing"
    | "trend"
    | "association"
    | "deviation"
    | "other";
};

export type AiAnalysis = {
  generatedAt: string;
  model: string;
  /** Copied from the input so the UI can show what the run actually covered. */
  startDate: string;
  endDate: string;
  daysAnalysed: number;
  patterns: AiPattern[];
  /** Set when the model found nothing worth reporting. */
  note?: string;
};

const RESPONSE_SCHEMA = {
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

const SYSTEM_PROMPT = `You are helping someone read their own health self-tracking journal. You are not a clinician and this is not a clinical setting.

You receive a compact table: a list of tracked metrics (with a label, a type, and a direction where "sym" means higher is worse and "pos" means higher is better) and one row per logged day. Days are numbered from the start of the window; weekday names are given. Values are numbers; booleans are 0 or 1. Days the person did not log are simply absent.

Find longitudinal observations that a person would find genuinely useful, such as:
- metrics that repeatedly move together or appear together on the same days
- changes that show up on the days after a particular activity or flag
- relationships between sleep, mood, and symptom metrics
- recurring timing patterns (particular weekdays, clusters of consecutive days)
- metrics that are trending better or worse across the window
- factors that frequently accompany the person's worse or better days
- unusual deviations from this person's own baseline

Hard rules:
- Never diagnose, name a condition, or suggest a treatment, supplement, medication, test, or diet change.
- Never claim causation. These are co-occurrences in one person's self-reported log, nothing more.
- Phrase every finding cautiously. Use openings like "Your entries show...", "There may be a pattern between...", "You may want to look into...". Never "X causes Y", "X is triggering Y", "because of X", or "due to X".
- Only report something you can point at in the data. In "evidence", say concretely what you counted or compared — how many days, what the averages were, which days. Do not invent numbers.
- Ignore anything supported by fewer than 5 logged days, and say so by simply not reporting it.
- Set "strength" to how much data stands behind the observation: "weak" for a thin or noisy signal, "moderate" for a consistent one across a decent number of days, "strong" only for a clear pattern across most of the window. Most findings are weak or moderate.
- Set dayFrom/dayTo to the span of day numbers the observation draws on.
- Return at most 6 patterns, best first. If nothing meets the bar, return an empty list and explain why in "note" — that is a good answer, not a failure.
- Write for the person themselves: short, warm, concrete, no jargon, no hedging words stacked on hedging words.`;

/** Softens output that slipped past the prompt. Cheaper and more predictable
    than a second model call, and it fails safe: worst case a sentence reads
    slightly more tentative than the model intended. */
export function scrubCausalLanguage(text: string): string {
  return String(text ?? "")
    .replace(/\b(causes|caused|causing)\b/gi, "coincides with")
    .replace(/\bis triggering\b/gi, "often appears alongside")
    .replace(/\btriggered by\b/gi, "seen alongside")
    .replace(/\b(triggers|trigger)\b/gi, "co-occurs with")
    .replace(/\b(because of|due to|as a result of)\b/gi, "alongside")
    .replace(/\b(leads to|led to)\b/gi, "is often followed by")
    .replace(/\b(proves|proven|confirms)\b/gi, "suggests");
}

function dayToDate(start: string, day: number): string {
  const [y, m, d] = start.split("-").map(Number);
  const dt = new Date(y, m - 1, d + Math.max(0, day - 1));
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

function prettyDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export class AiError extends Error {
  kind: "no-key" | "auth" | "rate" | "network" | "response" | "not-enough-data";
  constructor(kind: AiError["kind"], message: string) {
    super(message);
    this.kind = kind;
    this.name = "AiError";
  }
}

/** One cheap round-trip that proves the key works, without sending journal
    data. Used by the "Test key" button in Settings. */
export async function testApiKey(key: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const trimmed = key.trim();
  if (!looksLikeKey(trimmed)) {
    return { ok: false, message: "That doesn't look like a Google AI Studio key." };
  }
  try {
    const res = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": trimmed },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "Reply with the single word: ready" }] }],
        generationConfig: { maxOutputTokens: 16, temperature: 0 },
      }),
    });
    if (res.ok) return { ok: true };
    const body = await res.text().catch(() => "");
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      return {
        ok: false,
        message:
          "Google rejected that key. Check you copied all of it, and that the Generative Language API is enabled for the project it belongs to.",
      };
    }
    if (res.status === 429) {
      return { ok: false, message: "The key works, but Google is rate-limiting it right now. Try again in a minute." };
    }
    return { ok: false, message: redact(`Google returned ${res.status}. ${body.slice(0, 160)}`, trimmed) };
  } catch (e) {
    return {
      ok: false,
      message: "Couldn't reach Google. Check your connection — this is the one part of the app that needs one.",
    };
  }
}

function extractText(payload: any): string {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((p: any) => (typeof p?.text === "string" ? p.text : "")).join("");
}

/** Send one analysis request. Throws AiError; never throws a raw fetch error
    or anything containing the key. */
export async function runPatternAnalysis(
  key: string,
  input: AnalysisInput,
  opts: { signal?: AbortSignal } = {}
): Promise<AiAnalysis> {
  if (!key || !key.trim()) throw new AiError("no-key", "No API key is set.");
  if (input.days.length < 5) {
    throw new AiError(
      "not-enough-data",
      "There are fewer than 5 logged days in this window — not enough for an observation to mean anything."
    );
  }

  let res: Response;
  try {
    res = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key.trim() },
      signal: opts.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [
          {
            role: "user",
            parts: [
              {
                text:
                  "Here is the journal window. Metrics, then one row per logged day.\n\n" +
                  JSON.stringify({
                    windowDays: input.windowDays,
                    metrics: input.fields,
                    days: input.days,
                  }),
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2400,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    });
  } catch (e: any) {
    if (e?.name === "AbortError") throw e;
    throw new AiError("network", "Couldn't reach Google. Check your connection and try again.");
  }

  if (!res.ok) {
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      throw new AiError("auth", "Google rejected the API key. You can replace it in Settings.");
    }
    if (res.status === 429) {
      throw new AiError("rate", "Google is rate-limiting this key right now. Try again in a minute.");
    }
    const body = await res.text().catch(() => "");
    throw new AiError("response", redact(`Google returned an error (${res.status}). ${body.slice(0, 160)}`, key));
  }

  let payload: any;
  try {
    payload = await res.json();
  } catch {
    throw new AiError("response", "Google's reply couldn't be read.");
  }

  const text = extractText(payload);
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AiError("response", "The analysis came back in an unexpected shape. Try regenerating.");
  }

  return normaliseAnalysis(parsed, input);
}

/** Validate + soften + shape the model's reply. Exported for tests: this is
    the boundary where untrusted output becomes something the UI renders. */
export function normaliseAnalysis(parsed: any, input: AnalysisInput): AiAnalysis {
  const labelFor = new Map(input.fields.map((f) => [f.label.toLowerCase(), f.label]));
  const raw = Array.isArray(parsed?.patterns) ? parsed.patterns : [];

  const patterns: AiPattern[] = raw.slice(0, 6).map((p: any, i: number) => {
    const from = Number.isFinite(p?.dayFrom) ? Math.max(1, Math.round(p.dayFrom)) : 1;
    const to = Number.isFinite(p?.dayTo) ? Math.min(input.windowDays, Math.round(p.dayTo)) : input.windowDays;
    const lo = Math.min(from, to);
    const hi = Math.max(from, to);
    const strength: AiPattern["strength"] =
      p?.strength === "strong" || p?.strength === "moderate" ? p.strength : "weak";
    return {
      id: `ai_${i}_${String(p?.title || "").slice(0, 24).replace(/\W+/g, "_").toLowerCase()}`,
      title: scrubCausalLanguage(String(p?.title || "").trim()).slice(0, 160),
      detail: scrubCausalLanguage(String(p?.detail || "").trim()).slice(0, 600),
      evidence: scrubCausalLanguage(String(p?.evidence || "").trim()).slice(0, 600),
      // Keep only metric names we actually sent, so the card can't invent a
      // question the person doesn't track.
      metrics: (Array.isArray(p?.metrics) ? p.metrics : [])
        .map((m: any) => labelFor.get(String(m).toLowerCase()) || null)
        .filter((m: string | null): m is string => !!m)
        .slice(0, 4),
      strength,
      range: `${prettyDate(dayToDate(input.startDate, lo))} – ${prettyDate(dayToDate(input.startDate, hi))}`,
      kind: (p?.kind as AiPattern["kind"]) || "other",
    };
  }).filter((p: AiPattern) => p.title && p.detail);

  return {
    generatedAt: new Date().toISOString(),
    model: AI_MODEL_LABEL,
    startDate: input.startDate,
    endDate: input.endDate,
    daysAnalysed: input.days.length,
    patterns,
    note: typeof parsed?.note === "string" && parsed.note.trim()
      ? scrubCausalLanguage(parsed.note.trim()).slice(0, 400)
      : undefined,
  };
}

/** Words, not numbers — a language model's "confidence" is not a statistic. */
export function strengthLabel(s: AiPattern["strength"]): { label: string; help: string } {
  if (s === "strong") {
    return {
      label: "Seen often",
      help: "This showed up across most of the days in the window.",
    };
  }
  if (s === "moderate") {
    return {
      label: "Seen repeatedly",
      help: "This showed up on a fair number of days, but not consistently.",
    };
  }
  return {
    label: "Seen a few times",
    help: "Only a handful of days support this. Treat it as something to watch, not a finding.",
  };
}
