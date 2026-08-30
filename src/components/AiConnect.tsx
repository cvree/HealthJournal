/* Connecting an AI, for somebody who has never heard the phrase "API key".

   The app already had a way to do this: a five-step wizard with a provider
   comparison, a storage-mode choice, and a page of consent copy. It is a good
   wizard and it belongs in Settings, where somebody has gone looking. It is
   the wrong thing entirely to put in front of a person who has just said yes
   to logging their meals — because at that moment they were not asking to
   configure anything. They were saying "yes, I'd like the app to do that".

   So this is the other shape of the same job: not a wizard, a favour. Three
   screens, one decision, and everything that can be done for the person is
   done for them.

   **The decision is made.** No provider comparison. Google's is the free one,
   it needs an account almost everybody already has, and it is what the wizard
   recommends anyway — so this offers it and mentions the rest exactly once,
   as a link out to the full setup for the two people a year who want it.

   **The key never has to be typed.** The whole difficulty of this task is that
   the credential lives on somebody else's website and has to get back here.
   So: the console opens in its own tab, and the moment this tab is looked at
   again the clipboard is read on its own. If a key is on it, it is filled in,
   checked with Google, saved, and the screen says "connected" — with nothing
   pressed at all. Browsers that will not read a clipboard without being asked
   get one enormous Paste button instead, which does the identical thing. The
   text field is still there, third, for the one person whose phone refuses
   both.

   **It cannot dead-end.** Every screen has a way out that is not a failure,
   the key is verified before it is called connected, and a key that will not
   verify says why in a sentence with no jargon in it.

   Nothing here is required, nothing here is remembered as a nag, and saying
   "not now" is a complete answer that is never asked about again. */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { C } from "../lib/theme";
import { feedback } from "../lib/feedback";
import { lockPageScroll } from "../lib/motion";
import {
  PROVIDERS, loadConnection, saveConnection, testConnection, looksLikeKey, maskKey,
} from "../lib/ai";

type IconComponent = React.ComponentType<{ name: string; size?: number; color?: string }>;

export type AiConnectCopy = {
  /** Eyebrow over the offer — where this came from. "Meals & drinks". */
  eyebrow: string;
  /** The headline, in terms of the thing they just said yes to. */
  title: string;
  /** One paragraph on what it does for *them*, not what it is. */
  blurb: string;
  /** Three or four concrete things it will do. Verb first. */
  points: string[];
  /** One sentence for the end of it, saying what is true now. Written as a
      sentence rather than derived from `points` — a bullet re-punctuated into
      prose reads exactly like a bullet re-punctuated into prose. */
  done: string;
};

type Props = {
  Icon: IconComponent;
  copy: AiConnectCopy;
  /** Connected, and the key is on the device. */
  onConnected: () => void;
  /** Closed without connecting — "not now", the ×, or Escape. */
  onDismiss: () => void;
};

type Stage = "offer" | "key" | "done";
type Check =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "ok"; model: string | null }
  | { state: "bad"; message: string };

const GEMINI = PROVIDERS.gemini;

/* Google's own four steps, said for this screen rather than for the wizard.

   The provider definition carries a set of these already, and they are good —
   but their last line says "come back here and paste it on the next step",
   and here there is no next step. The paste happens on this screen, on its
   own, the moment the tab is looked at again. Getting that sentence wrong is
   how somebody comes back, finds no field, and gives up two taps from the
   end. */
const STEPS: [string, string][] = [
  ["Sign in", "with any Google account — the one you already use. There is nothing new to create."],
  ["Press “Create API key”", "on the page that opens. If it asks which project, any of them will do."],
  ["Copy it", "with the copy button beside it. That is the last thing you have to do over there."],
  ["Come back to this tab", "and stop. This page reads it off your clipboard and connects on its own."],
];

/** Whether this browser will even discuss its clipboard with us. Chrome and
    Edge will, on a gesture and often without one; Safari wants the gesture;
    Firefox refuses outright, which is why nothing here depends on it. */
const clipboardReadable = () =>
  typeof navigator !== "undefined" && !!navigator.clipboard?.readText;

export default function AiConnect({ Icon, copy, onConnected, onDismiss }: Props) {
  const [stage, setStage] = useState<Stage>("offer");
  const [draft, setDraft] = useState("");
  const [check, setCheck] = useState<Check>({ state: "idle" });
  const [typing, setTyping] = useState(false);   // the field, shown as a last resort
  const [opened, setOpened] = useState(false);   // the console was opened at least once
  const [autoTried, setAutoTried] = useState(false);
  const [existing, setExisting] = useState<string | null>(null);
  const alive = useRef(true);
  const seq = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => { alive.current = false; }, []);

  /* A key already on this device is the whole job already done. Nobody should
     be walked to Google for a second copy of something they have. */
  useEffect(() => {
    loadConnection().then((conn) => {
      if (!alive.current || !conn) return;
      setExisting(maskKey(conn.key));
      setCheck({ state: "ok", model: conn.model || null });
      setStage("done");
    });
  }, []);

  /* Whatever the last state of the flow is, Escape has to agree with the ×
     about what it does — which is not `onDismiss` once a key is on the device.
     Held in a ref so the listener is bound once and still reads the truth. */
  const leaveRef = useRef<() => void>(() => onDismiss());
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") leaveRef.current(); };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus?.();
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  /* The page underneath must not move while this is over it — the same lock
     every sheet in the app uses, reference-counted, so opening this from
     inside a food sheet and closing it again leaves that sheet's own lock
     exactly as it found it. */
  useEffect(() => lockPageScroll(), []);

  /** Check it, save it, and say so. The one path every route into this file
      ends at, so a key pasted, typed or lifted off the clipboard is treated
      exactly alike. */
  const accept = useCallback(async (raw: string) => {
    const key = raw.trim();
    if (!looksLikeKey(key)) {
      setCheck({
        state: "bad",
        message: "That doesn't look like a key yet — it should be one long line with no spaces in it.",
      });
      return false;
    }
    const mine = ++seq.current;
    setCheck({ state: "checking" });
    /* Listing the models is the check: it proves Google is reachable from this
       browser, that the key is accepted, and that something usable sits behind
       it. Verifying the key alone is how a retired model reaches somebody as a
       404 a week later. */
    const res = await testConnection({ provider: "gemini", key });
    if (!alive.current || mine !== seq.current) return false;
    if (!res.ok) {
      setCheck({ state: "bad", message: res.message || "That key was not accepted." });
      return false;
    }
    await saveConnection({ provider: "gemini", key, model: res.model }, "persist");
    if (!alive.current) return false;
    feedback("complete");
    setCheck({ state: "ok", model: res.model || null });
    setStage("done");
    return true;
  }, []);

  /** Read the clipboard and use whatever is on it. Silent when there is
      nothing useful there or the browser says no — this is a favour being
      attempted, and a favour that fails should not become an error message. */
  const takeFromClipboard = useCallback(async (loud: boolean) => {
    if (!clipboardReadable()) {
      if (loud) setTyping(true);
      return false;
    }
    let text = "";
    try {
      text = (await navigator.clipboard.readText()) || "";
    } catch {
      if (loud) { setTyping(true); requestAnimationFrame(() => inputRef.current?.focus()); }
      return false;
    }
    const key = text.trim();
    if (!looksLikeKey(key)) {
      if (loud) {
        setCheck({
          state: "bad",
          message: "Nothing that looks like a key was copied yet. Copy it on the Google page — then press this again.",
        });
        setTyping(true);
      }
      return false;
    }
    setDraft(key);
    return accept(key);
  }, [accept]);

  /* The automatic half. Coming back to this tab is the signal that the errand
     is over, so that is when the clipboard is read — once, quietly, and only
     after the console has actually been opened. Getting it right means the
     person returns to a screen that already says "connected", which is the
     whole point of the exercise. */
  useEffect(() => {
    if (stage !== "key" || !opened || autoTried) return;
    const tryNow = () => {
      if (document.visibilityState !== "visible") return;
      setAutoTried(true);
      void takeFromClipboard(false);
    };
    document.addEventListener("visibilitychange", tryNow);
    window.addEventListener("focus", tryNow);
    return () => {
      document.removeEventListener("visibilitychange", tryNow);
      window.removeEventListener("focus", tryNow);
    };
  }, [stage, opened, autoTried, takeFromClipboard]);

  const openConsole = () => {
    feedback("nav");
    setOpened(true);
    setAutoTried(false);
    setCheck({ state: "idle" });
    window.open(GEMINI.keyUrl, "_blank", "noopener,noreferrer");
  };

  /* Closing this once a key is actually on the device is not a refusal. The
     person asked for the thing, the thing happened, and quietly leaving the
     feature switched off because they used the × rather than the button would
     be the app punishing them for closing a dialog it had finished with. */
  const dismiss = () => {
    feedback("tap");
    if (stage === "done") onConnected();
    else onDismiss();
  };
  leaveRef.current = dismiss;

  /* Portalled to the body, and it has to be. This is raised from inside a
     bottom sheet, and a sheet carries a transform for its drag gesture —
     which makes it the containing block for any `position: fixed` descendant.
     Rendered in place, this overlay was fixed to the *sheet* rather than to
     the window: a scrim that dimmed two-thirds of the screen and a card
     centred on the wrong thing. */
  const panel = (
    <div className="fhj-aic-scrim" role="dialog" aria-modal="true" aria-label="Connect an AI">
      <div className="fhj-aic" ref={panelRef} tabIndex={-1} data-lenis-prevent>
        <button type="button" className="fhj-aic-x" onClick={dismiss} aria-label="Close">
          <Icon name="x" size={15} color={C.sub} />
        </button>

        {stage === "offer" && (
          <>
            <div className="fhj-aic-eyebrow">{copy.eyebrow}</div>
            <h2 className="fhj-aic-title">{copy.title}</h2>
            <p className="fhj-aic-body">{copy.blurb}</p>

            <ul className="fhj-aic-points">
              {copy.points.map((p) => (
                <li key={p}>
                  <span className="fhj-aic-tick" aria-hidden="true">
                    <Icon name="check" size={11} color={C.onAccent} />
                  </span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>

            {/* The two facts somebody is entitled to before they are sent to
                another company's website, said before the button rather than
                after it. */}
            <div className="fhj-aic-facts">
              <p><b>It's free.</b> {GEMINI.free} You make the account, so there is nothing to cancel.</p>
              <p><b>Your journal stays here.</b> Only the thing you ask about is ever sent — a photo of a
                plate, a note you paste in. Never your name, never the rest of your days.</p>
            </div>

            <button type="button" className="fhj-aic-go" onClick={() => { feedback("nav"); setStage("key"); }}>
              <span>Set it up — about a minute</span>
              <Icon name="right" size={16} color={C.onAccent} />
            </button>
            <button type="button" className="fhj-aic-quiet" onClick={dismiss}>
              Not now — I'll type it all in myself
            </button>
            <p className="fhj-aic-foot">
              You can turn this on later in Settings, and off again just as easily.
            </p>
          </>
        )}

        {stage === "key" && (
          <>
            <div className="fhj-aic-eyebrow">One page, one button</div>
            <h2 className="fhj-aic-title">Get your free key from Google</h2>
            <p className="fhj-aic-body">
              This opens in its own tab, so nothing here is lost. Sign in, press the button Google
              shows you, and copy what it gives you — then come straight back. This page will do
              the rest on its own.
            </p>

            <button type="button" className="fhj-aic-go" onClick={openConsole}>
              <Icon name="link" size={16} color={C.onAccent} />
              <span>{opened ? "Open Google again" : "Open Google AI Studio"}</span>
            </button>

            {/* The four steps are for somebody who has not gone yet. Once they
                have, this screen's whole job is to be short and to have the
                one button they need at the top of it — a wall of instructions
                for an errand already run is a wall between them and the end. */}
            {opened ? (
              <p className="fhj-aic-body">
                Copied it? Press the button below and you are done. If the tab did not open, the
                address is <b style={{ color: C.ink, wordBreak: "break-all" }}>
                  {GEMINI.keyUrl.replace(/^https?:\/\//, "")}
                </b> on any device — get the key there and come back.
              </p>
            ) : (
              <ol className="fhj-aic-steps">
                {STEPS.map(([title, body], i) => (
                  <li key={title}>
                    <span className="fhj-aic-num">{i + 1}</span>
                    <span>
                      <b>{title}</b>
                      <span>{body}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}

            {/* The manual half of the automatic thing. It says what it does,
                because "Paste" on a screen with no visible field is otherwise
                a button with no consequence. */}
            <button type="button" className="fhj-aic-paste"
              onClick={() => { feedback("tap"); void takeFromClipboard(true); }}>
              <Icon name="check" size={15} color={C.accentText} />
              <span>
                <b>I've copied it — paste it for me</b>
                <span>Reads the key off your clipboard and connects. Nothing to type.</span>
              </span>
            </button>

            <div className="fhj-aic-status" role="status" aria-live="polite">
              {check.state === "checking" && (
                <span className="fhj-aic-checking">
                  <span className="fhj-dots" aria-hidden="true"><span /><span /><span /></span>
                  Checking it with Google…
                </span>
              )}
              {check.state === "bad" && <span className="fhj-aic-bad">{check.message}</span>}
            </div>

            {typing ? (
              <div className="fhj-aic-field">
                <label htmlFor="fhj-aic-key">Or paste it here by hand</label>
                <input id="fhj-aic-key" ref={inputRef} type="password" className="fhj-input"
                  value={draft} placeholder="AQ.…"
                  autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    setCheck({ state: "idle" });
                    /* A key arriving whole — pasted, or autofilled — is a key
                       to check now. Somebody typing one character at a time is
                       not, so nothing fires until it is plausibly complete. */
                    if (looksLikeKey(e.target.value)) void accept(e.target.value);
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") void accept(draft); }} />
              </div>
            ) : (
              <button type="button" className="fhj-aic-quiet"
                onClick={() => { setTyping(true); requestAnimationFrame(() => inputRef.current?.focus()); }}>
                Paste it in by hand instead
              </button>
            )}

            <button type="button" className="fhj-aic-quiet" onClick={dismiss}>
              Skip this — I'll do it later
            </button>
          </>
        )}

        {stage === "done" && (
          <>
            <div className="fhj-aic-done-mark" aria-hidden="true">
              <Icon name="check" size={26} color={C.onAccent} />
            </div>
            <h2 className="fhj-aic-title">
              {existing ? "Already connected" : "Connected"}
            </h2>
            <p className="fhj-aic-body">
              {existing
                ? "There was already a key on this device, so there was nothing to do. "
                : "That's it — the key is saved on this device and nowhere else. "}
              {copy.done}
            </p>
            <div className="fhj-aic-chip">
              <Icon name="key" size={14} color={C.good} />
              <span>
                <b>{GEMINI.label}</b>
                <span>
                  {existing || maskKey(draft)}
                  {check.state === "ok" && check.model ? ` · ${check.model}` : ""}
                </span>
              </span>
            </div>
            <button type="button" className="fhj-aic-go" onClick={() => { feedback("nav"); onConnected(); }}>
              <span>Carry on</span>
              <Icon name="right" size={16} color={C.onAccent} />
            </button>
            <p className="fhj-aic-foot">
              The key is kept on this device and nowhere else. A photo or a note is read at the
              moment you attach it and nothing else leaves — no schedule, no background sending,
              and nothing about the rest of your journal. Remove the key in Settings whenever you
              like and the app goes back to working entirely offline.
            </p>
          </>
        )}
      </div>
    </div>
  );

  return typeof document === "undefined" ? panel : createPortal(panel, document.body);
}
