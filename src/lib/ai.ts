/* Optional AI-assisted pattern analysis.

   Everything in this file is off unless the user turns it on. The app ships
   with no key, makes no request at import time, and the locally-computed
   "possible patterns" on the dashboard keep working exactly as before whether
   or not any of this is configured.

   Which services are reachable, and how to talk to them, lives in
   ./aiProviders — including why OpenAI is not among them. This file owns the
   parts that are the same whoever is answering: what leaves the device, how
   the credential is held, and how untrusted output is made safe to render.

   Design rules this module exists to enforce:

   1. **No key in the source, ever.** The key comes from the user at runtime.
      There is no fallback key, no build-time env var, no default endpoint
      credential. `grep` this repo and you will find no key-shaped string.
   2. **The key never touches the journal.** It is stored under its own storage
      key, outside the `fhj_v1` blob, so it cannot ride along in a JSON backup,
      a CSV export, or the report model. Same reasoning as the PIN record.
   3. **The key never gets logged.** Nothing here console-logs, and error paths
      scrub the key out of any message before it is surfaced, because provider
      error envelopes echo request context.
   4. **Only the minimum leaves the device.** `buildAnalysisInput` reduces the
      journal to daily numeric/boolean answers plus field labels for the
      requested window. No free-text notes, no photos, no name, no dates of
      birth, no device information. `summariseInput` describes that payload in
      plain words so the user can see what is about to be sent before it goes.
   5. **Correlation is not cause.** The prompt forbids causal and diagnostic
      language, and `scrubCausalLanguage` re-checks the model's output on the
      way back in — a model that ignores the instruction gets softened rather
      than shown as-is.
   6. **No model ID is load-bearing.** Hard-coding one is what broke this
      feature for every new user when Google retired `gemini-2.5-flash` early:
      a build that worked last week started returning 404. Models are
      discovered from the user's own key and re-resolved if one disappears. */

import {
  PROVIDERS, providerOf, listModels, chat, pickModel, isModelGone, isNoVision,
  type ChatImage, type Connection, type ProviderId,
} from "./aiProviders";
import type {
  AiConfidence, BowelAiResult, FoodAiResult, NutritionValues,
} from "../types/models";

export {
  PROVIDERS, providerOf, pickModel, scoreModel, OPENAI_NOTE,
  type Connection, type ProviderId, type ProviderDef,
} from "./aiProviders";

export type StoredKeyMode = "persist" | "session";

/* Kept so older callers and saved journals still resolve; the label shown in
   the UI now comes from the live connection, not a constant. */
export const AI_MODEL_LABEL = "your chosen AI";

const CONN_STORAGE = "fhj_ai_conn_v1";
/** Pre-provider installs stored a bare Gemini key here. Read once, migrated. */
const LEGACY_KEY_STORAGE = "fhj_ai_key_v1";

/* ---------- connection storage ----------

   Persisted connections go to the same IndexedDB store the journal uses, under
   their own key. That is genuinely better than localStorage (it is not
   readable by a stray synchronous script, and it is not in the export path)
   and genuinely *not* encryption — there is no secret on a local-first device
   to encrypt it with that an attacker with the same device access wouldn't
   also have. The Settings copy says exactly that rather than implying a vault.

   "Session" mode keeps it in a module variable only: it dies with the tab and
   is the honest choice on a shared computer. */

let sessionConn: Connection | null = null;
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

/** Shape check only — this never contacts anyone. Deliberately lenient: key
    formats change (Google moved from `AIza…` to `AQ.…` mid-life and the strict
    check would have locked those users out), so this rejects only what is
    obviously not a credential. */
export function looksLikeKey(raw: string): boolean {
  const k = raw.trim();
  return k.length >= 20 && k.length <= 400 && !/\s/.test(k);
}

/** `AQ.A…4kQ8` — enough to tell two keys apart, not enough to use one. */
export function maskKey(raw: string): string {
  const k = String(raw || "").trim();
  if (k.length <= 10) return "•".repeat(Math.max(4, k.length));
  return `${k.slice(0, 5)}…${k.slice(-4)}`;
}

export async function saveConnection(conn: Connection, mode: StoredKeyMode): Promise<void> {
  const clean: Connection = { ...conn, key: conn.key.trim() };
  sessionConn = clean;
  if (mode === "persist") await store.set(CONN_STORAGE, JSON.stringify(clean));
  else await store.del(CONN_STORAGE);
  await store.del(LEGACY_KEY_STORAGE);
}

export async function loadConnection(): Promise<Connection | null> {
  if (sessionConn) return sessionConn;
  const raw = await store.get(CONN_STORAGE);
  if (raw) {
    try {
      const c = JSON.parse(raw);
      if (c && typeof c.key === "string" && c.key.trim()) {
        return { provider: (c.provider as ProviderId) || "gemini", key: c.key, baseUrl: c.baseUrl, model: c.model };
      }
    } catch {
      /* corrupt record — fall through to the legacy path, then to null */
    }
  }
  // Installs from before providers existed stored a bare Gemini key.
  const legacy = await store.get(LEGACY_KEY_STORAGE);
  if (legacy && legacy.trim()) return { provider: "gemini", key: legacy.trim() };
  return null;
}

/** Remember a model choice without re-prompting for anything else. */
export async function rememberModel(model: string): Promise<void> {
  const conn = await loadConnection();
  if (!conn) return;
  const next = { ...conn, model };
  if (sessionConn) sessionConn = next;
  if (await store.get(CONN_STORAGE)) await store.set(CONN_STORAGE, JSON.stringify(next));
}

export async function hasStoredKey(): Promise<boolean> {
  return !!(await store.get(CONN_STORAGE)) || !!(await store.get(LEGACY_KEY_STORAGE));
}

export async function clearKey(): Promise<void> {
  sessionConn = null;
  await store.del(CONN_STORAGE);
  await store.del(LEGACY_KEY_STORAGE);
}

/* Back-compat wrappers over the connection API, for callers that only ever
   cared about a Gemini key. */
export const saveKey = (raw: string, mode: StoredKeyMode) =>
  saveConnection({ provider: "gemini", key: raw }, mode);
export const loadKey = async (): Promise<string | null> => (await loadConnection())?.key ?? null;

/** Strip anything credential-shaped out of text headed for a UI surface.
    Providers quote request metadata in error bodies, and this app should never
    be the thing that puts a credential on screen. */
export function redact(text: string, key?: string | null): string {
  let out = String(text ?? "");
  if (key) out = out.split(key).join("[key hidden]");
  return out
    .replace(/AIza[0-9A-Za-z_\-]{10,}/g, "[key hidden]")   // Google, legacy
    .replace(/AQ\.[0-9A-Za-z_\-]{10,}/g, "[key hidden]")   // Google, current
    .replace(/sk-[0-9A-Za-z_\-]{10,}/g, "[key hidden]")     // OpenAI-compatible
    .replace(/Bearer\s+[0-9A-Za-z._\-]{16,}/gi, "Bearer [key hidden]");
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
/** Turn a provider's failure into something the user can act on. Never
    includes the key: provider error bodies quote request context. */
function describeFailure(status: number, body: string, key: string): { kind: AiError["kind"]; message: string } {
  const clean = redact(body, key);
  if (status === 401 || status === 403) {
    return {
      kind: "auth",
      message: "The provider rejected that key. Check you copied all of it, and that the key hasn't been revoked.",
    };
  }
  if (status === 429) {
    return { kind: "rate", message: "You've hit the provider's rate limit. Try again in a minute." };
  }
  if (status === 402) {
    return { kind: "auth", message: "The provider says this key has no credit or quota left." };
  }
  if (status === 404) {
    return {
      kind: "response",
      message: "The provider couldn't find that model. It may have been retired — try again and a current one will be picked.",
    };
  }
  return { kind: "response", message: `The provider returned an error (${status}). ${clean.slice(0, 160)}` };
}

/** A browser CORS refusal and a dead network both surface as a bare TypeError,
    so this can't tell them apart — but for a custom endpoint the former is by
    far the likelier of the two, and saying so saves a long hunt. */
function networkMessage(conn: Connection): string {
  if (conn.provider === "custom") {
    return "Couldn't reach that endpoint from the browser. Either the address is wrong, or the service doesn't allow requests directly from a web page (CORS) — which this app needs, since it has no server to relay through.";
  }
  return "Couldn't reach the provider. Check your connection — this is the one part of the app that needs one.";
}

/** Verify a connection and choose a model for it, in one round trip.

    Listing models proves four things at once: the endpoint is reachable, the
    browser is allowed to call it, the key is accepted, and something usable is
    actually available to it. That last one is what the first version of this
    feature missed — the key was fine, the hard-coded model had been retired. */
/* One shape rather than a discriminated union: this project compiles with
   `strict: false`, and without strictNullChecks TypeScript will not narrow a
   `{ok:true}|{ok:false}` union, so every read of `.message` would error. */
export interface ConnectionCheck {
  ok: boolean;
  /** Set when ok — the model chosen for this connection. */
  model?: string;
  /** Set when ok — everything the key can reach, for diagnostics. */
  models?: string[];
  /** Set when not ok — already redacted, safe to show. */
  message?: string;
}

export async function testConnection(conn: Connection): Promise<ConnectionCheck> {
  if (!looksLikeKey(conn.key)) {
    return { ok: false, message: "That doesn't look like a full API key yet." };
  }
  if (providerOf(conn.provider).needsBaseUrl && !String(conn.baseUrl || "").trim()) {
    return { ok: false, message: "This provider needs an endpoint address as well as a key." };
  }
  let models: string[];
  try {
    models = await listModels(conn);
  } catch (e: any) {
    if (typeof e?.status === "number") {
      return { ok: false, message: describeFailure(e.status, String(e.message || ""), conn.key).message };
    }
    return { ok: false, message: networkMessage(conn) };
  }
  const model = pickModel(models);
  if (!model) {
    return {
      ok: false,
      message: "That key works, but no usable chat model is available to it. If the provider has a model list, check one is enabled.",
    };
  }
  return { ok: true, model, models };
}

/** Back-compat: verify a bare Gemini key. */
export async function testApiKey(key: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const res = await testConnection({ provider: "gemini", key });
  return res.ok ? { ok: true } : { ok: false, message: res.message || "That key didn't work." };
}

export async function runPatternAnalysis(
  connOrKey: Connection | string,
  input: AnalysisInput,
  opts: { signal?: AbortSignal } = {}
): Promise<AiAnalysis> {
  const conn: Connection = typeof connOrKey === "string"
    ? { provider: "gemini", key: connOrKey }
    : { ...connOrKey };

  if (!conn.key || !conn.key.trim()) throw new AiError("no-key", "No API key is set.");
  if (input.days.length < 5) {
    throw new AiError(
      "not-enough-data",
      "There are fewer than 5 logged days in this window — not enough for an observation to mean anything."
    );
  }

  const userText =
    "Here is the journal window. Metrics, then one row per logged day.\n\n" +
    JSON.stringify({ windowDays: input.windowDays, metrics: input.fields, days: input.days });

  /* One retry, and only for "that model is gone" — the exact failure that took
     this feature down for every new user when a hard-coded model was retired.
     Re-resolving from the live list fixes it without anyone touching Settings. */
  const attempt = async (c: Connection, allowRetry: boolean): Promise<string> => {
    if (!c.model) {
      const picked = await testConnection(c);
      if (!picked.ok || !picked.model) throw new AiError("auth", picked.message || "No usable model.");
      c.model = picked.model;
      await rememberModel(picked.model).catch(() => {});
    }

    try {
      return await chat(c, { system: SYSTEM_PROMPT, user: userText, signal: opts.signal });
    } catch (e: any) {
      if (e?.name === "AbortError") throw e;
      if (typeof e?.status !== "number") throw new AiError("network", networkMessage(c));
      if (allowRetry && isModelGone(e.status, String(e.body || e.message || ""))) {
        c.model = undefined;
        return attempt(c, false);
      }
      const { kind, message } = describeFailure(e.status, String(e.body || e.message || ""), c.key);
      throw new AiError(kind, message);
    }
  };

  const text = await attempt(conn, true);

  let parsed: any;
  try {
    parsed = JSON.parse(stripFence(text));
  } catch {
    throw new AiError("response", "The analysis came back in an unexpected shape. Try regenerating.");
  }
  return normaliseAnalysis(parsed, input, conn.model);
}

/** Some OpenAI-compatible models wrap JSON in a markdown fence despite being
    asked not to. Cheaper to unwrap than to fail the run over punctuation. */
function stripFence(text: string): string {
  const t = String(text ?? "").trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(t);
  return fenced ? fenced[1] : t;
}

/** Validate + soften + shape the model's reply. Exported for tests: this is
    the boundary where untrusted output becomes something the UI renders. */
export function normaliseAnalysis(parsed: any, input: AnalysisInput, model?: string): AiAnalysis {
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
    model: model || AI_MODEL_LABEL,
    startDate: input.startDate,
    endDate: input.endDate,
    daysAnalysed: input.days.length,
    patterns,
    note: typeof parsed?.note === "string" && parsed.note.trim()
      ? scrubCausalLanguage(parsed.note.trim()).slice(0, 400)
      : undefined,
  };
}

/* ============================================================
   Food and bowel analysis
   ============================================================

   Everything below shares the machinery above — the same stored connection,
   the same model resolution and retry, the same redaction, the same "untrusted
   output is normalised at the boundary" discipline. What differs is the prompt,
   the schema, and one hard new constraint:

   **An image never leaves the device unless the user asked for this specific
   analysis, on this specific photo, in this specific moment.** There is no
   background upload, no "analyse on save", no retry that re-sends without
   asking. `analyseFood`/`analyseBowelPhoto` are called from a button press and
   nowhere else, and neither reads a photo from storage on its own — the caller
   passes the bytes in, so the code path that sends is always visible at the
   call site.

   The bowel prompt carries the strictest rule in this file: describe what is
   visible, never suggest what it might mean. */

/** Shared confidence normaliser. */
const CONFIDENCES: AiConfidence[] = ["low", "medium", "high"];
const asConfidence = (v: unknown): AiConfidence =>
  CONFIDENCES.includes(v as AiConfidence) ? (v as AiConfidence) : "low";

const NUM_KEYS = ["calories", "protein", "carbs", "fat", "fiber", "sugar", "sodium"] as const;

/** Keep only sane numbers. A model that answers "about 400-600" in a numeric
    field, or slips a decimal, shouldn't reach the totals row. */
function normaliseNutrition(raw: any): NutritionValues {
  const out: NutritionValues = {};
  if (!raw || typeof raw !== "object") return out;
  for (const k of NUM_KEYS) {
    const v = Number(raw[k]);
    if (isFinite(v) && v >= 0 && v < 1e6) out[k] = Math.round(v * 10) / 10;
  }
  if (Array.isArray(raw.micros)) {
    out.micros = raw.micros
      .filter((m: any) => m && typeof m === "object")
      .slice(0, 8)
      .map((m: any) => ({
        label: String(m.label ?? "").slice(0, 60).trim(),
        amount: String(m.amount ?? "").slice(0, 40).trim(),
      }))
      .filter((m: { label: string; amount: string }) => m.label && m.amount);
  }
  return out;
}

const NUTRITION_SCHEMA = {
  type: "object",
  properties: {
    calories: { type: "number" },
    protein: { type: "number" },
    carbs: { type: "number" },
    fat: { type: "number" },
    fiber: { type: "number" },
    sugar: { type: "number" },
    sodium: { type: "number" },
    micros: {
      type: "array",
      items: {
        type: "object",
        properties: { label: { type: "string" }, amount: { type: "string" } },
        required: ["label", "amount"],
      },
    },
  },
};

const FOOD_SCHEMA = {
  type: "object",
  properties: {
    identified: { type: "string" },
    nutrition: NUTRITION_SCHEMA,
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    note: { type: "string" },
  },
  required: ["nutrition", "confidence"],
};

const FOOD_JSON_HINT =
  "\n\nReply with JSON only — no prose, no markdown fence — matching: " +
  '{"identified":string,"nutrition":{"calories":number,"protein":number,"carbs":number,' +
  '"fat":number,"fiber":number,"sugar":number,"sodium":number,' +
  '"micros":[{"label":string,"amount":string}]},"confidence":"low"|"medium"|"high","note":string}';

const FOOD_SYSTEM = `You estimate the nutritional content of a meal someone has logged in their personal food diary.

You are giving a rough estimate from limited information, not a laboratory measurement, and the person reading it knows that. Be useful and be honest about the uncertainty.

How to weigh what you are given:
- If the person states a quantity, weight, serving size, or count, TREAT THAT AS FACT and estimate around it. Never override an explicit amount with your own guess about a "typical" portion, even if the photo looks different — they measured it and you did not.
- If there is a photo and no stated amount, estimate the portion from the photo, using visible references (plate size, utensils, hands, packaging) where you can.
- If there is both a photo and a description, use the photo for what the food *is* and how much is there, and the description for anything the photo cannot show — cooking method, hidden ingredients, brand, added oil, sauces, whether it is a light version.
- If there is only a description, estimate for a standard preparation and say so in the note.

Fill in calories, protein, carbs, fat, fiber, sugar and sodium in the units named in the schema: grams for macros and fiber and sugar, milligrams for sodium, kilocalories for calories. Omit any field you genuinely cannot estimate rather than inventing a number — a missing value is more useful than a fabricated one.

In "micros", include up to 6 micronutrients that are actually notable in this food and would be worth someone knowing about — a good source of something, or an unusually high amount. Skip it entirely for foods with nothing notable. Give the amount as a short string with its unit, e.g. "2.1 mg".

Set "identified" to a short plain description of what you think the food is. This matters most when you are working from a photo — it is how the person checks whether you understood the picture before they trust anything else.

Set "confidence" honestly:
- "high": a clearly described or clearly visible food with a stated amount.
- "medium": a recognisable food where you are estimating the portion.
- "low": an ambiguous photo, an unusual dish, or a description too vague to pin down.

Use "note" for the one thing that would most change these numbers — the assumption you had to make, the ingredient you could not see, the portion you had to guess. One or two short sentences. Do not repeat the numbers back.

Hard rules:
- Never comment on whether the food is healthy, good, bad, or advisable.
- Never suggest eating more or less of anything, and never mention diets, weight, or calorie targets.
- Never diagnose anything or connect the food to a symptom or condition.
- You are describing food, not advising a person.`;

const BOWEL_SCHEMA = {
  type: "object",
  properties: {
    bristol: { type: "integer" },
    amount: { type: "string", enum: ["small", "medium", "large"] },
    color: { type: "string" },
    consistency: { type: "string" },
    form: { type: "string" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    note: { type: "string" },
  },
  required: ["confidence"],
};

const BOWEL_JSON_HINT =
  "\n\nReply with JSON only — no prose, no markdown fence — matching: " +
  '{"bristol":number,"amount":"small"|"medium"|"large","color":string,' +
  '"consistency":string,"form":string,' +
  '"confidence":"low"|"medium"|"high","note":string}';

/* The narrowest prompt in the app, deliberately. It is a description task with
   a diagnosis-shaped hole next to it, and the model is told in four different
   ways not to fall into it — because the failure mode here isn't a wrong
   number, it's someone being told they have a condition by a photo classifier. */
const BOWEL_SYSTEM = `You are helping someone record an observation in their personal health journal. They have taken a photo of a bowel movement and want help filling in the descriptive fields on their log form.

Your entire job is to describe what is visibly present in the image, in the same terms the form uses. You are a labelling aid, nothing more.

Fill in:
- "bristol": the Bristol Stool Scale type, 1 to 7, that best matches the visible form. 1 separate hard lumps; 2 lumpy sausage; 3 sausage with cracks; 4 smooth soft sausage; 5 soft blobs with clear edges; 6 mushy pieces with ragged edges; 7 entirely liquid. Omit it if the image does not show the form clearly enough to place it.
- "amount": how much is visible, relative to a typical single movement — exactly one of "small", "medium", "large". Judge it from the visible extent only. Omit it if the framing makes the quantity impossible to judge.
- "color": the visible colour in plain words, e.g. "brown", "dark brown", "light brown", "yellow", "green", "pale", "red-tinged", "black".
- "consistency": one of hard, formed, soft, loose, watery.
- "form": a short neutral phrase describing the shape, e.g. "single smooth log", "several soft pieces", "fragmented".

Omit any field the image does not clearly show. Guessing here is worse than leaving it blank — the person can fill it in themselves, and a wrong label they don't notice is worse than no label.

Set "confidence" to how clearly the image supports what you reported: "low" for a poorly lit, blurry, partial, or ambiguous photo, "high" only for a clear, well-lit, unambiguous one. Most photos of this kind are "low" or "medium".

ABSOLUTE RULES — these override everything else:
- Never name, suggest, hint at, or ask about any medical condition, disease, infection, or disorder.
- Never say anything is normal, abnormal, healthy, unhealthy, concerning, or reassuring.
- Never recommend seeing a doctor, taking anything, eating anything, or changing anything.
- Never speculate about causes — not diet, not illness, not medication, not stress.
- Never comment on what the observation might mean. It means nothing here. You are filling in form fields from a picture.
- If you cannot describe the image in these terms, return every field empty with confidence "low" and leave "note" empty. That is a correct answer.

Use "note" only for a practical remark about the photo itself, such as "lighting makes the colour hard to judge". Leave it empty otherwise.`;

/** Words the bowel path must never emit, regardless of prompt compliance. A
    model that ignores the instructions gets its output dropped rather than
    softened — unlike the pattern text, there is no cautious rephrasing of a
    diagnosis that is still worth showing. */
const DIAGNOSTIC = new RegExp(
  [
    "diagnos", "condition", "disease", "infection", "syndrome", "disorder",
    "ibs|irritable bowel", "crohn", "colitis", "celiac|coeliac", "cancer",
    "parasite", "bacteri", "virus", "malabsorption", "bleeding", "blood in",
    "see a doctor", "consult", "medical attention", "concerning", "abnormal",
    "unhealthy", "healthy", "normal", "should", "recommend", "suggest you",
  ].join("|"),
  "i"
);

/** True when a bowel note strayed into interpretation. */
export const isDiagnosticText = (text: string): boolean => DIAGNOSTIC.test(String(text ?? ""));

/* ---------- running an analysis ---------- */

/** Shared runner: resolve a model, send, retry once if the model is gone, and
    turn every failure into an AiError the UI can phrase. Identical in shape to
    runPatternAnalysis's inner attempt, which is the point — one integration,
    five callers. */
async function runStructured(
  conn: Connection,
  req: { system: string; user: string; image?: ChatImage | null; schema: any; jsonHint: string; maxTokens?: number },
  signal?: AbortSignal
): Promise<{ parsed: any; model: string }> {
  if (!conn.key || !conn.key.trim()) throw new AiError("no-key", "No API key is set.");
  const c: Connection = { ...conn };

  const attempt = async (allowRetry: boolean): Promise<string> => {
    if (!c.model) {
      const picked = await testConnection(c);
      if (!picked.ok || !picked.model) throw new AiError("auth", picked.message || "No usable model.");
      c.model = picked.model;
      await rememberModel(picked.model).catch(() => {});
    }
    try {
      return await chat(c, {
        system: req.system, user: req.user, image: req.image,
        schema: req.schema, jsonHint: req.jsonHint, maxTokens: req.maxTokens, signal,
      });
    } catch (e: any) {
      if (e?.name === "AbortError") throw e;
      if (typeof e?.status !== "number") throw new AiError("network", networkMessage(c));
      const body = String(e.body || e.message || "");
      if (allowRetry && isModelGone(e.status, body)) {
        c.model = undefined;
        return attempt(false);
      }
      if (req.image && isNoVision(e.status, body)) {
        throw new AiError(
          "response",
          "The model this app picked for you reads text but not images. You can still describe what you ate and get an estimate from that, or choose a different provider in Settings."
        );
      }
      const { kind, message } = describeFailure(e.status, body, c.key);
      throw new AiError(kind, message);
    }
  };

  const text = await attempt(true);
  let parsed: any;
  try {
    parsed = JSON.parse(stripFence(text));
  } catch {
    throw new AiError("response", "The estimate came back in an unexpected shape. Try again.");
  }
  return { parsed, model: c.model || "" };
}

export type FoodAnalysisInput = {
  /** What the user typed. Empty on a photo-only log. */
  description?: string;
  serving?: string;
  quantity?: number;
  unit?: string;
  /** Only present when the user explicitly chose to analyse the photo. */
  image?: ChatImage | null;
};

/** Plain-language description of what a food analysis would send, for the
    confirmation sheet. Same contract as summariseInput: nothing goes out
    before the user has seen this. */
export function summariseFoodRequest(input: FoodAnalysisInput): {
  sendsPhoto: boolean;
  sendsText: boolean;
  textParts: string[];
} {
  const textParts: string[] = [];
  if (input.description?.trim()) textParts.push(input.description.trim());
  if (input.serving?.trim()) textParts.push(input.serving.trim());
  if (input.quantity != null) textParts.push(`${input.quantity}${input.unit ? ` ${input.unit}` : ""}`);
  return { sendsPhoto: !!input.image, sendsText: textParts.length > 0, textParts };
}

/** Estimate a meal from text, a photo, or both.

    The three modes are one function on purpose: they differ only in which
    parts of the prompt have content, and splitting them would mean three
    places to keep the "explicit quantities win" rule correct. */
export async function analyseFood(
  connOrKey: Connection | string,
  input: FoodAnalysisInput,
  opts: { signal?: AbortSignal } = {}
): Promise<FoodAiResult> {
  const conn: Connection = typeof connOrKey === "string" ? { provider: "gemini", key: connOrKey } : connOrKey;

  const hasText = !!(input.description?.trim() || input.serving?.trim() || input.quantity != null);
  if (!input.image && !hasText) {
    throw new AiError("not-enough-data", "Add a photo or describe what you ate, and I can estimate from that.");
  }

  const stated: string[] = [];
  if (input.serving?.trim()) stated.push(`serving: ${input.serving.trim()}`);
  if (input.quantity != null) stated.push(`amount: ${input.quantity}${input.unit ? ` ${input.unit}` : ""}`);

  const lines: string[] = [];
  if (input.image && hasText) {
    lines.push("Here is a photo of the meal, and what the person wrote about it.");
  } else if (input.image) {
    lines.push("Here is a photo of the meal. The person did not describe it.");
  } else {
    lines.push("The person described this meal. There is no photo.");
  }
  if (input.description?.trim()) lines.push(`Description: ${input.description.trim()}`);
  if (stated.length) {
    lines.push(
      `Amounts the person stated (treat these as fact, do not override them): ${stated.join("; ")}`
    );
  }

  const source: FoodAiResult["source"] = input.image ? (hasText ? "photo+text" : "photo") : "text";

  const { parsed, model } = await runStructured(
    conn,
    {
      system: FOOD_SYSTEM,
      user: lines.join("\n"),
      image: input.image || null,
      schema: FOOD_SCHEMA,
      jsonHint: FOOD_JSON_HINT,
      maxTokens: 900,
    },
    opts.signal
  );

  return {
    at: new Date().toISOString(),
    model,
    source,
    identified: String(parsed?.identified ?? "").slice(0, 200).trim() || undefined,
    nutrition: normaliseNutrition(parsed?.nutrition),
    confidence: asConfidence(parsed?.confidence),
    // The food note is advice-adjacent by nature, so it gets the same causal
    // scrub the pattern text does before it can reach a screen.
    note: scrubCausalLanguage(String(parsed?.note ?? "").slice(0, 300).trim()) || undefined,
  };
}

/** Suggest observable attributes from a stool photo.

    Returns only descriptive fields, and drops anything that reads as
    interpretation. The user still has to accept the suggestion — nothing here
    writes to their log on its own. */
export async function analyseBowelPhoto(
  connOrKey: Connection | string,
  image: ChatImage,
  opts: { signal?: AbortSignal } = {}
): Promise<BowelAiResult> {
  const conn: Connection = typeof connOrKey === "string" ? { provider: "gemini", key: connOrKey } : connOrKey;
  if (!image?.data) throw new AiError("not-enough-data", "There's no photo to look at.");

  const { parsed, model } = await runStructured(
    conn,
    {
      system: BOWEL_SYSTEM,
      user: "Describe what is visible in this photo, using only the form fields in the schema.",
      image,
      schema: BOWEL_SCHEMA,
      jsonHint: BOWEL_JSON_HINT,
      maxTokens: 400,
    },
    opts.signal
  );

  return normaliseBowelResult(parsed, model);
}

/** The boundary where a model's reply becomes something the UI may render.
    Exported for tests — this is the guarantee that "never diagnose" survives a
    model that ignores its instructions. */
export function normaliseBowelResult(parsed: any, model = ""): BowelAiResult {
  const bristolRaw = Number(parsed?.bristol);
  const bristol =
    isFinite(bristolRaw) && bristolRaw >= 1 && bristolRaw <= 7 ? Math.round(bristolRaw) : undefined;

  /* Screen the *whole* string, then truncate — never the other way round.
     Truncating first can cut a flagged word in half ("…liver conditi") and let
     the sentence through the filter intact enough to still read as a
     diagnosis. That is a real hole, not a hypothetical one; it is what the
     first version of this function did. */
  const clean = (v: unknown, max: number): string | undefined => {
    const full = String(v ?? "").trim();
    if (!full || isDiagnosticText(full)) return undefined;
    return full.slice(0, max);
  };

  const noteFull = String(parsed?.note ?? "").trim();
  const note = isDiagnosticText(noteFull) ? "" : noteFull.slice(0, 300);

  /* Amount is a closed set on the form, so it is a closed set here. A model
     that answers "moderate" or "a fair bit" gets dropped rather than
     normalised by guesswork — an unfilled field the person notices beats a
     filled one they don't. */
  const amountRaw = String(parsed?.amount ?? "").trim().toLowerCase();
  const amount =
    amountRaw === "small" || amountRaw === "medium" || amountRaw === "large"
      ? (amountRaw as BowelAiResult["amount"])
      : undefined;

  return {
    at: new Date().toISOString(),
    model,
    bristol,
    amount,
    color: clean(parsed?.color, 40),
    consistency: clean(parsed?.consistency, 40),
    form: clean(parsed?.form, 60),
    confidence: asConfidence(parsed?.confidence),
    note: note || undefined,
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
