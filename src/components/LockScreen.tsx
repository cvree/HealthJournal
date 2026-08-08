/* PIN entry UI, shared by two flows:
   - "verify": unlocking the app, or confirming the current PIN before
     changing/turning it off in Settings.
   - "create": choosing a new PIN (enter twice, must match).
   A hidden numeric input drives everything so the native keyboard/haptics
   feel right on phones; the dots are just a visual readout of its value. */

import React, { useEffect, useRef, useState } from "react";
import { C } from "../lib/theme";
import { prefersReducedMotion } from "../lib/motion";
import { PIN_LENGTH, isValidPin } from "../lib/lock";

interface LockScreenProps {
  mode: "verify" | "create";
  title: string;
  subtitle?: string;
  tint?: string;
  /** verify: return whether the PIN was correct. create: called once two
   *  entries match; the caller hashes + persists it. */
  onSubmit: (pin: string) => Promise<boolean> | boolean;
  onForgot?: () => void;
  onCancel?: () => void;
}

export default function LockScreen({ mode, title, subtitle, tint = C.accent, onSubmit, onForgot, onCancel }: LockScreenProps) {
  const [value, setValue] = useState("");
  const [stage, setStage] = useState<"first" | "confirm">("first");
  const [firstPin, setFirstPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, [stage]);
  // A disabled input can't hold focus — once `busy` flips back to false the
  // DOM node is re-enabled, but focus isn't restored automatically, so a
  // correct retry after a wrong PIN would otherwise silently go nowhere.
  useEffect(() => { if (!busy) inputRef.current?.focus(); }, [busy]);

  const reset = () => { setValue(""); };

  const fail = (message: string) => {
    setError(message);
    reset();
    if (!prefersReducedMotion()) {
      setShake(true);
      setTimeout(() => setShake(false), 420);
    }
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(20);
  };

  const handleComplete = async (pin: string) => {
    setError(null);
    if (mode === "verify") {
      setBusy(true);
      const ok = await onSubmit(pin);
      setBusy(false);
      if (!ok) fail("That PIN doesn't match. Try again.");
      // On success the parent swaps to a different screen/flow step (each
      // given a distinct `key` in App.tsx so it mounts fresh) — but clear
      // the entered value defensively in case this instance sticks around.
      else reset();
      return;
    }
    // mode === "create"
    if (stage === "first") {
      setFirstPin(pin);
      setStage("confirm");
      reset();
      return;
    }
    if (pin !== firstPin) {
      fail("PINs didn't match — let's start over.");
      setStage("first");
      setFirstPin("");
      return;
    }
    setBusy(true);
    await onSubmit(pin);
    setBusy(false);
  };

  const onChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, PIN_LENGTH);
    setValue(digits);
    if (digits.length === PIN_LENGTH && isValidPin(digits)) handleComplete(digits);
  };

  const stageTitle = mode === "create" && stage === "confirm" ? "Confirm your PIN" : title;
  const stageSubtitle = mode === "create" && stage === "confirm" ? "Enter it once more to confirm." : subtitle;

  return (
    <div className="min-h-screen flex items-center" style={{ background: C.bg, color: C.ink, fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
      <style>{`
        @keyframes hjShake { 10%, 90% { transform: translateX(-1px); } 20%, 80% { transform: translateX(2px); }
          30%, 50%, 70% { transform: translateX(-4px); } 40%, 60% { transform: translateX(4px); } }
        .hj-shake { animation: hjShake 400ms cubic-bezier(.36,.07,.19,.97); }
      `}</style>
      <div className="max-w-md mx-auto px-4 w-full">
        <div className={`rounded-2xl p-6 text-center ${shake ? "hj-shake" : ""}`} style={{ background: C.card, border: `1px solid ${C.line}` }}>
          <div className="text-xl mb-1" style={{ fontFamily: "'Fraunces Variable', 'Fraunces', Georgia, serif" }}>
            {stageTitle}
          </div>
          {stageSubtitle && (
            <p className="text-sm leading-relaxed mb-4" style={{ color: C.sub }}>{stageSubtitle}</p>
          )}

          <div className="relative my-5" style={{ height: 0 }}>
            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              value={value}
              disabled={busy}
              onChange={(e) => onChange(e.target.value)}
              aria-label={stageTitle}
              className="absolute inset-0 w-full opacity-0"
              style={{ height: 44 }}
            />
          </div>

          <button
            type="button"
            onClick={() => inputRef.current?.focus()}
            className="flex items-center justify-center gap-3 mx-auto mb-4 py-2"
            aria-hidden="true"
            tabIndex={-1}
          >
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <span
                key={i}
                className="w-3.5 h-3.5 rounded-full transition-colors"
                style={{ background: i < value.length ? tint : C.line }}
              />
            ))}
          </button>

          {error && <p className="text-xs mb-3" style={{ color: C.bad }}>{error}</p>}
          {busy && <p className="text-xs mb-3" style={{ color: C.sub }}>Checking…</p>}

          {mode === "verify" && onForgot && (
            <button onClick={onForgot} className="text-xs font-medium underline mt-1" style={{ color: C.sub }}>
              Forgot your PIN?
            </button>
          )}
          {onCancel && (
            <button onClick={onCancel} className="block w-full text-xs font-medium mt-4" style={{ color: C.sub }}>
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
