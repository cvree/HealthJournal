/* Shown when local data exists but can't be parsed/validated. Previously the
   app silently reset to a blank install — a data-loss path. Now the person can
   download the raw stored data first, then explicitly choose to start fresh. */

import React from "react";
import { C } from "../lib/theme";

export default function RecoveryScreen({
  raw,
  detail,
  onStartFresh,
}: {
  raw: string;
  detail?: string;
  onStartFresh: () => void;
}) {
  const downloadRaw = () => {
    const blob = new Blob([raw], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `health-journal-recovered-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const startFresh = () => {
    if (
      window.confirm(
        "Start fresh? This replaces the unreadable saved data with a new, empty journal. Download the recovery file first if you haven't."
      )
    ) {
      onStartFresh();
    }
  };

  return (
    <div
      className="min-h-screen flex items-center"
      style={{ background: C.bg, color: C.ink, fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}
    >
      <div className="max-w-md mx-auto px-4 w-full">
        <div className="rounded-2xl p-5" style={{ background: C.card, border: `1px solid ${C.line}` }}>
          <div className="text-xl mb-2" style={{ fontFamily: "'Fraunces Variable', 'Fraunces', Georgia, serif" }}>
            Saved data couldn't be read
          </div>
          <p className="text-sm leading-relaxed mb-2" style={{ color: C.sub }}>
            The journal found saved data on this device, but it isn't in a shape it can open. Nothing has
            been deleted. Download the recovery file to keep a copy — it may be restorable from the Export
            screen later, or fixable by hand.
          </p>
          {detail && (
            <p className="text-[11px] leading-relaxed mb-3 rounded-lg px-3 py-2" style={{ color: C.sub, background: C.bg }}>
              {detail}
            </p>
          )}
          <button
            onClick={downloadRaw}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white mb-2"
            style={{ background: C.accent }}
          >
            Download recovery file
          </button>
          <button
            onClick={startFresh}
            className="w-full py-3 rounded-xl text-sm font-semibold"
            style={{ background: C.bg, color: C.bad, border: `1px solid ${C.line}` }}
          >
            Start fresh
          </button>
        </div>
      </div>
    </div>
  );
}
