/* Daily check-in reminders.
 *
 * A journal only helps if you actually write in it, and the honest truth about
 * the web platform is that a site with no server cannot reliably wake a phone.
 * Web Push needs a push service and a server to talk to it; that would mean
 * shipping journal-adjacent identifiers off the device, which this app does not
 * do. So reminders come in two layers, and the UI is explicit about both:
 *
 *   1. A local notification fired by the page itself. Works whenever the app is
 *      open or installed and running in the background — free, private, instant.
 *   2. A downloadable .ics with a daily recurrence rule. The user adds it to
 *      whatever calendar their phone already trusts, and the phone's own
 *      notification system does the waking, forever, with the app closed.
 *
 * Layer 2 is the one that actually survives a closed browser, which is why the
 * settings screen leads with it. Everything here is pure except the two thin
 * wrappers over the Notification API at the bottom.
 */

/** "HH:MM" in 24h form, the value an <input type="time"> produces. */
export type TimeOfDay = string;

export const DEFAULT_REMINDER_TIME: TimeOfDay = "20:00";

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTime(value: unknown): value is TimeOfDay {
  return typeof value === "string" && TIME_RE.test(value);
}

/** Minutes since local midnight, or null when the string isn't a valid time. */
export function minutesOfDay(time: string): number | null {
  const m = TIME_RE.exec(time);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** "20:00" -> "8:00 PM". Uses the locale's clock when one is available. */
export function formatTime(time: string, locale?: string): string {
  const mins = minutesOfDay(time);
  if (mins == null) return time;
  const d = new Date(2000, 0, 1, Math.floor(mins / 60), mins % 60);
  try {
    return d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
  } catch {
    return time;
  }
}

/**
 * The next moment this reminder is due, strictly after `now`. Today if the time
 * hasn't passed yet, otherwise tomorrow — which also makes the DST-shifted days
 * land correctly, since Date arithmetic on the calendar fields respects the
 * local offset in effect on that day.
 */
export function nextOccurrence(time: string, now: Date = new Date()): Date | null {
  const mins = minutesOfDay(time);
  if (mins == null) return null;
  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), Math.floor(mins / 60), mins % 60, 0, 0);
  if (at.getTime() <= now.getTime()) at.setDate(at.getDate() + 1);
  return at;
}

/** Milliseconds to wait before firing, clamped so a bad clock can't hang a timer. */
export function msUntilNext(time: string, now: Date = new Date()): number | null {
  const next = nextOccurrence(time, now);
  if (!next) return null;
  return Math.max(0, next.getTime() - now.getTime());
}

/* ---------- calendar file (the reminder that survives a closed browser) ---------- */

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Local wall-clock stamp with no timezone suffix — a "floating" time in RFC 5545 terms. */
function floatingStamp(d: Date): string {
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `T${pad(d.getHours())}${pad(d.getMinutes())}00`
  );
}

function utcStamp(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/** RFC 5545 says lines fold at 75 octets; calendars are strict about it. */
function fold(line: string): string {
  if (line.length <= 73) return line;
  const parts: string[] = [line.slice(0, 73)];
  let rest = line.slice(73);
  while (rest.length > 72) {
    parts.push(" " + rest.slice(0, 72));
    rest = rest.slice(72);
  }
  if (rest) parts.push(" " + rest);
  return parts.join("\r\n");
}

function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

export interface ReminderICSOptions {
  time: TimeOfDay;
  /** Event title as it appears in the calendar. */
  title?: string;
  description?: string;
  /** Deterministic id + timestamp make the output testable and re-importable. */
  uid?: string;
  now?: Date;
}

/**
 * A single all-forever daily event. Deliberately floating-time: if the user
 * flies to another timezone, "check in at 8pm" should still mean 8pm where
 * they are, not 8pm back home.
 */
export function buildReminderICS(opts: ReminderICSOptions): string {
  const { time, title = "Health Journal check-in", description, uid, now = new Date() } = opts;
  if (!isValidTime(time)) throw new Error(`Invalid reminder time: ${time}`);
  const start = nextOccurrence(time, now)!;
  const end = new Date(start.getTime() + 5 * 60 * 1000);
  const id = uid || `health-journal-${floatingStamp(start)}@localhost`;
  const body =
    description ||
    "Time for today's check-in. Everything you log stays on your device.";

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Health Journal//Daily check-in//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${id}`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${floatingStamp(start)}`,
    `DTEND:${floatingStamp(end)}`,
    "RRULE:FREQ=DAILY",
    fold(`SUMMARY:${escapeText(title)}`),
    fold(`DESCRIPTION:${escapeText(body)}`),
    "TRANSP:TRANSPARENT",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    fold(`DESCRIPTION:${escapeText(title)}`),
    "TRIGGER:PT0M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}

/* ---------- browser notification layer ---------- */

export type NotificationPermissionState = "unsupported" | "default" | "granted" | "denied";

export function notificationPermission(): NotificationPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return (window as any).Notification.permission as NotificationPermissionState;
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (notificationPermission() === "unsupported") return "unsupported";
  try {
    const result = await (window as any).Notification.requestPermission();
    return result as NotificationPermissionState;
  } catch {
    return notificationPermission();
  }
}

export function showReminderNotification(body: string, icon?: string): boolean {
  if (notificationPermission() !== "granted") return false;
  try {
    new (window as any).Notification("Health Journal", {
      body,
      icon,
      tag: "health-journal-daily", // replaces yesterday's rather than stacking
      requireInteraction: false,
    });
    return true;
  } catch {
    return false;
  }
}
