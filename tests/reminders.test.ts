import { describe, it, expect } from "vitest";
import {
  isValidTime, minutesOfDay, formatTime, nextOccurrence, msUntilNext,
  buildReminderICS, DEFAULT_REMINDER_TIME,
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
    const ics = buildReminderICS({ time: "20:00", now, uid: "test@health-journal" });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("RRULE:FREQ=DAILY");
    expect(ics).toContain("UID:test@health-journal");
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
