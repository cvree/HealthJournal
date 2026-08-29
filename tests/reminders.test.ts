import { describe, it, expect } from "vitest";
import {
  isValidTime, minutesOfDay, formatTime, nextOccurrence, msUntilNext,
  buildReminderICS, DEFAULT_REMINDER_TIME,
  readReminders, sortReminders, nextReminderDue, newReminder, reminderMessage,
  buildRemindersICS, REMINDER_PRESETS,
} from "../src/lib/reminders";

describe("reminder times", () => {
  it("accepts 24h times and rejects anything else", () => {
    expect(isValidTime("00:00")).toBe(true);
    expect(isValidTime("23:59")).toBe(true);
    expect(isValidTime(DEFAULT_REMINDER_TIME)).toBe(true);
    for (const bad of ["24:00", "7:30", "07:60", "0730", "", "abc", null, undefined, 730]) {
      expect(isValidTime(bad as any)).toBe(false);
    }
  });

  it("converts to minutes since midnight", () => {
    expect(minutesOfDay("00:00")).toBe(0);
    expect(minutesOfDay("08:30")).toBe(510);
    expect(minutesOfDay("23:59")).toBe(1439);
    expect(minutesOfDay("nope")).toBeNull();
  });

  it("formats for display without mangling invalid input", () => {
    expect(formatTime("20:00", "en-US")).toMatch(/8[:.]00/);
    expect(formatTime("garbage")).toBe("garbage");
  });

  it("schedules today when the time is still ahead", () => {
    const now = new Date(2026, 0, 15, 9, 0, 0);
    const next = nextOccurrence("20:00", now)!;
    expect(next.getDate()).toBe(15);
    expect(next.getHours()).toBe(20);
  });

  it("rolls to tomorrow once the time has passed", () => {
    const now = new Date(2026, 0, 15, 21, 0, 0);
    const next = nextOccurrence("20:00", now)!;
    expect(next.getDate()).toBe(16);
    expect(next.getHours()).toBe(20);
  });

  it("treats the exact minute as already gone, so a fired reminder reschedules", () => {
    const now = new Date(2026, 0, 15, 20, 0, 0);
    expect(nextOccurrence("20:00", now)!.getDate()).toBe(16);
  });

  it("reports a positive wait that is never longer than a day", () => {
    const now = new Date(2026, 0, 15, 20, 0, 30);
    const ms = msUntilNext("20:00", now)!;
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThanOrEqual(24 * 3600 * 1000);
    expect(msUntilNext("bad", now)).toBeNull();
  });
});

describe("calendar export", () => {
  const now = new Date(2026, 0, 15, 9, 0, 0);

  it("produces a daily recurring floating-time event with an alarm", () => {
    const ics = buildReminderICS({ time: "20:00", now, uid: "test@bellwether" });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("RRULE:FREQ=DAILY");
    expect(ics).toContain("UID:test@bellwether");
    // Floating local time — no trailing Z — so 8pm stays 8pm across timezones.
    expect(ics).toContain("DTSTART:20260115T200000");
    expect(ics).not.toMatch(/DTSTART:[0-9T]+Z/);
    expect(ics).toContain("BEGIN:VALARM");
    expect(ics).toContain("TRIGGER:PT0M");
  });

  it("uses CRLF line endings as RFC 5545 requires", () => {
    const ics = buildReminderICS({ time: "07:15", now });
    expect(ics.split("\r\n").length).toBeGreaterThan(10);
    expect(ics).not.toMatch(/[^\r]\n/);
  });

  it("keeps every line within the 75-octet fold limit", () => {
    const ics = buildReminderICS({
      time: "07:15",
      now,
      title: "A very long reminder title ".repeat(6),
      description: "And an even longer description that certainly needs folding ".repeat(4),
    });
    for (const line of ics.split("\r\n")) expect(line.length).toBeLessThanOrEqual(75);
  });

  it("escapes characters that would otherwise break the format", () => {
    const ics = buildReminderICS({ time: "07:15", now, title: "Check in; today, please" });
    expect(ics).toContain("Check in\\; today\\, please");
  });

  it("refuses an invalid time rather than emitting a broken calendar", () => {
    expect(() => buildReminderICS({ time: "25:00", now })).toThrow();
  });
});

describe("more than one reminder", () => {
  const at = (h: number, m = 0) => new Date(2026, 7, 9, h, m, 0, 0);

  it("migrates a pre-list install without losing the time it had", () => {
    const rs = readReminders({ reminder: { enabled: true, time: "21:15", notify: true } });
    expect(rs).toHaveLength(1);
    expect(rs[0].time).toBe("21:15");
    expect(rs[0].enabled).toBe(true);
    expect(rs[0].kind).toBe("checkin");
  });

  it("gives a fresh install an empty list, not a default nobody asked for", () => {
    expect(readReminders({})).toEqual([]);
    expect(readReminders(undefined)).toEqual([]);
  });

  it("prefers the list once one exists", () => {
    const rs = readReminders({
      reminder: { enabled: true, time: "21:15", notify: true },
      reminders: [{ id: "a", label: "Lunch", time: "12:30", enabled: true, kind: "food" }],
    });
    expect(rs).toHaveLength(1);
    expect(rs[0].label).toBe("Lunch");
  });

  it("drops entries with an unusable time rather than firing at midnight", () => {
    const rs = readReminders({ reminders: [
      { id: "a", label: "Good", time: "08:00", enabled: true },
      { id: "b", label: "Bad", time: "25:99", enabled: true },
      { id: "c", label: "Worse", time: "nope", enabled: true },
    ] });
    expect(rs.map((r) => r.label)).toEqual(["Good"]);
  });

  it("sorts the list so it reads like a day", () => {
    const rs = sortReminders([
      newReminder({ label: "Dinner", time: "18:30" }),
      newReminder({ label: "Breakfast", time: "08:00" }),
      newReminder({ label: "Lunch", time: "12:30" }),
    ]);
    expect(rs.map((r) => r.label)).toEqual(["Breakfast", "Lunch", "Dinner"]);
  });

  it("finds the next one due later today", () => {
    const rs = [newReminder({ label: "Lunch", time: "12:30" }), newReminder({ label: "Dinner", time: "18:30" })];
    expect(nextReminderDue(rs, at(10))!.reminder.label).toBe("Lunch");
    expect(nextReminderDue(rs, at(13))!.reminder.label).toBe("Dinner");
  });

  it("rolls to tomorrow's first once the day's are past", () => {
    const rs = [newReminder({ label: "Breakfast", time: "08:00" }), newReminder({ label: "Dinner", time: "18:30" })];
    const due = nextReminderDue(rs, at(22))!;
    expect(due.reminder.label).toBe("Breakfast");
    expect(due.at.getDate()).toBe(10);
  });

  it("skips the ones that are switched off", () => {
    const rs = [
      newReminder({ label: "Lunch", time: "12:30", enabled: false }),
      newReminder({ label: "Dinner", time: "18:30" }),
    ];
    expect(nextReminderDue(rs, at(10))!.reminder.label).toBe("Dinner");
  });

  it("returns nothing when the list is empty or entirely off", () => {
    expect(nextReminderDue([], at(10))).toBe(null);
    expect(nextReminderDue([newReminder({ time: "12:30", enabled: false })], at(10))).toBe(null);
  });

  it("gives every reminder a distinct id", () => {
    const ids = new Set(Array.from({ length: 20 }, () => newReminder().id));
    expect(ids.size).toBe(20);
  });

  it("says something useful per kind", () => {
    expect(reminderMessage(newReminder({ label: "Lunch", kind: "food" }))).toMatch(/while it's in front of you/);
    expect(reminderMessage(newReminder({ label: "Evening", kind: "checkin" }))).toMatch(/about a minute/);
  });
});

describe("a calendar file for the whole list", () => {
  const now = new Date(2026, 7, 9, 9, 0, 0, 0);
  const rs = [
    newReminder({ label: "Breakfast", time: "08:00", kind: "food" }),
    newReminder({ label: "Dinner", time: "18:30", kind: "food" }),
    newReminder({ label: "Off one", time: "12:00", enabled: false }),
  ];

  it("writes one recurring event per enabled reminder", () => {
    const ics = buildRemindersICS(rs, now);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics.match(/RRULE:FREQ=DAILY/g)).toHaveLength(2);
    expect(ics).toContain("Breakfast");
    expect(ics).toContain("Dinner");
    expect(ics).not.toContain("Off one");
  });

  it("gives each event a unique UID, so two at the same time don't collide", () => {
    const same = [newReminder({ label: "A", time: "08:00" }), newReminder({ label: "B", time: "08:00" })];
    const uids = buildRemindersICS(same, now).match(/^UID:.*$/gm)!;
    expect(new Set(uids).size).toBe(2);
  });

  it("uses floating times so the reminder follows the traveller", () => {
    // No Z suffix and no TZID: 8am means 8am wherever you wake up.
    const ics = buildRemindersICS(rs, now);
    expect(ics).toMatch(/DTSTART:\d{8}T\d{6}\r?\n/);
    expect(ics).not.toContain("DTSTART;TZID");
  });

  it("schedules each event at its own next occurrence", () => {
    const ics = buildRemindersICS(rs, now);
    // 08:00 has passed at 09:00, so it lands tomorrow; 18:30 is still today.
    expect(ics).toContain("DTSTART:20260810T080000");
    expect(ics).toContain("DTSTART:20260809T183000");
  });

  it("refuses rather than writing an empty calendar", () => {
    expect(() => buildRemindersICS([], now)).toThrow();
    expect(() => buildRemindersICS([newReminder({ enabled: false })], now)).toThrow();
  });

  it("ends every line the way RFC 5545 requires", () => {
    const ics = buildRemindersICS(rs, now);
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(ics.split("\r\n").filter((l) => l.length > 75)).toEqual([]);
  });
});
