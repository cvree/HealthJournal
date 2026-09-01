/* Shown when local data exists but can't be parsed/validated. Previously the
   app silently reset to a blank install — a data-loss path. Now the person can
   download the raw stored data first, then explicitly choose to start fresh. */

import React from "react";
import { C } from "../lib/theme";
import { saveFile } from "../lib/saveFile";

export default function RecoveryScreen({
  raw,
  detail,
  onStartFresh,
}: {
  raw: string;
  detail?: string;
  onStartFresh: () => void;
}) {
  /* Through lib/saveFile, like every other file this app hands over. It matters
     more here than anywhere: this button is the last copy of a journal that
     will not open, and inside the packaged app a bare anchor does nothing at
     all — which would mean offering somebody a rescue that silently is not
     one, immediately before offering to wipe what is left. */
  const downloadRaw = () => {
    void saveFile(
      new Blob([raw], { type: "application/json" }),
      `bellwether-recovered-${new Date().toISOString().slice(0, 10)}.json`
    );
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
