/* The sync surface, as a user meets it.
 *
 * The engine has its own suite; this one is about the promises the screen
 * makes. Two of them are load-bearing and easy to break by accident:
 *
 *   - Local Only reads as a complete product, not as a missing feature.
 *   - The Privacy card tells the truth about whichever state the app is in.
 *     A card that is accurate by default and quietly wrong once a feature is
 *     switched on is worse than no card at all.
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import React from "react";
import { render, cleanup, fireEvent, waitFor, within } from "@testing-library/react";

beforeEach(() => cleanup());

beforeAll(() => {
  (globalThis as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.matchMedia = window.matchMedia || ((q: string) => ({
    matches: q.includes("reduce"), media: q,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
    dispatchEvent: () => false,
  } as any));
  window.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

const I = async () => (await import("../src/App")).__internals as any;

const OFF = { phase: "off", pending: 0, lastSyncedAt: null, ready: false, action: null };
const ON = { phase: "idle", pending: 0, lastSyncedAt: null, ready: true, action: null, email: "me@example.com" };

/** Enough of the engine for the card to render against. The real one is
    exercised in syncEngine.test.ts; here it would only add a network. */
const fakeEngine = (over: any = {}) => ({
  photosEnabled: () => false,
  setPhotoSync: vi.fn(),
  getEmail: () => null,
  countLocal: () => 0,
  settle: vi.fn(async () => ON),
  disable: vi.fn(async () => {}),
  requestCode: vi.fn(async () => {}),
  verifyCode: vi.fn(async () => ({ userId: "u", email: "me@example.com" })),
  hasRemoteMeta: vi.fn(async () => false),
  unlock: vi.fn(async () => ({ created: true })),
  enable: vi.fn(async () => ON),
  ...over,
});

describe("the Settings card", () => {
  it("says Local only, and says it as a state rather than as a lack", async () => {
    const { SyncCard } = await I();
    const { container } = render(
      React.createElement(SyncCard, { engine: fakeEngine(), status: OFF, available: true })
    );
    expect(container.textContent).toContain("Local only");
    expect(container.textContent).toMatch(/saved on this device/i);
    expect(container.textContent).toMatch(/no account, nothing uploaded/i);
  });

  it("offers the guided flow when a server is configured", async () => {
    const { SyncCard } = await I();
    const { container } = render(
      React.createElement(SyncCard, { engine: fakeEngine(), status: OFF, available: true })
    );
    expect(container.textContent).toContain("Set up sync");
  });

  it("explains an unconfigured build without making it sound broken", async () => {
    const { SyncCard } = await I();
    const { container } = render(
      React.createElement(SyncCard, { engine: fakeEngine(), status: OFF, available: false })
    );
    expect(container.textContent).not.toContain("Set up sync");
    expect(container.textContent).toMatch(/local only — which is the default and works completely/i);
  });

  it("distinguishes synced from saved-here once it is on", async () => {
    const { SyncCard } = await I();
    const { container } = render(
      React.createElement(SyncCard, { engine: fakeEngine(), status: ON, available: true })
    );
    expect(container.textContent).toContain("Synced");
    expect(container.textContent).toMatch(/saved on this device and synced across your devices/i);
    expect(container.textContent).toContain("me@example.com");
  });

  it("never calls an offline device an error, and says the data is safe", async () => {
    const { SyncCard } = await I();
    const { container } = render(
      React.createElement(SyncCard, {
        engine: fakeEngine(),
        status: { ...ON, phase: "offline", pending: 3, message: undefined },
        available: true,
      })
    );
    expect(container.textContent).toContain("3 waiting");
    expect(container.textContent).toMatch(/saved here and will sync when you're back online/i);
    expect(container.textContent).not.toMatch(/error|failed|lost/i);
  });

  it("turns a blocked state into one thing to tap", async () => {
    const { SyncCard } = await I();
    const { container } = render(
      React.createElement(SyncCard, {
        engine: fakeEngine(),
        status: { ...ON, phase: "blocked", action: "passphrase", message: "Enter your sync passphrase to unlock the synced journal on this device." },
        available: true,
      })
    );
    expect(container.textContent).toContain("Needs you");
    expect(container.textContent).toContain("Enter passphrase");
  });
});

describe("the guided flow", () => {
  const openFlow = async () => {
    const { SyncCard } = await I();
    const engine = fakeEngine();
    const r = render(React.createElement(SyncCard, { engine, status: OFF, available: true }));
    fireEvent.click(r.getByText("Set up sync"));
    return { ...r, engine };
  };

  it("explains what happens before asking for anything", async () => {
    const r = await openFlow();
    expect(document.body.textContent).toMatch(/log a meal on your\s+phone/i);
    expect(document.body.textContent).toMatch(/encrypted before it leaves this device/i);
    // No field is asked for on the first screen.
    expect(document.body.querySelector("#fhj-sync-email")).toBe(null);
    r.unmount();
  });

  it("states the web-delivery caveat instead of implying more than it earns", async () => {
    const r = await openFlow();
    expect(document.body.textContent).toMatch(/can't protect you from someone who controls the site/i);
    expect(document.body.textContent).not.toMatch(/zero.knowledge|HIPAA/i);
    r.unmount();
  });

  it("asks for an email, not a password", async () => {
    const r = await openFlow();
    fireEvent.click(r.getByText("Continue"));
    expect(document.body.querySelector("#fhj-sync-email")).toBeTruthy();
    expect(document.body.textContent).toMatch(/no password to invent or remember/i);
    r.unmount();
  });

  it("won't email a code to something that isn't an address", async () => {
    const r = await openFlow();
    fireEvent.click(r.getByText("Continue"));
    const send = r.getByText("Email me a code") as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.change(document.body.querySelector("#fhj-sync-email")!, { target: { value: "me@example.com" } });
    expect((r.getByText("Email me a code") as HTMLButtonElement).disabled).toBe(false);
    r.unmount();
  });

  it("asks a new journal to choose a passphrase, and warns what losing it costs", async () => {
    const r = await openFlow();
    fireEvent.click(r.getByText("Continue"));
    fireEvent.change(document.body.querySelector("#fhj-sync-email")!, { target: { value: "me@example.com" } });
    fireEvent.click(r.getByText("Email me a code"));
    await waitFor(() => expect(document.body.querySelector("#fhj-sync-code")).toBeTruthy());
    fireEvent.change(document.body.querySelector("#fhj-sync-code")!, { target: { value: "123456" } });
    fireEvent.click(r.getByText("Continue"));
    await waitFor(() => expect(document.body.querySelector("#fhj-sync-pass")).toBeTruthy());
    expect(document.body.textContent).toMatch(/nobody, including us, can reset it/i);
    expect(document.body.textContent).toMatch(/the journal on this device is unaffected/i);
    // A weak passphrase can't get past this screen.
    expect((r.getByText("Turn on sync") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(document.body.querySelector("#fhj-sync-pass")!, { target: { value: "marble kettle thistle 41" } });
    expect((r.getByText("Turn on sync") as HTMLButtonElement).disabled).toBe(false);
    r.unmount();
  });

  it("asks an existing journal for the passphrase it already has", async () => {
    const { SyncCard } = await I();
    const engine = fakeEngine({ hasRemoteMeta: vi.fn(async () => true) });
    const r = render(React.createElement(SyncCard, { engine, status: OFF, available: true }));
    fireEvent.click(r.getByText("Set up sync"));
    fireEvent.click(r.getByText("Continue"));
    fireEvent.change(document.body.querySelector("#fhj-sync-email")!, { target: { value: "me@example.com" } });
    fireEvent.click(r.getByText("Email me a code"));
    await waitFor(() => expect(document.body.querySelector("#fhj-sync-code")).toBeTruthy());
    fireEvent.change(document.body.querySelector("#fhj-sync-code")!, { target: { value: "123456" } });
    fireEvent.click(r.getByText("Continue"));
    await waitFor(() => expect(document.body.textContent).toMatch(/already encrypted/i));
    // "Choose one" would silently lock them out of everything already synced.
    expect(document.body.textContent).not.toMatch(/Choose a passphrase/i);
    expect(r.getByText("Unlock and sync")).toBeTruthy();
    r.unmount();
  });

  it("shows a failure in place instead of losing the step", async () => {
    const { SyncCard } = await I();
    const engine = fakeEngine({ requestCode: vi.fn(async () => { throw new Error("session: that address was rejected"); }) });
    const r = render(React.createElement(SyncCard, { engine, status: OFF, available: true }));
    fireEvent.click(r.getByText("Set up sync"));
    fireEvent.click(r.getByText("Continue"));
    fireEvent.change(document.body.querySelector("#fhj-sync-email")!, { target: { value: "me@example.com" } });
    fireEvent.click(r.getByText("Email me a code"));
    await waitFor(() => expect(document.body.querySelector("[role='alert']")).toBeTruthy());
    // The internal prefix the engine uses to classify auth failures is not
    // something to show a person.
    expect(document.body.querySelector("[role='alert']")!.textContent).toBe("that address was rejected");
    expect(document.body.querySelector("#fhj-sync-email")).toBeTruthy();
    r.unmount();
  });
});

describe("the privacy card follows what is actually switched on", () => {
  it("claims no account and no server while sync is off", async () => {
    const { PrivacyCard } = await I();
    const { container } = render(React.createElement(PrivacyCard, { syncOn: false }));
    expect(container.textContent).toContain("No account");
    expect(container.textContent).toContain("No server");
  });

  it("drops both claims once sync is on, rather than leaving them standing", async () => {
    const { PrivacyCard } = await I();
    const { container } = render(
      React.createElement(PrivacyCard, { syncOn: true, syncEmail: "me@example.com" })
    );
    expect(container.textContent).not.toContain("No account");
    expect(container.textContent).not.toContain("There is no backend holding a copy");
    expect(container.textContent).toContain("me@example.com");
    expect(container.textContent).toMatch(/encrypted before it's uploaded/i);
  });

  it("says what it cannot promise, in the same breath", async () => {
    const { PrivacyCard } = await I();
    const { container } = render(React.createElement(PrivacyCard, { syncOn: true }));
    expect(container.textContent).toMatch(/can't protect you from someone who controls the site/i);
    expect(container.textContent).toMatch(/no HIPAA or medical-records claim is made/i);
  });

  /* The card is the one place in the app where the privacy claim has to be
     exactly as strong as its worst case. Turning AI on gives the worst case a
     second half — importing your own notes sends the notes — so the card has
     to name it and must not still be saying everything else stays here. */
  it("names both things AI can send, and drops the everything-else-stays claim", async () => {
    const { PrivacyCard } = await I();
    const { container } = render(React.createElement(PrivacyCard, { aiEnabled: true }));
    fireEvent.click(within(container as HTMLElement).getByRole("button", { name: /read the rest/i }));
    expect(container.textContent).toMatch(/analysis you run/i);
    expect(container.textContent).toMatch(/importing your own notes sends the notes/i);
    expect(container.textContent).not.toMatch(/everything else still stays/i);
  });

  it("says the app is offline until something is switched on, and names the four switches", async () => {
    const { PrivacyCard } = await I();
    const { container } = render(React.createElement(PrivacyCard, {}));
    fireEvent.click(within(container as HTMLElement).getByRole("button", { name: /read the rest/i }));
    expect(container.textContent).toMatch(/no network requests/i);
    for (const named of [/AI observations/i, /importing your own notes/i, /sync/i, /daily context/i]) {
      expect(container.textContent).toMatch(named);
    }
  });
});

describe("what a failure says", () => {
  it("replaces the browser's words with the user's", async () => {
    const { describeBackendError } = await import("../src/lib/sync/supabase");
    for (const raw of ["Failed to fetch", "NetworkError when attempting to fetch resource.", "Load failed", "net::ERR_NAME_NOT_RESOLVED"]) {
      const out = describeBackendError(new Error(raw));
      expect(out).toMatch(/couldn't reach the sync server/i);
      // The reassurance is the part that actually matters on this screen.
      expect(out).toMatch(/nothing has been lost/i);
    }
  });

  it("keeps the marker the engine uses to tell an expired sign-in apart", async () => {
    const { describeBackendError } = await import("../src/lib/sync/supabase");
    expect(describeBackendError(new Error("JWT expired"))).toMatch(/^session: /);
  });

  it("passes a message that was already written for a person straight through", async () => {
    const { describeBackendError } = await import("../src/lib/sync/supabase");
    expect(describeBackendError(new Error("That code didn't work."))).toBe("That code didn't work.");
  });

  it("always says something, even handed nothing", async () => {
    const { describeBackendError } = await import("../src/lib/sync/supabase");
    expect(describeBackendError(null, "Couldn't save.")).toBe("Couldn't save.");
    expect(describeBackendError(new Error(""))).toBe("Something went wrong.");
  });
});

describe("the one place sync appears outside Settings", () => {
  it("renders nothing while everything is fine", async () => {
    const { SyncAlert } = await I();
    for (const status of [OFF, ON, { ...ON, phase: "syncing" }, { ...ON, phase: "offline", pending: 4 }]) {
      const { container } = render(React.createElement(SyncAlert, { status, onOpen: () => {} }));
      // A permanent status light on a journal someone opens to record pain is a
      // small anxiety generator. Working, offline and retrying all mean "do
      // nothing", so nothing is drawn.
      expect(container.textContent).toBe("");
      cleanup();
    }
  });

  it("stays quiet while a transient failure is retrying on its own", async () => {
    const { SyncAlert } = await I();
    const { container } = render(React.createElement(SyncAlert, {
      status: { ...ON, phase: "error", action: "retry", message: "Couldn't reach the sync server." },
      onOpen: () => {},
    }));
    expect(container.textContent).toBe("");
  });

  it("appears only when the app genuinely can't proceed alone", async () => {
    const { SyncAlert } = await I();
    const onOpen = vi.fn();
    const { container } = render(React.createElement(SyncAlert, {
      status: { ...ON, phase: "blocked", action: "signIn", message: "Your sign-in expired." },
      onOpen,
    }));
    expect(container.textContent).toContain("Sync");
    fireEvent.click(container.querySelector("button")!);
    expect(onOpen).toHaveBeenCalled();
  });
});

describe("results are heard, not only seen", () => {
  /* Before the feedback layer had a failure voice, a failed backup and a
     successful one were equally silent — the app only had sounds for things
     going right. These assert the message still lands and that reporting one
     can never itself throw, whatever the audio device is doing. */
  it("shows the message and reports the outcome", async () => {
    const { reportResult } = await I();
    const setMsg = vi.fn();
    const failure = { ok: false, text: "Couldn't build the backup on this device." };
    expect(reportResult(setMsg, failure)).toBe(failure);
    expect(setMsg).toHaveBeenCalledWith(failure);
  });

  it("never lets reporting a result become its own failure", async () => {
    const { reportResult } = await I();
    expect(() => reportResult(() => {}, { ok: true, text: "Saved." })).not.toThrow();
    expect(() => reportResult(() => {}, null)).not.toThrow();
  });
});
