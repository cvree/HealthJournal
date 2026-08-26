/* Sessions that end themselves, sessions you can come back to, and the one
   question the app is allowed to ask in exchange.

   The guarantee under test throughout: an automation may write a record, but it
   may never write a record that is indistinguishable from one a person made. */
import { describe, it, expect } from "vitest";
import { causalLanguageAudit } from "../src/lib/validate";
import {
  AUTOMATIONS, automationDecided, automationOn, sanitizeAutomationSettings,
  setAutomation, unmetRequirements,
} from "../src/lib/automation";
import { emptyPresence, observe } from "../src/lib/presence";
import {
  MAX_SESSION_MINUTES, MIN_AUTO_END_MINUTES,
  addSample, autoEndArmed, autoEndDecision, autoEndStatus, confirmPrompt, confirmSession,
  endNote, finishSession, loadLiveSession, resumeDecision, reviseSession,
  sanitizeStoredLive, sanitizeSunSessions, saveLiveSession, clearLiveSession,
  startSession, tickPresence, truncateLive, unconfirmed,
  type LiveSession, type StoredLive,
} from "../src/lib/sun";

const LONDON = { lat: 51.5, lon: -0.13 };
/* Solar noon in London on the longest day, under TZ=UTC. */
const NOON = new Date(2026, 5, 21, 12, 0, 0);
const at = (mins: number) => new Date(NOON.getTime() + mins * 60000);
const DAY = "2026-06-21";

/** A session running from solar noon, sampled every minute. */
function running(mins: number, opts: Partial<LiveSession> = {}): LiveSession {
  let live = startSession(NOON, { coords: LONDON, skin: 2, exposure: "arms", autoEnd: true, ...opts });
  for (let t = 0; t <= mins; t += 1) live = addSample(live, at(t));
  return live;
}

/** Feed a run of same-accuracy fixes into a session's presence model. */
function fixes(live: LiveSession, fromMin: number, mins: number, accuracy: number): LiveSession {
  let presence = live.presence || emptyPresence();
  for (let i = 0; i <= mins; i += 1) {
    presence = observe(presence, { t: at(fromMin + i).getTime(), accuracy });
  }
  return { ...live, presence };
}

/* ---------- a session that ends itself ---------- */

describe("autoEndDecision", () => {
  it("ends the session when the phone stops seeing sky, at the time it stopped", () => {
    let live = running(30);
    live = fixes(live, 0, 18, 9);
    live = fixes(live, 19, 10, 130);
    const d = autoEndDecision(live, at(30))!;
    expect(d).not.toBeNull();
    expect(d.reason).toBe("auto-indoor");
    /* Nineteen minutes in, not twenty-nine. */
    expect(d.at.getTime()).toBe(at(19).getTime());
    expect(d.confidence).toBeGreaterThan(0.5);
  });

  it("does nothing at all while somebody is plainly still outside", () => {
    let live = running(40);
    live = fixes(live, 0, 40, 8);
    expect(autoEndDecision(live, at(40))).toBeNull();
  });

  it("leaves a session alone in its first few minutes, whatever the fixes say", () => {
    /* Starting a session in the hallway and walking out is normal. Ending it
       there because the hallway has a roof is not. */
    let live = running(4);
    live = fixes(live, 0, 4, 200);
    expect(autoEndDecision(live, at(4))).toBeNull();
    expect(MIN_AUTO_END_MINUTES).toBeGreaterThan(4);
  });

  it("never ends a session before it could have been outside at all", () => {
    let live = running(20);
    live = fixes(live, 0, 20, 200); // indoors from the very first fix
    const d = autoEndDecision(live, at(20));
    if (d) expect(d.at.getTime()).toBeGreaterThanOrEqual(NOON.getTime() + MIN_AUTO_END_MINUTES * 60000);
  });

  it("does nothing when the automation is switched off, however good the evidence", () => {
    let live = running(30, { autoEnd: false });
    live = fixes(live, 0, 12, 9);
    live = fixes(live, 13, 15, 150);
    expect(autoEndDecision(live, at(30))).toBeNull();
  });

  it("closes a forgotten session at the cap, and says the time is a guess", () => {
    const live = running(20, { autoEnd: false });
    const d = autoEndDecision(live, at(MAX_SESSION_MINUTES + 30))!;
    expect(d.reason).toBe("auto-cap");
    expect(d.confidence).toBeLessThan(0.3);
    expect(d.detail).toMatch(/guess/i);
  });

  it("closes a forgotten session at sundown rather than at the cap when the sun set first", () => {
    /* A session begun at 8pm and left running: the last sample with the sun
       above the horizon is a far better end than "six hours later, at 2am". */
    let live = startSession(new Date(2026, 5, 21, 20, 0, 0), { coords: LONDON, autoEnd: false });
    for (let t = 0; t <= MAX_SESSION_MINUTES; t += 10) {
      live = addSample(live, new Date(live.startedAt + t * 60000));
    }
    const d = autoEndDecision(live, new Date(live.startedAt + (MAX_SESSION_MINUTES + 5) * 60000))!;
    expect(d.reason).toBe("auto-cap");
    expect(d.at.getTime()).toBeLessThan(live.startedAt + MAX_SESSION_MINUTES * 60000);
  });

  it("speaks about what the phone saw, never about what the body did", () => {
    let live = running(30);
    live = fixes(live, 0, 12, 9);
    live = fixes(live, 13, 15, 150);
    const d = autoEndDecision(live, at(30))!;
    expect(causalLanguageAudit([d.detail])).toEqual([]);
    expect(d.detail).toMatch(/your phone/i);
  });
});

describe("autoEndArmed", () => {
  it("is armed while fixes are arriving and not armed once they stop", () => {
    const live = fixes(running(20), 0, 20, 9);
    expect(autoEndArmed(live, at(21))).toBe(true);
    expect(autoEndArmed(live, at(120))).toBe(false);
  });

  it("is never armed for a session that was not allowed to end itself", () => {
    const live = fixes(running(20, { autoEnd: false }), 0, 20, 9);
    expect(autoEndArmed(live, at(21))).toBe(false);
  });
});

describe("tickPresence", () => {
  it("notices the fixes have dried up without needing a new one to arrive", () => {
    const live = fixes(running(20), 0, 20, 9);
    expect(live.presence!.sky).toBe("outdoor");
    const later = tickPresence(live, at(200));
    expect(later.presence!.sky).toBe("unknown");
  });
});

/* ---------- what gets written ---------- */

describe("the record an automation writes", () => {
  it("is a real session, marked as an estimate and asking to be confirmed", () => {
    let live = running(40);
    live = fixes(live, 0, 18, 9);
    live = fixes(live, 19, 10, 130);
    const d = autoEndDecision(live, at(40))!;
    const s = finishSession(live, d.at, DAY, { endSource: d.reason });
    expect(s.minutes).toBe(19);
    expect(s.endSource).toBe("auto-indoor");
    expect(s.estimated).toBe(true);
    expect(s.confirmed).toBe(false);
    /* Everything else is an ordinary session — it counts, it charts, it has a
       dose. Being an estimate is a label, not a lesser class of record. */
    expect(s.sed).toBeGreaterThan(0);
    expect(s.iuHigh).toBeGreaterThan(0);
  });

  it("throws away the samples taken after the person went inside", () => {
    let live = running(40);
    const trimmed = truncateLive(live, at(19));
    expect(live.samples.length).toBe(41);
    expect(trimmed.samples.every((x) => x.t <= 19)).toBe(true);
    /* Left in, those twenty-one indoor samples would be averaged into the UV
       and quietly inflate the dose of a session that had already ended. */
    const kept = finishSession(live, at(19), DAY, { endSource: "auto-indoor" });
    const all = finishSession(live, at(40), DAY);
    expect(kept.sed).toBeLessThan(all.sed);
  });

  it("marks a session somebody finished themselves as neither estimated nor pending", () => {
    const s = finishSession(running(30), at(30), DAY);
    expect(s.endSource).toBe("manual");
    expect(s.estimated).toBe(false);
    expect(s.confirmed).toBe(true);
    expect(endNote(s)).toBe("");
  });

  it("labels itself wherever it is drawn, before and after confirming", () => {
    let live = fixes(fixes(running(40), 0, 18, 9), 19, 10, 130);
    const s = finishSession(live, autoEndDecision(live, at(40))!.at, DAY, { endSource: "auto-indoor" });
    expect(endNote(s)).toMatch(/not confirmed/i);
    expect(endNote(confirmSession(s))).toMatch(/automatically/i);
    /* Confirming does not launder an estimate into a measurement. */
    expect(confirmSession(s).estimated).toBe(true);
  });

  it("asks one plain question with a time in it", () => {
    let live = fixes(fixes(running(40), 0, 18, 9), 19, 10, 130);
    const s = finishSession(live, autoEndDecision(live, at(40))!.at, DAY, { endSource: "auto-indoor" });
    const q = confirmPrompt(s);
    expect(q).toMatch(/is that about right\?$/i);
    expect(causalLanguageAudit([q])).toEqual([]);
  });
});

describe("unconfirmed", () => {
  it("lists only what is actually waiting, newest first", () => {
    const a = finishSession(running(20), at(20), DAY, { endSource: "auto-indoor" });
    const b = { ...finishSession(running(30), at(30), DAY, { endSource: "auto-cap" }), start: at(90).toISOString() };
    const done = finishSession(running(10), at(10), DAY);
    const rows = unconfirmed([a, b, done]);
    expect(rows.map((r) => r.endSource)).toEqual(["auto-cap", "auto-indoor"]);
    expect(unconfirmed([done])).toEqual([]);
    expect(unconfirmed([confirmSession(a)])).toEqual([]);
  });
});

/* ---------- correcting the guess ---------- */

describe("reviseSession", () => {
  it("recomputes the whole session, not just the label on the duration", () => {
    const long = finishSession(running(60), at(60), DAY, { endSource: "auto-cap" });
    const short = reviseSession(long, at(20));
    expect(short.minutes).toBe(20);
    expect(short.sed).toBeLessThan(long.sed);
    expect(short.iuHigh).toBeLessThan(long.iuHigh);
    expect(short.medFraction).toBeLessThan(long.medFraction);
  });

  it("keeps identity, provenance and everything the person typed", () => {
    const s = { ...finishSession(running(60), at(60), DAY, { endSource: "auto-indoor" }), note: "park bench" };
    const r = reviseSession(s, at(25));
    expect(r.id).toBe(s.id);
    expect(r.date).toBe(s.date);
    expect(r.start).toBe(s.start);
    expect(r.note).toBe("park bench");
    expect(r.endSource).toBe("auto-indoor");
    expect(r.estimated).toBe(true);
    expect(r.createdAt).toBe(s.createdAt);
    /* A revision is an answer, so it settles the question by definition. */
    expect(r.confirmed).toBe(true);
  });

  it("keeps the snapshotted conditions, because revising a clock cannot change what was worn", () => {
    const s = finishSession(running(60, { exposure: "swim", spf: 30, skin: 5 }), at(60), DAY, { endSource: "auto-cap" });
    const r = reviseSession(s, at(20));
    expect(r.exposure).toBe("swim");
    expect(r.spf).toBe(30);
    expect(r.skin).toBe(5);
    expect(r.uvSource).toBe(s.uvSource);
  });

  it("refuses a nonsense correction rather than storing one", () => {
    const s = finishSession(running(60), at(60), DAY, { endSource: "auto-cap" });
    expect(reviseSession(s, at(-500)).minutes).toBe(1);
    expect(reviseSession(s, at(60 * 40)).minutes).toBe(16 * 60);
  });
});

/* ---------- coming back to a session ---------- */

describe("persistence", () => {
  const store = new Map<string, string>();
  const read = (k: string) => store.get(k) ?? null;
  const write = (k: string, v: string) => { store.set(k, v); };
  const remove = (k: string) => { store.delete(k); };

  it("survives a round trip through storage with its evidence intact", () => {
    const live = fixes(running(25), 0, 25, 9);
    saveLiveSession(live, DAY, write);
    const back = loadLiveSession(read)!;
    expect(back.date).toBe(DAY);
    expect(back.live.startedAt).toBe(live.startedAt);
    expect(back.live.samples.length).toBe(live.samples.length);
    /* The presence run has to survive too, or every reload would reset the
       six-minute clock and the session could never end itself. */
    expect(back.live.presence!.since).toBe(live.presence!.since);
    expect(back.live.autoEnd).toBe(true);
    clearLiveSession(remove);
    expect(loadLiveSession(read)).toBeNull();
  });

  it("returns nothing rather than throwing on a half-written value", () => {
    write("fhj:sun:live", "{not json");
    expect(loadLiveSession(read)).toBeNull();
  });

  it("drops a stored session with no usable start", () => {
    expect(sanitizeStoredLive({ date: DAY, live: { startedAt: "soon" } })).toBeNull();
    expect(sanitizeStoredLive({ date: "yesterday", live: { startedAt: 1 } })).toBeNull();
    expect(sanitizeStoredLive(null)).toBeNull();
  });

  it("repairs a hand-edited store", () => {
    const back = sanitizeStoredLive({
      date: DAY,
      live: {
        startedAt: NOON.getTime(), exposure: "spacesuit", shade: "underground",
        spf: 900, skin: 12, forecastUV: 400,
        samples: [{ t: -5, uv: 99, el: 900 }, { t: 3, uv: 6, el: 60 }],
        presence: "nonsense", autoEnd: "yes",
      },
    })!;
    expect(back.live.exposure).toBe("arms");
    expect(back.live.shade).toBe("open");
    expect(back.live.spf).toBe(100);
    expect(back.live.skin).toBeUndefined();
    expect(back.live.forecastUV).toBe(20);
    expect(back.live.samples[0]).toEqual({ t: 0, uv: 20, el: 90 });
    expect(back.live.presence!.sky).toBe("unknown");
    expect(back.live.autoEnd).toBe(true);
  });
});

describe("resumeDecision", () => {
  const stored = (live: LiveSession, date = DAY): StoredLive =>
    ({ live, date, savedAt: NOON.toISOString() });

  it("picks up a session that is plainly still running", () => {
    const d = resumeDecision(stored(fixes(running(25), 0, 25, 9)), at(25));
    expect(d.verdict).toBe("resume");
    expect(d.minutes).toBe(25);
  });

  it("picks it up however long the app was closed, as long as it is credible", () => {
    /* The whole point: leaving the app is not ending the session. */
    const d = resumeDecision(stored(running(5, { autoEnd: false })), at(90));
    expect(d.verdict).toBe("resume");
    expect(d.minutes).toBe(90);
  });

  it("closes one that has plainly been forgotten, with a decision attached", () => {
    const d = resumeDecision(stored(running(20, { autoEnd: false })), at(MAX_SESSION_MINUTES + 60));
    expect(d.verdict).toBe("close");
    expect(d.autoEnd!.reason).toBe("auto-cap");
  });

  it("closes one the phone can prove ended, at the moment it ended", () => {
    let live = fixes(running(30), 0, 18, 9);
    live = fixes(live, 19, 10, 130);
    const d = resumeDecision(stored(live), at(30));
    expect(d.verdict).toBe("close");
    expect(d.autoEnd!.at.getTime()).toBe(at(19).getTime());
  });

  it("drops one left running overnight rather than inventing an end for it", () => {
    const d = resumeDecision(stored(running(10), "2026-06-20"), at(20 * 60));
    expect(d.verdict).toBe("drop");
  });

  it("drops a session that claims to start in the future", () => {
    expect(resumeDecision(stored(running(10)), at(-60)).verdict).toBe("drop");
  });
});

/* ---------- old journals ---------- */

describe("sessions written before any of this existed", () => {
  it("are read back as confirmed manual finishes, because that is what they were", () => {
    const [row] = sanitizeSunSessions([{
      id: "sun_old", date: DAY, start: NOON.toISOString(), end: at(30).toISOString(),
      minutes: 30, exposure: "arms", shade: "open", samples: [], uvSource: "modelled",
      avgUV: 6, peakUV: 7, avgElevation: 55, sed: 2, medFraction: 0.4,
      iu: 900, iuLow: 600, iuHigh: 1400, belowThreshold: false, source: "live",
      createdAt: NOON.toISOString(), updatedAt: NOON.toISOString(),
    }]);
    expect(row.endSource).toBe("manual");
    expect(row.estimated).toBe(false);
    expect(row.confirmed).toBe(true);
    /* And so they never appear in the queue of things to confirm. */
    expect(unconfirmed([row])).toEqual([]);
  });

  it("repairs an unknown end source rather than trusting it", () => {
    const [row] = sanitizeSunSessions([{
      id: "sun_x", date: DAY, start: NOON.toISOString(), minutes: 10,
      exposure: "arms", shade: "open", samples: [], endSource: "telepathy",
      estimated: "sort of", confirmed: 7,
    }]);
    expect(row.endSource).toBe("manual");
    expect(row.estimated).toBe(false);
    expect(row.confirmed).toBe(true);
  });
});

/* ---------- the registry ---------- */

describe("the automation registry", () => {
  it("makes every automation say what it watches, writes and how to undo it", () => {
    for (const a of AUTOMATIONS) {
      expect(a.watches.length).toBeGreaterThan(10);
      expect(a.writes.length).toBeGreaterThan(10);
      expect(a.reversible.length).toBeGreaterThan(10);
    }
  });

  it("ships the two position-watching ones switched off", () => {
    expect(automationOn(undefined, "sun-auto-end")).toBe(false);
    expect(automationOn(undefined, "sun-auto-start")).toBe(false);
    /* Keeping a session you started is not an inference and cannot invent a
       record, so it is on. */
    expect(automationOn(undefined, "sun-resume")).toBe(true);
  });

  it("knows the difference between 'off' and 'never asked'", () => {
    expect(automationDecided(undefined, "sun-auto-end")).toBe(false);
    expect(automationDecided(setAutomation(undefined, "sun-auto-end", false), "sun-auto-end")).toBe(true);
    expect(automationOn(setAutomation(undefined, "sun-auto-end", true), "sun-auto-end")).toBe(true);
  });

  it("says why an automation is not running instead of leaving it on and silent", () => {
    const autoEnd = AUTOMATIONS.find((a) => a.id === "sun-auto-end")!;
    expect(unmetRequirements(autoEnd, { hasLocation: false })).toContain("location");
    expect(unmetRequirements(autoEnd, { hasLocation: true })).toEqual([]);
  });

  it("keeps only switches it recognises", () => {
    expect(sanitizeAutomationSettings({ "sun-auto-end": true, "mind-reading": true }))
      .toEqual({ "sun-auto-end": true });
    expect(sanitizeAutomationSettings({ "sun-auto-end": "yes" })).toBeUndefined();
    expect(sanitizeAutomationSettings(null)).toBeUndefined();
  });

  it("never describes an automation in causal or medical terms", () => {
    expect(causalLanguageAudit(AUTOMATIONS)).toEqual([]);
  });
});

/* ---------- when the platform says no ---------- */

describe("a phone that refuses to give a position", () => {
  it("is recorded as an obstruction, not as somebody changing their mind", () => {
    const live = { ...fixes(running(20), 0, 20, 9), autoEndBlocked: true };
    /* The decision stands. That matters: rewriting `autoEnd` to false here
       would turn a granted permission problem into a preference the person
       never expressed, and the screen would have nothing to explain. */
    expect(live.autoEnd).toBe(true);
    expect(autoEndArmed(live, at(21))).toBe(false);
    expect(autoEndStatus(live, at(21))).toBe("blocked");
  });

  it("never ends a session on evidence it was not allowed to gather", () => {
    let live = fixes(running(30), 0, 18, 9);
    live = { ...fixes(live, 19, 10, 130), autoEndBlocked: true };
    expect(autoEndDecision(live, at(30))).toBeNull();
  });

  it("still closes a forgotten one at the cap, which needs no position at all", () => {
    const live = { ...running(20), autoEndBlocked: true };
    expect(autoEndDecision(live, at(MAX_SESSION_MINUTES + 30))!.reason).toBe("auto-cap");
  });

  it("tells a quiet phone apart from a refused one", () => {
    expect(autoEndStatus(running(5), at(5))).toBe("waiting");
    expect(autoEndStatus(running(5, { autoEnd: false }), at(5))).toBe("off");
    const heard = fixes(running(20), 0, 20, 9);
    expect(autoEndStatus(heard, at(21))).toBe("armed");
    expect(autoEndStatus(heard, at(200))).toBe("quiet");
  });

  it("survives a round trip through storage, so the explanation is still there after a reload", () => {
    const back = sanitizeStoredLive({
      date: DAY,
      live: { startedAt: NOON.getTime(), autoEnd: true, autoEndBlocked: true, samples: [] },
    })!;
    expect(back.live.autoEnd).toBe(true);
    expect(back.live.autoEndBlocked).toBe(true);
  });
});

/* ---------- what leaves the app ---------- */

describe("the exported table", () => {
  it("carries the provenance out of the app with the data", async () => {
    const { buildSunTable } = await import("../src/lib/exports");
    const auto = finishSession(running(30), at(19), DAY, { endSource: "auto-indoor" });
    const byHand = finishSession(running(30), at(30), DAY);
    const table = buildSunTable([auto, byHand] as any);

    /* An estimate that is only labelled inside the app stops being labelled the
       moment somebody hands the file to a clinician — which is exactly when the
       difference matters most. */
    const i = table.header.indexOf("end_time_is_an_estimate");
    const c = table.header.indexOf("end_time_confirmed_by_person");
    const by = table.header.indexOf("ended_by");
    expect(i).toBeGreaterThan(-1);
    expect(table.rows[0][by]).toBe("auto-indoor");
    expect(table.rows[0][i]).toBe("yes");
    expect(table.rows[0][c]).toBe("no");
    expect(table.rows[1][by]).toBe("manual");
    expect(table.rows[1][i]).toBe("no");
    /* A session nobody guessed at has nothing to confirm. */
    expect(table.rows[1][c]).toBe("n/a");
  });
});
