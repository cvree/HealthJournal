/* Read-only web viewer landing. Opens a Health Journal JSON backup
   (data-only or full-with-photos) entirely in this browser tab — nothing is
   uploaded, nothing is saved. Meant for reviewing your journal on a desktop,
   or for a partner/clinician you've handed a backup file to. */

import React, { useRef, useState } from "react";

const C = {
  bg: "#F2F4F1",
  card: "#FFFFFF",
  ink: "#1F2B27",
  sub: "#66736D",
  line: "#E2E7E2",
  accent: "#33685A",
};

export default function ViewerLanding({
  onFileText,
  onDemo,
  error,
  busy,
}: {
  onFileText: (text: string) => void;
  onDemo: () => void;
  error?: string | null;
  busy?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const readFile = (file: File | undefined | null) => {
    if (!file) return;
    file.text().then(onFileText, () => onFileText("")); // empty text -> parse error path
  };

  return (
    <div
      className="min-h-screen flex items-center"
      style={{ background: C.bg, color: C.ink, fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}
    >
      <div className="max-w-md mx-auto px-4 w-full py-10">
        <h1 className="text-3xl mb-1" style={{ fontFamily: "'Fraunces Variable', 'Fraunces', Georgia, serif" }}>
          Health Journal
        </h1>
        <div className="text-sm mb-6" style={{ color: C.sub }}>
          Read-only viewer · everything stays in this browser tab
        </div>

        <div
          role="button"
          tabIndex={0}
          aria-label="open a journal backup file"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); readFile(e.dataTransfer.files?.[0]); }}
          className="rounded-2xl p-8 text-center cursor-pointer"
          style={{
            background: C.card,
            border: `2px dashed ${dragOver ? C.accent : C.line}`,
          }}
        >
          <div className="text-base font-semibold mb-1">Open a journal backup</div>
          <div className="text-sm leading-relaxed" style={{ color: C.sub }}>
            Choose or drop a <span className="font-mono text-[12px]">.json</span> backup exported from the app
            (data-only or full backup with photos).
          </div>
          {busy && <div className="text-sm mt-3" style={{ color: C.accent }}>Opening…</div>}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label="journal backup file"
          onChange={(e) => readFile(e.target.files?.[0])}
        />

        {error && (
          <div className="mt-3 rounded-xl px-4 py-3 text-sm" role="alert"
            style={{ background: "#F7ECEA", color: "#B4433C", border: "1px solid #E8D4D1" }}>
            {error}
          </div>
        )}

        <button
          onClick={onDemo}
          className="w-full mt-4 py-3 rounded-xl text-sm font-semibold"
          style={{ background: C.card, border: `1px solid ${C.line}`, color: C.ink }}
        >
          Browse example data instead
        </button>

        <p className="text-[11px] leading-relaxed mt-6" style={{ color: C.sub }}>
          Nothing you open here is uploaded or stored — closing the tab discards it. This viewer cannot edit a
          journal. The journal is a personal tracking tool and is not medical advice; it does not diagnose,
          treat, cure, or prevent any condition.
        </p>
      </div>
    </div>
  );
}
