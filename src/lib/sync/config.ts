/* Where the sync server's address comes from — and why there isn't one baked in.

   This repository has no Supabase project attached to it, and inventing one
   would be worse than leaving it empty: it would mean a stranger's health
   journal syncing into an account nobody owns. So the address is configuration,
   and the app is honest when it is missing.

   Two sources, in order:

   1. **Build-time.** `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, which the
      Pages workflow reads from repository secrets. This is the path for the
      deployed site: whoever runs the deploy points it at their own project once
      and every visitor's app finds it.
   2. **Runtime, per device.** A pasted URL + key kept in localStorage, for
      anyone running their own copy without rebuilding — and for testing a
      project before committing to it.

   Both hold the *anon* key, which is designed to be public: it identifies the
   project and authorises nothing by itself. Every table is behind row-level
   security keyed on the signed-in user (supabase/schema.sql). The service-role
   key, which would be dangerous, is never read here, never bundled, and has no
   business in a client at all.

   With neither source set, `syncConfig()` returns null, the Settings card says
   so in one plain sentence, and the app is exactly the local-first journal it
   has always been. Sync is the option; local is the product. */

export interface SyncConfig {
  url: string;
  anonKey: string;
  /** Where this configuration came from, for the Settings diagnostics line. */
  source: "build" | "device";
}

export const SYNC_CONFIG_KEY = "fhj_sync_config_v1";

/** A Supabase URL is `https://<ref>.supabase.co` (or a self-hosted https
    origin). Checked because a typo here surfaces as an unexplained network
    error three screens later. */
export function looksLikeUrl(v: string): boolean {
  if (!/^https:\/\/[^\s]+$/i.test((v || "").trim())) return false;
  try { new URL(v.trim()); return true; } catch { return false; }
}

/** Anon keys are JWTs (three dot-separated segments) or, on newer projects, a
    `sb_publishable_…` string. Either way they are long and have no whitespace. */
export function looksLikeAnonKey(v: string): boolean {
  const s = (v || "").trim();
  if (s.length < 30 || /\s/.test(s)) return false;
  return s.split(".").length === 3 || /^sb_(publishable|anon)_/.test(s);
}

function fromBuild(): SyncConfig | null {
  const env: any = (import.meta as any)?.env || {};
  const url = String(env.VITE_SUPABASE_URL || "").trim();
  const anonKey = String(env.VITE_SUPABASE_ANON_KEY || "").trim();
  if (!looksLikeUrl(url) || !looksLikeAnonKey(anonKey)) return null;
  return { url, anonKey, source: "build" };
}

function fromDevice(): SyncConfig | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(SYNC_CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const url = String(parsed?.url || "").trim();
    const anonKey = String(parsed?.anonKey || "").trim();
    if (!looksLikeUrl(url) || !looksLikeAnonKey(anonKey)) return null;
    return { url, anonKey, source: "device" };
  } catch {
    return null;
  }
}

/** The active configuration, or null when this build has no server. Read fresh
    each time so pasting a configuration takes effect without a reload. */
export function syncConfig(): SyncConfig | null {
  return fromBuild() || fromDevice();
}

export function setDeviceConfig(url: string, anonKey: string): boolean {
  if (!looksLikeUrl(url) || !looksLikeAnonKey(anonKey)) return false;
  try {
    localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify({ url: url.trim(), anonKey: anonKey.trim() }));
    return true;
  } catch {
    return false;
  }
}

export function clearDeviceConfig() {
  try { localStorage.removeItem(SYNC_CONFIG_KEY); } catch { /* nothing stored */ }
}

export const syncAvailable = () => !!syncConfig();
