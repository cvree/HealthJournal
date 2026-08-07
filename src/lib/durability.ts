/* Keeping the journal alive.
 *
 * This app's whole promise is that nothing leaves the device — which also means
 * nobody is holding a copy for you. Two failure modes follow from that, and both
 * are real, not theoretical:
 *
 *   1. Browsers evict origin storage. Safari clears IndexedDB for sites you
 *      haven't visited in 7 days unless the site is installed to the Home
 *      Screen; Chrome and Firefox evict under storage pressure unless the
 *      origin is marked persistent. `navigator.storage.persist()` asks for that
 *      exemption, and the answer is worth showing the user plainly.
 *   2. Phones get lost, wiped, and replaced. The only defence is a backup file
 *      the user has actually downloaded, so the app has to notice when that
 *      hasn't happened in a while and say so — once, quietly, in context.
 *
 * Everything here is pure except `requestPersistentStorage` / `storageStatus`.
 */

export interface PersistenceStatus {
  /** navigator.storage exists at all (false on older Safari, and in jsdom). */
  supported: boolean;
  /** The origin is exempt from routine eviction. */
  persisted: boolean;
  /** Bytes used / available, when the browser is willing to say. */
  usage?: number;
  quota?: number;
}

export async function storageStatus(): Promise<PersistenceStatus> {
  const nav: any = typeof navigator === "undefined" ? undefined : navigator;
  if (!nav?.storage) return { supported: false, persisted: false };
  const out: PersistenceStatus = { supported: true, persisted: false };
  try {
    if (typeof nav.storage.persisted === "function") out.persisted = await nav.storage.persisted();
  } catch { /* treat an unreadable answer as "not persisted" */ }
  try {
    if (typeof nav.storage.estimate === "function") {
      const est = await nav.storage.estimate();
      out.usage = est?.usage;
      out.quota = est?.quota;
    }
  } catch { /* estimates are advisory */ }
  return out;
}

/**
 * Ask the browser to exempt this origin from eviction. Chrome grants it silently
 * for installed / frequently-visited sites and denies it otherwise; Firefox
 * prompts. A denial is not an error — it just means backups matter more, which
 * is what the caller tells the user.
 */
export async function requestPersistentStorage(): Promise<PersistenceStatus> {
  const nav: any = typeof navigator === "undefined" ? undefined : navigator;
  if (!nav?.storage || typeof nav.storage.persist !== "function") {
    return storageStatus();
  }
  try {
    await nav.storage.persist();
  } catch { /* fall through to reading the resulting state */ }
  return storageStatus();
}

/** True on iOS/iPadOS Safari, where the 7-day eviction rule bites hardest. */
export function isIOSWebBrowser(ua: string = typeof navigator === "undefined" ? "" : navigator.userAgent): boolean {
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && typeof document !== "undefined" && "ontouchend" in document);
}

/** True when running from a Home Screen icon / installed PWA rather than a tab. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mm = window.matchMedia && window.matchMedia("(display-mode: standalone)");
  return !!(mm && mm.matches) || (navigator as any)?.standalone === true;
}

/* ---------- backup freshness ---------- */

export const BACKUP_STALE_DAYS = 21;
/** Below this many unbacked-up entries the nudge stays quiet — a two-day-old journal doesn't need scolding. */
export const BACKUP_MIN_ENTRIES = 7;

export function daysBetween(fromISO: string, now: Date = new Date()): number | null {
  const t = Date.parse(fromISO);
  if (Number.isNaN(t)) return null;
  return Math.floor((now.getTime() - t) / 86400000);
}

export interface BackupNudgeInput {
  /** ISO timestamp of the last full/JSON backup the user downloaded, if any. */
  lastBackupAt?: string | null;
  /** Total logged entries. */
  entryCount: number;
  /** Entries created since the last backup, when known. */
  entriesSinceBackup?: number;
  now?: Date;
}

export interface BackupNudge {
  show: boolean;
  /** Why it fired — drives the wording, and keeps the decision testable. */
  reason: "never" | "stale" | null;
  ageDays: number | null;
}

/**
 * Whether to surface the "back this up" card. Deliberately conservative: it
 * needs a journal worth losing before it says anything, and it never fires
 * twice for the same reason within the same window because `lastBackupAt`
 * resets on every successful download.
 */
export function backupNudge(input: BackupNudgeInput): BackupNudge {
  const { lastBackupAt, entryCount, entriesSinceBackup, now = new Date() } = input;
  if (entryCount < BACKUP_MIN_ENTRIES) return { show: false, reason: null, ageDays: null };

  if (!lastBackupAt) return { show: true, reason: "never", ageDays: null };

  const ageDays = daysBetween(lastBackupAt, now);
  if (ageDays == null) return { show: true, reason: "never", ageDays: null };
  if (ageDays < BACKUP_STALE_DAYS) return { show: false, reason: null, ageDays };
  // Stale, but nothing new has been written since — no data is actually at risk.
  if (entriesSinceBackup === 0) return { show: false, reason: null, ageDays };
  return { show: true, reason: "stale", ageDays };
}

export function describeBackupAge(lastBackupAt?: string | null, now: Date = new Date()): string {
  if (!lastBackupAt) return "Never backed up";
  const days = daysBetween(lastBackupAt, now);
  if (days == null) return "Never backed up";
  if (days <= 0) return "Backed up today";
  if (days === 1) return "Backed up yesterday";
  if (days < 30) return `Backed up ${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "Backed up about a month ago" : `Backed up about ${months} months ago`;
}
