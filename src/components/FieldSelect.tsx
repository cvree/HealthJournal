/* The metric picker used by "Possible relationships".

   It used to be a native <select> with the platform arrow stripped off. That
   was defensible — the platform's own "choose one of many" control, a wheel on
   a phone — and it was the one control in the app that looked like it belonged
   to a different app. On a desktop it drops a white 1990s list box over a dark
   card, in the browser's font, with the unselected options greyed to the point
   of illegibility, and nothing about it can be styled. Two dozen metrics in
   that list is also genuinely hard to read: no grouping, no units, no search.

   So this is the app's own control, built out of the shapes the app already
   uses. The trigger is a card, and the list opens in the same sheet every
   other choice in this app opens in — grabber, heading, scrim, drag to
   dismiss. Each option says what it is measured in, ratings are grouped apart
   from things with their own units, and once there are more than a handful
   there is a filter field. Nothing here is a new idea; it is the same sheet
   the food and bowel forms use, pointed at a list. */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { C } from "../lib/theme";
import { lockPageScroll } from "../lib/motion";

export type SelectOption = {
  k: string;
  label: string;
  type?: string;
  unit?: string;
};

type Props = {
  /** Sits above the value, and titles the sheet. */
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (k: string) => void;
  /** Drawn as the trigger's dot, so the control carries the screen's colour. */
  tint?: string;
  /** Extra line under the sheet's title. */
  hint?: string;
  onFeedback?: (kind: string) => void;
};

/** Show the filter field once scanning the list stops being instant. */
const FILTER_AT = 9;

/* Ratings deliberately say nothing here: they are all 1–10, the group they sit
   under says so once, and printing it on twelve consecutive rows is noise. */
const unitOf = (o: SelectOption) =>
  o.type === "scale" ? "" : o.type === "toggle" ? "yes / no" : o.unit || "";

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" fill="none" stroke="currentColor" strokeWidth="2.6"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function FieldSelect({
  label, value, options, onChange, tint, hint, onFeedback,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(value);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const autoId = React.useId();
  const titleId = `fhj-sel-${autoId}`;

  const current = options.find((o) => o.k === value) || options[0];

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  /* Ratings first and apart: they are the things this screen can put on one
     axis, and mixing them into an alphabetical soup with "Weight" and "Doses
     taken" is what made the old list hard to read. */
  const groups = useMemo(() => {
    const rated = matches.filter((o) => o.type === "scale");
    const rest = matches.filter((o) => o.type !== "scale");
    return [
      { id: "rated", title: "Rated 1–10", items: rated },
      { id: "rest", title: "Measured its own way", items: rest },
    ].filter((g) => g.items.length > 0);
  }, [matches]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(value);
  }, [open, value]);

  // The page underneath does not move while the sheet is up. See lib/motion.
  useEffect(() => (open ? lockPageScroll() : undefined), [open]);

  /* Focus lands on the list, not the filter field: a keyboard opens over half
     the sheet on a phone, and the first thing most people do is scroll. */
  useEffect(() => {
    if (open) listRef.current?.focus();
    else triggerRef.current?.focus({ preventScroll: true });
  }, [open]);

  const close = () => setOpen(false);

  const commit = (k: string) => {
    onFeedback?.("select");
    onChange(k);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    if (!flat.length) return;
    const i = flat.findIndex((o) => o.k === active);
    let next = -1;
    if (e.key === "ArrowDown") next = Math.min(flat.length - 1, i + 1);
    else if (e.key === "ArrowUp") next = Math.max(0, i - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = flat.length - 1;
    else if (e.key === "Enter" || e.key === " ") {
      const pick = flat[i] || flat[0];
      if (pick) { e.preventDefault(); commit(pick.k); }
      return;
    } else return;
    e.preventDefault();
    const target = flat[next < 0 ? 0 : next];
    if (!target) return;
    setActive(target.k);
    /* Looked up by walking the rendered rows rather than a selector: a field
       key is user-authored and can contain anything a CSS selector would
       choke on. */
    const rows = listRef.current?.querySelectorAll<HTMLElement>("[data-k]") || [];
    for (const row of Array.from(rows)) {
      if (row.dataset.k === target.k) { row.scrollIntoView?.({ block: "nearest" }); break; }
    }
  };

  const sheet = open && typeof document !== "undefined" ? createPortal(
    <div className="fhj-scrim" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="fhj-sheet fhj-sel-sheet" role="dialog" aria-modal="true"
        aria-labelledby={titleId} data-lenis-prevent>
        <div className="fhj-sheet-grab" aria-hidden="true" />
        <div className="fhj-sheet-head">
          <div className="min-w-0">
            <div className="fhj-eyebrow mb-0.5">Choose</div>
            <h2 id={titleId} className="font-display text-xl leading-snug">{label}</h2>
            {hint && (
              <p className="text-[11.5px] leading-snug mt-1" style={{ color: C.subtle }}>{hint}</p>
            )}
          </div>
          <button type="button" onClick={close} aria-label="Close"
            className="fhj-icon-btn shrink-0" style={{ width: "2.5rem", height: "2.5rem" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" style={{ color: C.sub }}>
              <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="fhj-sheet-body" ref={listRef} tabIndex={-1} onKeyDown={onKeyDown}
          id={`${titleId}-list`} style={{ outline: "none" }} role="listbox" aria-label={label}
          aria-activedescendant={active ? `${titleId}-${active}` : undefined}>
          {options.length >= FILTER_AT && (
            <div className="fhj-sel-filter">
              <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" style={{ color: C.subtle }}>
                <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d="M20 20l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <input value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder={`Filter ${options.length} metrics`} aria-label={`Filter ${label}`}
                className="fhj-sel-filter-input" style={{ color: C.ink }} />
              {query && (
                <button type="button" onClick={() => setQuery("")} aria-label="Clear filter"
                  className="fhj-sel-filter-clear">
                  <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor"
                      strokeWidth="2.4" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>
          )}

          {groups.map((g) => (
            <div key={g.id} className="fhj-sel-group">
              {groups.length > 1 && <div className="fhj-eyebrow fhj-sel-group-title">{g.title}</div>}
              {g.items.map((o) => {
                const selected = o.k === value;
                const unit = unitOf(o);
                return (
                  <button key={o.k} type="button" role="option" aria-selected={selected}
                    id={`${titleId}-${o.k}`} data-k={o.k}
                    onClick={() => commit(o.k)}
                    onMouseEnter={() => setActive(o.k)}
                    className={"fhj-opt" + (selected ? " is-selected" : "")
                      + (o.k === active && !selected ? " is-active" : "")}>
                    <span className="fhj-opt-name">{o.label}</span>
                    {unit && <span className="fhj-opt-unit">{unit}</span>}
                    <span className="fhj-opt-check" aria-hidden="true">{selected && <Check />}</span>
                  </button>
                );
              })}
            </div>
          ))}

          {flat.length === 0 && (
            <p className="text-sm py-6 text-center" style={{ color: C.subtle }}>
              Nothing here matches “{query.trim()}”.
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      {/* The select-only combobox pattern: a button that owns the listbox,
          rather than a listbox pretending to be one. */}
      <button type="button" ref={triggerRef} className={"fhj-select" + (open ? " is-open" : "")}
        role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-label={label}
        aria-controls={open ? `${titleId}-list` : undefined}
        onClick={() => { onFeedback?.("tap"); setOpen(true); }}>
        <span className="fhj-select-body">
          <span className="fhj-eyebrow">{label}</span>
          <span className="fhj-select-value">
            {tint && <span className="fhj-select-dot" style={{ background: tint }} aria-hidden="true" />}
            <span className="truncate">{current?.label || "—"}</span>
          </span>
        </span>
        <span className="fhj-select-chev" aria-hidden="true">
          <svg width="15" height="15" viewBox="0 0 24 24">
            <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {sheet}
    </>
  );
}
