/* Episodes: the model and its sanitiser, the start/end actions, and the
   arithmetic every screen downstream prints. Clock-free — every case passes
   its own "today". */
import { describe, it, expect } from "vitest";
import {
  addDays, compareEpisodeYears, daySpan, datesBetween, daysInYear, durationLabel,
  endFlare, episodeBands, episodeOn, episodeStats, episodeWhen, episodeYear,
  isOpen, lastDay, newEpisode, openEpisode, removeEpisode, sanitizeEpisodes,
  sortEpisodes, startFlare, updateEpisode,
  type HealthEpisode,
} from "../src/lib/episodes";

const TODAY = "2026-08-18";

const ep = (over: Partial<HealthEpisode> = {}): HealthEpisode => ({
  id: "e1", title: "Flare", metric: "itch",
  start: "2026-07-01", end: "2026-07-14",
  createdAt: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-01T00:00:00.000Z",
  ...over,
});

/** A journal where `itch` is `v` on each listed date. */
const journal = (rows: Record<string, number>) =>
  Object.entries(rows).map(([date, v]) => ({ date, answers: { itch: v } }));

/** Every day from a to b at one value. */
const flat = (a: string, b: string, v: number) =>
  Object.fromEntries(datesBetween(a, b).map((d) => [d, v]));

describe("dates", () => {
  it("counts a span inclusively, so one day is one day", () => {
    expect(daySpan("2026-07-01", "2026-07-01")).toBe(1);
    expect(daySpan("2026-07-01", "2026-07-14")).toBe(14);
  });
  it("crosses months and years, and DST, correctly", () => {
    expect(daySpan("2025-12-28", "2026-01-03")).toBe(7);
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(datesBetween("2026-02-27", "2026-03-01"))
      .toEqual(["2026-02-27", "2026-02-28", "2026-03-01"]);
  });
});

describe("the model", () => {
  it("is born with a title, both stamps and no end", () => {
    const e = newEpisode({ metric: "itch", start: "2026-08-01" });
    expect(e.title).toBe("Flare");
    expect(e.end).toBeNull();
    expect(isOpen(e)).toBe(true);
    expect(e.id).toMatch(/^ep_/);
    expect(e.createdAt).toBe(e.updatedAt);
  });
  it("keeps the person's own title when they gave one", () => {
    expect(newEpisode({ metric: "itch", start: "2026-08-01", title: "  Hands  " }).title)
      .toBe("Hands");
  });
});

describe("sanitizeEpisodes", () => {
  it("drops rows nothing could render, and de-duplicates ids", () => {
    const rows = [
      null, "nope", {},
      { id: "a", metric: "itch", start: "not-a-date" },
      { id: "a", metric: "itch", start: "2026-01-01" },
      { id: "a", metric: "itch", start: "2026-02-01" },
      { id: "b", metric: "", start: "2026-01-01" },
      { id: "c", metric: "itch", start: "2026-03-01" },
    ];
    const out = sanitizeEpisodes(rows);
    expect(out.map((e) => e.id)).toEqual(["a", "c"]);
    expect(out[0].start).toBe("2026-01-01");
  });
  it("repairs an end that falls before the start rather than printing negative weeks", () => {
    const [e] = sanitizeEpisodes([{ id: "a", metric: "itch", start: "2026-05-10", end: "2026-05-01" }]);
    expect(e.end).toBe("2026-05-10");
    expect(daySpan(e.start, e.end!)).toBe(1);
  });
  it("treats a junk end as still running, and fills the missing stamps", () => {
    const [e] = sanitizeEpisodes([{ id: "a", metric: "itch", start: "2026-05-10", end: 7 }]);
    expect(e.end).toBeNull();
    expect(isOpen(e)).toBe(true);
    expect(e.createdAt).toBeTruthy();
    expect(e.updatedAt).toBeTruthy();
  });
  it("returns an empty list for anything that isn't one", () => {
    expect(sanitizeEpisodes(undefined)).toEqual([]);
    expect(sanitizeEpisodes({ a: 1 })).toEqual([]);
  });
});

describe("the list", () => {
  const list = [
    ep({ id: "a", start: "2026-01-01", end: "2026-01-10" }),
    ep({ id: "b", start: "2026-07-01", end: null }),
    ep({ id: "c", start: "2026-03-01", end: "2026-03-05" }),
  ];
  it("sorts newest first", () => {
    expect(sortEpisodes(list).map((e) => e.id)).toEqual(["b", "c", "a"]);
  });
  it("finds the one still running, per metric", () => {
    expect(openEpisode(list)?.id).toBe("b");
    expect(openEpisode(list, "itch")?.id).toBe("b");
    expect(openEpisode(list, "sleep")).toBeNull();
  });
  it("finds the episode covering a day, counting an open one through today", () => {
    expect(episodeOn(list, "2026-03-03", TODAY)?.id).toBe("c");
    expect(episodeOn(list, "2026-08-10", TODAY)?.id).toBe("b");
    expect(episodeOn(list, "2026-06-01", TODAY)).toBeNull();
  });
  it("runs an open episode up to today, and never before its own start", () => {
    expect(lastDay(ep({ end: null, start: "2026-07-01" }), TODAY)).toBe(TODAY);
    expect(lastDay(ep({ end: null, start: "2027-01-01" }), TODAY)).toBe("2027-01-01");
  });
});

describe("start and end", () => {
  it("starts one", () => {
    const r = startFlare([], { metric: "itch", start: "2026-08-01", title: "Bad week" });
    expect(r.list).toHaveLength(1);
    expect(r.refused).toBeUndefined();
    expect(r.episode!.title).toBe("Bad week");
  });
  it("refuses a second open flare for the same metric and hands back the running one", () => {
    const first = startFlare([], { metric: "itch", start: "2026-08-01" });
    const second = startFlare(first.list, { metric: "itch", start: "2026-08-10" });
    expect(second.refused).toBe("already-open");
    expect(second.list).toHaveLength(1);
    expect(second.episode!.id).toBe(first.episode!.id);
  });
  it("allows a second open flare for a different metric", () => {
    const first = startFlare([], { metric: "itch", start: "2026-08-01" });
    const second = startFlare(first.list, { metric: "pain", start: "2026-08-10" });
    expect(second.refused).toBeUndefined();
    expect(second.list).toHaveLength(2);
  });
  it("ends one, clamping an end before the start", () => {
    const list = [ep({ id: "a", start: "2026-08-05", end: null })];
    expect(endFlare(list, "a", "2026-08-09")[0].end).toBe("2026-08-09");
    expect(endFlare(list, "a", "2026-08-01")[0].end).toBe("2026-08-05");
  });
  it("edits and removes without touching the id", () => {
    const list = [ep({ id: "a" })];
    const edited = updateEpisode(list, "a", { title: "Renamed", id: "hacked" as string });
    expect(edited[0].id).toBe("a");
    expect(edited[0].title).toBe("Renamed");
    expect(removeEpisode(list, "a")).toEqual([]);
  });
});

describe("episodeStats", () => {
  const entries = journal({
    ...flat("2026-06-17", "2026-06-30", 3),   // the fortnight before: calm
    "2026-07-01": 6, "2026-07-02": 8, "2026-07-05": 9, "2026-07-10": 7, "2026-07-14": 5,
    ...flat("2026-07-15", "2026-07-28", 4),   // the fortnight after
  });
  const stats = () => episodeStats(ep(), { entries, today: TODAY, dir: "sym" });

  it("measures duration inclusively and coverage against it", () => {
    const s = stats();
    expect(s.days).toBe(14);
    expect(s.loggedDays).toBe(5);
    expect(s.coverage).toBeCloseTo(5 / 14, 6);
    expect(s.open).toBe(false);
  });
  it("reports the three middles and the peak with its date", () => {
    const s = stats();
    expect(s.average).toBeCloseTo((6 + 8 + 9 + 7 + 5) / 5, 6);
    expect(s.median).toBe(7);
    expect(s.peak).toBe(9);
    expect(s.peakDate).toBe("2026-07-05");
    expect(s.hardDays).toBe(3);   // 8, 9, 7
  });
  it("takes the peak from the worst end for a metric where high is good", () => {
    const s = episodeStats(ep(), { entries, today: TODAY, dir: "pos" });
    expect(s.peak).toBe(5);
    expect(s.peakDate).toBe("2026-07-14");
    expect(s.hardDays).toBe(0);   // badness 5, 3, 2, 4, 6 — none reaches 7
  });
  it("compares against the fortnight before and the fortnight after", () => {
    const s = stats();
    expect(s.baseline).toBeCloseTo(3, 6);
    expect(s.baselineDays).toBe(14);
    expect(s.vsBaseline).toBeCloseTo(7 - 3, 6);
    expect(s.after).toBeCloseTo(4, 6);
    expect(s.afterDays).toBe(14);
  });
  it("has no 'after' while the episode is still running", () => {
    const s = episodeStats(ep({ end: null }), { entries, today: TODAY, dir: "sym" });
    expect(s.open).toBe(true);
    expect(s.after).toBeNull();
    expect(s.afterDays).toBe(0);
    expect(s.days).toBe(daySpan("2026-07-01", TODAY));
  });
  it("counts the gap since the previous episode ended", () => {
    const all = [ep({ id: "prev", start: "2026-05-01", end: "2026-06-01" }), ep()];
    const s = episodeStats(ep(), { entries, today: TODAY, dir: "sym", all });
    expect(s.sincePrevious).toBe(30);   // Jun 1 → Jul 1
  });
  it("has no gap to report for the first episode, or after one that never ended", () => {
    expect(episodeStats(ep(), { entries, today: TODAY, all: [ep()] }).sincePrevious).toBeNull();
    const all = [ep({ id: "prev", start: "2026-05-01", end: null }), ep()];
    expect(episodeStats(ep(), { entries, today: TODAY, all }).sincePrevious).toBeNull();
  });
  it("stays null-safe on an episode with nothing logged in it", () => {
    const s = episodeStats(ep({ start: "2024-01-01", end: "2024-01-05" }),
      { entries, today: TODAY, dir: "sym" });
    expect(s.days).toBe(5);
    expect(s.loggedDays).toBe(0);
    expect(s.average).toBeNull();
    expect(s.peak).toBeNull();
    expect(s.vsBaseline).toBeNull();
  });
});

describe("a year of episodes", () => {
  const list = [
    ep({ id: "a", start: "2026-02-01", end: "2026-02-10" }),   // 10 days
    ep({ id: "b", start: "2026-06-01", end: "2026-06-30" }),   // 30 days
    ep({ id: "c", start: "2025-12-28", end: "2026-01-03" }),   // 4 days in 2026
    ep({ id: "d", start: "2025-04-01", end: "2025-04-05" }),
  ];
  const opts = { entries: journal({ "2026-02-03": 8, "2026-06-05": 6 }), today: TODAY, dir: "sym" as const };

  it("clips a flare that crosses New Year into both years", () => {
    expect(daysInYear(list[2], 2025, TODAY)).toBe(4);   // Dec 28–31
    expect(daysInYear(list[2], 2026, TODAY)).toBe(3);   // Jan 1–3
  });
  it("counts episodes by the year they started, and flare days by the year they fell in", () => {
    const y = episodeYear(list, 2026, opts);
    expect(y.count).toBe(2);                   // a and b started in 2026
    expect(y.flareDays).toBe(10 + 30 + 3);     // c's January tail counts too
    expect(y.avgDuration).toBeCloseTo(20, 6);
    expect(y.longest!.id).toBe("b");
  });
  it("averages episode scores and peaks across the year", () => {
    const y = episodeYear(list, 2026, opts);
    expect(y.avgScore).toBeCloseTo(7, 6);
    expect(y.avgPeak).toBeCloseTo(7, 6);
  });
  it("compares against last year and says whether last year is worth comparing to", () => {
    const c = compareEpisodeYears(list, 2026, opts);
    expect(c.now.count).toBe(2);
    expect(c.prev.count).toBe(2);              // d and c started in 2025
    expect(c.deltaCount).toBe(0);
    expect(c.comparable).toBe(true);
    expect(compareEpisodeYears(list, 2025, opts).comparable).toBe(false);
  });
});

describe("bands behind the chart", () => {
  const list = [
    ep({ id: "a", start: "2026-07-01", end: "2026-07-14" }),
    ep({ id: "b", start: "2026-08-10", end: null }),
    ep({ id: "old", start: "2025-01-01", end: "2025-01-05" }),
  ];
  it("clips to the window and drops what falls outside it", () => {
    const bands = episodeBands(list, "2026-07-10", TODAY, TODAY);
    expect(bands.map((b) => b.id)).toEqual(["a", "b"]);
    expect(bands[0]).toMatchObject({ from: "2026-07-10", to: "2026-07-14", open: false });
    expect(bands[1]).toMatchObject({ from: "2026-08-10", to: TODAY, open: true });
  });
  it("filters by metric when asked", () => {
    const mixed = [...list, ep({ id: "s", metric: "sleep", start: "2026-07-20", end: "2026-07-25" })];
    expect(episodeBands(mixed, "2026-07-01", TODAY, TODAY, "sleep").map((b) => b.id)).toEqual(["s"]);
  });
});

describe("wording", () => {
  it("scales the duration unit to the duration", () => {
    expect(durationLabel(1)).toBe("1 day");
    expect(durationLabel(9)).toBe("9 days");
    expect(durationLabel(21)).toBe("3 weeks");
    expect(durationLabel(90)).toBe("3 months");
  });
  it("says which day of an ongoing flare it is", () => {
    expect(episodeWhen(ep({ start: "2026-08-14", end: null }), TODAY)).toBe("Ongoing · day 5");
    expect(episodeWhen(ep(), TODAY)).toBe("2 weeks");
  });
});
