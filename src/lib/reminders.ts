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

/* ---------- more than one reminder ----------

   One daily time can't express what this app actually needs nudging for. A
   check-in belongs at the end of the day; meals belong at meal times; the
   whole point of food tracking is logging it *while you eat*, not
   reconstructing it at 9pm. So reminders are a list.

   The old single `reminder` field is still read, and migrated on first load,
   so nobody loses the time they set. */

export type ReminderKind = "checkin" | "food" | "bowel" | "routine" | "custom";

export interface NamedReminder {
  id: string;
  label: string;
  time: TimeOfDay;
  enabled: boolean;
  kind?: ReminderKind;
}

/** Offered on the "add a reminder" menu. Times are the common ones, not
    prescriptions — every one is editable the moment it is added. */
export const REMINDER_PRESETS: { label: string; time: TimeOfDay; kind: ReminderKind }[] = [
  { label: "Breakfast", time: "08:00", kind: "food" },
  { label: "Lunch", time: "12:30", kind: "food" },
  { label: "Dinner", time: "18:30", kind: "food" },
  { label: "Morning routine", time: "08:00", kind: "routine" },
  { label: "Evening routine", time: "21:00", kind: "routine" },
  { label: "Evening check-in", time: "20:00", kind: "checkin" },
];

let seq = 0;
export function newReminder(partial: Partial<NamedReminder> = {}): NamedReminder {
  seq += 1;
  return {
    id: `r_${Date.now().toString(36)}_${seq}`,
    label: partial.label?.trim() || "Reminder",
    time: isValidTime(partial.time) ? partial.time : DEFAULT_REMINDER_TIME,
    enabled: partial.enabled !== false,
    kind: partial.kind || "custom",
  };
}

/** Read the reminder list off a profile, migrating a pre-list install.

    A profile that only ever had the single reminder keeps its time and its
    on/off state; one that has neither gets an empty list rather than a
    default, because a reminder nobody asked for is a notification nobody
    asked for. */
export function readReminders(profile: any): NamedReminder[] {
  const raw = profile?.reminders;
  if (Array.isArray(raw)) {
    return raw
      .filter((r: any) => r && typeof r === "object" && isValidTime(r.time))
      .slice(0, 12)
      .map((r: any) => ({
        id: String(r.id || "").slice(0, 64) || newReminder().id,
        label: String(r.label || "Reminder").slice(0, 60).trim() || "Reminder",
        time: r.time,
        enabled: r.enabled !== false,
        kind: (["checkin", "food", "bowel", "routine", "custom"].includes(r.kind) ? r.kind : "custom") as ReminderKind,
      }));
  }
  const legacy = profile?.reminder;
  if (legacy && isValidTime(legacy.time)) {
    return [newReminder({
      label: "Daily check-in",
      time: legacy.time,
      enabled: !!legacy.enabled || !!legacy.notify,
      kind: "checkin",
    })];
  }
  return [];
}

/** Sort by clock time so the list reads like a day. */
export const sortReminders = (rs: NamedReminder[]): NamedReminder[] =>
  rs.slice().sort((a, b) => (minutesOfDay(a.time) ?? 0) - (minutesOfDay(b.time) ?? 0));

/** The next enabled reminder due, and how long until it fires. Null when the
    list is empty or everything in it is switched off. */
export function nextReminderDue(
  rs: NamedReminder[], now: Date = new Date()
): { reminder: NamedReminder; at: Date; ms: number } | null {
  let best: { reminder: NamedReminder; at: Date; ms: number } | null = null;
  for (const r of rs) {
    if (!r.enabled || !isValidTime(r.time)) continue;
    const at = nextOccurrence(r.time, now);
    if (!at) continue;
    const ms = Math.max(0, at.getTime() - now.getTime());
    if (!best || ms < best.ms) best = { reminder: r, at, ms };
  }
  return best;
}

/** What the notification should say. Kind-specific, because "time to log"
    means something different for a meal than for an evening check-in. */
export function reminderMessage(r: NamedReminder): string {
  if (r.kind === "food") return `${r.label} — log what you ate while it's in front of you.`;
  if (r.kind === "bowel") return `${r.label} — anything to log?`;
  /* Deliberately "still to tick", not "you missed your medication". This app
     does not know whether a dose was taken and the phone left in another room,
     and a notification that assumes the worst is one that gets switched off. */
  if (r.kind === "routine") return `${r.label} — anything on your routine still to tick off?`;
  if (r.kind === "checkin") return `${r.label} — today's check-in takes about a minute.`;
  return `${r.label} — time to log.`;
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

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Health Journal//Daily check-in//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...icsEvent({ start, end, uid: id, title, body, now }),
    "END:VCALENDAR",
  ].join("\r\n") + "\r\n";
}

/** One VEVENT's worth of lines, shared by the single- and multi-reminder
    builders so a change to the alarm or recurrence can only be made once. */
function icsEvent(o: { start: Date; end: Date; uid: string; title: string; body: string; now: Date }): string[] {
  return [
    "BEGIN:VEVENT",
    `UID:${o.uid}`,
    `DTSTAMP:${utcStamp(o.now)}`,
    `DTSTART:${floatingStamp(o.start)}`,
    `DTEND:${floatingStamp(o.end)}`,
    "RRULE:FREQ=DAILY",
    fold(`SUMMARY:${escapeText(o.title)}`),
    fold(`DESCRIPTION:${escapeText(o.body)}`),
    "TRANSP:TRANSPARENT",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    fold(`DESCRIPTION:${escapeText(o.title)}`),
    "TRIGGER:PT0M",
    "END:VALARM",
    "END:VEVENT",
  ];
}

/** Every enabled reminder as one calendar file — one import, one place to
    delete them from later. Disabled ones are left out rather than exported as
    cancelled events: the calendar is a snapshot of what is on right now. */
export function buildRemindersICS(reminders: NamedReminder[], now: Date = new Date()): string {
  const live = sortReminders(reminders).filter((r) => r.enabled && isValidTime(r.time));
  if (!live.length) throw new Error("No enabled reminders to export.");

  const events: string[] = [];
  live.forEach((r, i) => {
    const start = nextOccurrence(r.time, now)!;
    const end = new Date(start.getTime() + 5 * 60 * 1000);
    events.push(...icsEvent({
      start, end,
      // Index-suffixed so two reminders at the same time can't collide on a
      // UID and silently overwrite each other on import.
      uid: `health-journal-${r.id}-${i}@localhost`,
      title: `Health Journal — ${r.label}`,
      body: reminderMessage(r) + " Everything you log stays on your device.",
      now,
    }));
  });

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Health Journal//Reminders//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n") + "\r\n";
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
