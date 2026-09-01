/* Reminders the phone itself keeps.
 *
 * lib/reminders.ts is honest about the web's limits and builds two layers on
 * top of them: a notification the page fires while it is alive, and a
 * downloadable .ics the phone's own calendar keeps forever. Both assume a
 * browser. Inside the packaged iOS app there is no `Notification` global at
 * all, so layer one is not merely unreliable, it is absent — and layer two is
 * a file, which is its own problem (see lib/saveFile).
 *
 * Which left the shipped app with no working reminder for the single behaviour
 * that decides whether a journal survives: coming back tomorrow.
 *
 * The packaged app is the one place this is *easy*, and easy without giving
 * anything up. A local notification is scheduled on the device by the
 * operating system. There is no push service, no server, no token, no
 * identifier and nothing to send — which is the exact constraint reminders.ts
 * was written around, satisfied rather than worked around. The phone wakes
 * itself, with the app closed, forever, and nothing about the journal leaves
 * it.
 *
 * This module is the whole native layer, and it is deliberately a *mirror*
 * rather than a second source of truth: the list of reminders lives on the
 * profile exactly as before, and every call here re-derives the phone's
 * schedule from that list. Nothing is stored on this side, so a reminder
 * deleted in the app cannot survive on the phone, which is the one bug a
 * notification system must never have.
 *
 * The plugin is imported dynamically and only on native, so a web build never
 * pulls a line of it.
 */

import { isValidTime, minutesOfDay, reminderMessage, type NamedReminder } from "./reminders";

/** What the phone will do about reminders, as far as it has been asked.
 *
 *  `unsupported` is every browser — this is the native layer, and on the web
 *  the honest answer is that this mechanism does not exist rather than that it
 *  was refused. */
export type NativeReminderState = "unsupported" | "default" | "granted" | "denied";

/** True inside the packaged app, false in every browser. Same detection as
    lib/feedback and lib/saveFile: read the global the Capacitor runtime
    installs rather than importing the runtime to ask a question whose answer
    is statically "no" on the web. */
export function nativeRemindersSupported(): boolean {
  try {
    const cap = (globalThis as any).Capacitor;
    return !!cap && typeof cap.isNativePlatform === "function" && cap.isNativePlatform();
  } catch {
    return false;
  }
}

async function plugin(): Promise<any | null> {
  if (!nativeRemindersSupported()) return null;
  try {
    const m: any = await import("@capacitor/local-notifications");
    return m.LocalNotifications || null;
  } catch {
    return null;
  }
}

function readState(res: any): NativeReminderState {
  const v = res?.display;
  if (v === "granted") return "granted";
  if (v === "denied") return "denied";
  return "default";
}

/** What the phone currently permits, without asking for anything. */
export async function nativeReminderState(): Promise<NativeReminderState> {
  const p = await plugin();
  if (!p) return "unsupported";
  try {
    return readState(await p.checkPermissions());
  } catch {
    return "unsupported";
  }
}

/** Ask, once. iOS shows its own dialog and only ever shows it once per install,
    so this is called from a button somebody pressed and never on load. */
export async function requestNativeReminders(): Promise<NativeReminderState> {
  const p = await plugin();
  if (!p) return "unsupported";
  try {
    return readState(await p.requestPermissions());
  } catch {
    return "denied";
  }
}

/* A stable 31-bit id for a reminder.
 *
 * The scheduler keys notifications by integer, and the reminder's own id is a
 * string. It has to be a *function of the reminder* rather than a counter:
 * that is what lets a re-sync replace yesterday's schedule for the same
 * reminder instead of stacking a second copy of it beside the first, and what
 * makes cancelling by id possible at all.
 *
 * djb2, masked positive and kept under 2^31 because the Android side of this
 * plugin puts it in a Java int. */
export function notificationId(reminderId: string): number {
  let h = 5381;
  for (let i = 0; i < reminderId.length; i++) h = ((h << 5) + h + reminderId.charCodeAt(i)) | 0;
  return Math.abs(h) % 2147483647;
}

/** The exact set of notifications a list of reminders should become.
 *
 *  Pure, and exported so the tests can read the schedule without a phone: the
 *  interesting half of this module is *what* gets scheduled, and none of that
 *  should need a device to check. Disabled reminders and unreadable times are
 *  simply not in the result — never scheduled and then cancelled, which is a
 *  race with somebody's evening. */
export interface NativeNotification {
  id: number;
  title: string;
  body: string;
  schedule: { on: { hour: number; minute: number }; allowWhileIdle: true; repeats: true };
}

export function plannedNotifications(reminders: NamedReminder[]): NativeNotification[] {
  const out: NativeNotification[] = [];
  const seen = new Set<number>();
  for (const r of reminders) {
    if (!r.enabled || !isValidTime(r.time)) continue;
    const mins = minutesOfDay(r.time);
    if (mins == null) continue;
    const id = notificationId(r.id);
    /* Two reminders cannot share a slot: the second would silently replace the
       first on the phone and one of them would just stop happening. */
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      title: "Bellwether",
      body: reminderMessage(r),
      schedule: {
        on: { hour: Math.floor(mins / 60), minute: mins % 60 },
        allowWhileIdle: true,
        repeats: true,
      },
    });
  }
  return out;
}

/**
 * Make the phone's schedule match the journal's, exactly.
 *
 * Cancels everything this app has pending and schedules what the list says —
 * in that order, so a reminder somebody deleted, renamed or moved cannot
 * survive on the phone as a ghost that fires at the old time forever. It is
 * cheap enough to do on every change: a handful of ids, no network, no disk.
 *
 * Returns how many are now set, or null when this is not a device that does
 * this — which is every browser, and is not a failure.
 */
export async function syncNativeReminders(reminders: NamedReminder[]): Promise<number | null> {
  const p = await plugin();
  if (!p) return null;
  try {
    if (readState(await p.checkPermissions()) !== "granted") return null;

    const pending = await p.getPending();
    const old = (pending?.notifications || []).map((n: any) => ({ id: n.id }));
    if (old.length) await p.cancel({ notifications: old });

    const next = plannedNotifications(reminders);
    if (next.length) await p.schedule({ notifications: next });
    return next.length;
  } catch {
    return null;
  }
}

/** Take every reminder off the phone. For switching the whole thing off, and
    for the moment a journal is wiped — a deleted journal that keeps tapping
    somebody on the shoulder every evening is the worst version of this
    feature. */
export async function clearNativeReminders(): Promise<void> {
  const p = await plugin();
  if (!p) return;
  try {
    const pending = await p.getPending();
    const old = (pending?.notifications || []).map((n: any) => ({ id: n.id }));
    if (old.length) await p.cancel({ notifications: old });
  } catch {
    /* Nothing to tell anybody: this is cleanup, and it runs where no one is
       looking. */
  }
}
