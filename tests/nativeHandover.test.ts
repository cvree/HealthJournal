/* The two things the packaged app could not do, and the promises attached.
 *
 * Both of these were the same failure wearing different clothes: the web has
 * one way to hand somebody a file and one way to wake a phone, the app used
 * both, and inside a WKWebView neither exists. What is testable without a
 * device is the half that matters most — that the web path is *byte-for-byte
 * what it always was*, that nothing native is touched in a browser, and that
 * what would be scheduled on a phone is derived from the journal and only from
 * the journal.
 *
 * The device half — that iOS actually writes the file and fires the
 * notification — is not testable here and is not claimed here. */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { saveFile, savedVerb } from "../src/lib/saveFile";
import {
  nativeRemindersSupported, notificationId, plannedNotifications,
  syncNativeReminders, nativeReminderState,
} from "../src/lib/nativeReminders";
import { newReminder, type NamedReminder } from "../src/lib/reminders";

const reminder = (over: Partial<NamedReminder> = {}): NamedReminder =>
  newReminder({ label: "Evening check-in", time: "20:00", kind: "checkin", ...over });

beforeEach(() => {
  delete (globalThis as any).Capacitor;
  if (typeof URL.createObjectURL !== "function") {
    (URL as any).createObjectURL = () => "blob:test";
    (URL as any).revokeObjectURL = () => {};
  }
});
afterEach(() => {
  delete (globalThis as any).Capacitor;
  vi.restoreAllMocks();
});

describe("handing over a file", () => {
  /* The whole point of the change is that this half did not change. A journal
     opened in a browser must download exactly as it downloaded before: an
     anchor with a download attribute and the filename on it, clicked once and
     removed. */
  it("is still an anchor with a download attribute, in a browser", async () => {
    const clicks: HTMLAnchorElement[] = [];
    const realClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { clicks.push(this as HTMLAnchorElement); };
    try {
      const res = await saveFile(new Blob(["a,b\n1,2"], { type: "text/csv" }), "bellwether.csv");
      expect(res).toEqual({ ok: true, where: "download" });
      expect(clicks).toHaveLength(1);
      expect(clicks[0].download).toBe("bellwether.csv");
    } finally {
      HTMLAnchorElement.prototype.click = realClick;
    }
  });

  it("leaves nothing behind in the document", async () => {
    const realClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {};
    try {
      await saveFile(new Blob(["x"]), "one.json");
      expect(document.querySelectorAll("a[download]")).toHaveLength(0);
    } finally {
      HTMLAnchorElement.prototype.click = realClick;
    }
  });

  /* Every caller is a button with a sentence under it. A rejected promise in
     the middle of an export handler is a button that goes quiet, which is the
     exact failure this module was written to end — so it resolves, always. */
  it("resolves rather than throwing when the browser refuses", async () => {
    const realClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { throw new Error("blocked"); };
    try {
      const res = await saveFile(new Blob(["x"]), "one.json");
      expect(res.ok).toBe(false);
      expect(res.error).toMatch(/blocked/);
    } finally {
      HTMLAnchorElement.prototype.click = realClick;
    }
  });

  it("names what happened in the words of the platform it happened on", () => {
    expect(savedVerb("download")).toBe("Downloaded");
    expect(savedVerb("share")).toBe("Shared");
  });
});

describe("reminders the phone would keep", () => {
  it("does not exist in a browser, and says so rather than failing", async () => {
    expect(nativeRemindersSupported()).toBe(false);
    await expect(nativeReminderState()).resolves.toBe("unsupported");
    /* Null, not zero: "this device does not do this" and "nothing is
       scheduled" are different answers and the settings card says different
       things about them. */
    await expect(syncNativeReminders([reminder()])).resolves.toBeNull();
  });

  it("is only claimed on a device that says it is native", () => {
    (globalThis as any).Capacitor = { isNativePlatform: () => true };
    expect(nativeRemindersSupported()).toBe(true);
    (globalThis as any).Capacitor = { isNativePlatform: () => false };
    expect(nativeRemindersSupported()).toBe(false);
    (globalThis as any).Capacitor = {};
    expect(nativeRemindersSupported()).toBe(false);
  });

  /* The id has to be a function of the reminder rather than a counter. That is
     what makes a re-sync *replace* yesterday's schedule for the same reminder
     instead of stacking a second copy beside it, and what makes cancelling one
     possible at all. */
  it("gives a reminder the same id every time it is asked", () => {
    expect(notificationId("r_abc")).toBe(notificationId("r_abc"));
    expect(notificationId("r_abc")).not.toBe(notificationId("r_abd"));
  });

  it("keeps ids inside the range the schedulers can hold", () => {
    for (const id of ["r", "r_kx91_3", "r_" + "z".repeat(64), "", "🌤 emoji id"]) {
      const n = notificationId(id);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(2 ** 31);
    }
  });

  it("schedules one repeating notification per enabled reminder, at its own time", () => {
    const plan = plannedNotifications([
      reminder({ label: "Breakfast", time: "08:05", kind: "food" }),
      reminder({ label: "Evening check-in", time: "20:00", kind: "checkin" }),
    ]);
    expect(plan).toHaveLength(2);
    expect(plan.map((n) => n.schedule.on)).toEqual([{ hour: 8, minute: 5 }, { hour: 20, minute: 0 }]);
    expect(plan.every((n) => n.schedule.repeats)).toBe(true);
    expect(plan[0].body).toMatch(/Breakfast/);
    expect(plan[1].body).toMatch(/check-in/);
  });

  /* A reminder switched off is not scheduled and then cancelled — that is a
     race with somebody's evening. It is simply never in the plan. */
  it("leaves out anything switched off or unreadable", () => {
    const plan = plannedNotifications([
      reminder({ label: "Off", time: "09:00", enabled: false }),
      { ...reminder({ label: "Broken" }), time: "25:99" } as NamedReminder,
      reminder({ label: "On", time: "21:30" }),
    ]);
    expect(plan.map((n) => n.body)).toHaveLength(1);
    expect(plan[0].body).toMatch(/On/);
  });

  it("never schedules two notifications on one id", () => {
    const one = reminder({ label: "Twice", time: "07:00" });
    const plan = plannedNotifications([one, { ...one }]);
    expect(plan).toHaveLength(1);
  });

  it("is empty rather than absent when everything is off", () => {
    expect(plannedNotifications([reminder({ enabled: false })])).toEqual([]);
    expect(plannedNotifications([])).toEqual([]);
  });

  /* The message is the journal's own voice, from lib/reminders — a routine
     reminder does not accuse anybody of missing a dose, and that has to survive
     the trip onto the phone. */
  it("carries the app's own wording onto the phone", () => {
    const plan = plannedNotifications([reminder({ label: "Morning routine", kind: "routine", time: "08:00" })]);
    expect(plan[0].title).toBe("Bellwether");
    expect(plan[0].body).toBe("Morning routine — anything on your routine still to tick off?");
    expect(plan[0].body).not.toMatch(/missed|forgot|failed/i);
  });
});
