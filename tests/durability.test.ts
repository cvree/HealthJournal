import { describe, it, expect } from "vitest";
import {
  backupNudge, describeBackupAge, daysBetween,
  BACKUP_STALE_DAYS, BACKUP_MIN_ENTRIES,
} from "../src/lib/durability";
import { screenFromSearch } from "../src/lib/deeplink";

const now = new Date(2026, 5, 1, 12, 0, 0);
const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000).toISOString();

describe("backup freshness", () => {
  it("counts whole days between an ISO stamp and now", () => {
    expect(daysBetween(daysAgo(0), now)).toBe(0);
    expect(daysBetween(daysAgo(5), now)).toBe(5);
    expect(daysBetween("not a date", now)).toBeNull();
  });

  it("stays quiet while the journal is still small", () => {
    const nudge = backupNudge({ entryCount: BACKUP_MIN_ENTRIES - 1, lastBackupAt: null, now });
    expect(nudge.show).toBe(false);
  });

  it("asks for a first backup once there is something to lose", () => {
    const nudge = backupNudge({ entryCount: BACKUP_MIN_ENTRIES, lastBackupAt: null, now });
    expect(nudge).toMatchObject({ show: true, reason: "never" });
  });

  it("stays quiet just after a backup", () => {
    const nudge = backupNudge({ entryCount: 90, lastBackupAt: daysAgo(2), now });
    expect(nudge.show).toBe(false);
    expect(nudge.ageDays).toBe(2);
  });

  it("fires once the last backup goes stale", () => {
    const nudge = backupNudge({ entryCount: 90, lastBackupAt: daysAgo(BACKUP_STALE_DAYS + 1), now });
    expect(nudge).toMatchObject({ show: true, reason: "stale" });
    expect(nudge.ageDays).toBe(BACKUP_STALE_DAYS + 1);
  });

  it("does not nag about a stale backup when nothing new was written", () => {
    const nudge = backupNudge({
      entryCount: 90, lastBackupAt: daysAgo(120), entriesSinceBackup: 0, now,
    });
    expect(nudge.show).toBe(false);
  });

  it("treats an unparseable timestamp as never backed up", () => {
    expect(backupNudge({ entryCount: 90, lastBackupAt: "???", now })).toMatchObject({ show: true, reason: "never" });
  });

  it("describes the age in plain words", () => {
    expect(describeBackupAge(null, now)).toBe("Never backed up");
    expect(describeBackupAge(daysAgo(0), now)).toBe("Backed up today");
    expect(describeBackupAge(daysAgo(1), now)).toBe("Backed up yesterday");
    expect(describeBackupAge(daysAgo(9), now)).toBe("Backed up 9 days ago");
    expect(describeBackupAge(daysAgo(45), now)).toBe("Backed up about a month ago");
    expect(describeBackupAge(daysAgo(200), now)).toMatch(/about \d+ months ago/);
  });
});

describe("deep links", () => {
  it("accepts only the screens the shortcuts advertise", () => {
    expect(screenFromSearch("?screen=log")).toBe("log");
    expect(screenFromSearch("?screen=REPORT")).toBe("report");
    expect(screenFromSearch("?screen=calendar&x=1")).toBe("calendar");
  });

  it("refuses anything outside the allowlist", () => {
    for (const bad of ["", "?", "?screen=", "?screen=settings", "?screen=setup", "?screen=../log", "?other=log"]) {
      expect(screenFromSearch(bad)).toBeNull();
    }
  });
});
