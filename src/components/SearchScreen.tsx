/* One box, over the whole journal.

   The arithmetic is all in src/lib/search.ts — this file is the surface, and
   it is deliberately thin. What it adds is the three things a search screen
   lives or dies on:

   · **It answers before you finish typing.** The index is built once by the
     app and handed down; every keystroke is a re-rank of an array that is
     already in memory. There is no debounce because there is nothing to wait
     for.
   · **It says what it did.** The line under the box names the filters that are
     on, because the commonest failed search is one with a filter somebody
     forgot about, and "no results" cannot tell them that.
   · **Every row goes somewhere.** A result that cannot be opened is a result
     that wasted a tap.

   The empty state is not a shrug. It is where the query language is taught,
   in the form of five searches somebody might actually want to run — a syntax
   reference nobody reads, written as answers instead. */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { C } from "../lib/theme";
import {
  KIND_ICON, KIND_LABEL, KIND_ONE, KIND_ORDER, SEARCH_EXAMPLES, SEARCH_SYNTAX,
  describeSearch, highlight, parseQuery, runSearch,
  type SearchDoc, type SearchHit, type SearchKind, type SearchTarget,
} from "../lib/search";
import type { SurveyQuestion } from "../types/models";

type IconComponent = React.ComponentType<{ name: string; size?: number; color?: string }>;

type Props = {
  /** The journal, flattened. Built by the app so it survives a re-render. */
  docs: SearchDoc[];
  today: string;
  /** The questions this journal asks — what `pain>7` is resolved against. */
  fields?: SurveyQuestion[];
  Icon: IconComponent;
  /** Where a result goes. The app owns every screen id in a SearchTarget. */
  onGo: (target: SearchTarget) => void;
  onFeedback?: (kind: string) => void;
  /** Pre-filled query, for a deep link or a "search this" button elsewhere. */
  initialQuery?: string;
  /** Nice dates, the app's own formatter. */
  formatDate?: (iso: string) => string;
};

/** Marked runs, rendered. Kept here rather than in the module because the
    module has no business knowing what a highlight looks like. */
function Marked({ value, terms }: { value: string; terms: readonly string[] }) {
  const parts = useMemo(() => highlight(value, terms), [value, terms]);
  return (
    <>
      {parts.map((p, i) => (p.hit
        ? <mark key={i} className="fhj-sr-hit">{p.text}</mark>
        : <span key={i}>{p.text}</span>))}
    </>
  );
}

function ResultRow({
  hit, active, Icon, onOpen, formatDate,
}: {
  hit: SearchHit;
  active: boolean;
  Icon: IconComponent;
  onOpen: () => void;
  formatDate: (iso: string) => string;
}) {
  const { doc, terms } = hit;
  return (
    <button type="button" onClick={onOpen} data-search-row
      className={"fhj-sr-row" + (active ? " is-active" : "")}>
      <span className="fhj-sr-icon" aria-hidden="true">
        <Icon name={KIND_ICON[doc.kind]} size={13} color="currentColor" />
      </span>
      <span className="fhj-sr-body">
        <span className="fhj-sr-title"><Marked value={doc.title} terms={terms} /></span>
        {doc.subtitle && (
          <span className="fhj-sr-sub"><Marked value={doc.subtitle} terms={terms} /></span>
        )}
        {hit.snippet && hit.snippet !== doc.title && (
          <span className="fhj-sr-snip"><Marked value={hit.snippet} terms={terms} /></span>
        )}
      </span>
      <span className="fhj-sr-meta">
        <span className="fhj-sr-kind">{KIND_ONE[doc.kind]}</span>
        {doc.date && <span className="fhj-sr-date">{formatDate(doc.date)}</span>}
      </span>
    </button>
  );
}

const isoNice = (iso: string): string => iso;

export default function SearchScreen({
  docs, today, fields = [], Icon, onGo, onFeedback, initialQuery = "", formatDate = isoNice,
}: Props) {
  const [q, setQ] = useState(initialQuery);
  const [kind, setKind] = useState<SearchKind | "all">("all");
  const [active, setActive] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const boxRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  /* Focus the box on a pointer device only. On a phone an autofocus throws the
     keyboard up over the examples, which are the part of this screen a first
     visit is actually for. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(hover: hover) and (pointer: fine)").matches) boxRef.current?.focus();
  }, []);

  const parsed = useMemo(() => parseQuery(q, today), [q, today]);
  const all = useMemo(
    () => runSearch(docs, parsed, { today, fields, limit: 300 }),
    [docs, parsed, today, fields]
  );

  /* The chip row filters the ranked list rather than re-running the search, so
     the counts on the chips are the counts of the search — a chip that says 6
     and then shows 4 is a chip nobody trusts again. */
  const hits = useMemo(
    () => (kind === "all" ? all.hits : all.hits.filter((h) => h.doc.kind === kind)),
    [all, kind]
  );

  useEffect(() => { setActive(0); }, [q, kind]);
  /* A filter that has nothing left in it is a dead end you cannot see the way
     out of, so it lets go of itself when the query moves on. */
  useEffect(() => {
    if (kind !== "all" && !all.counts[kind]) setKind("all");
  }, [all, kind]);

  const open = (hit: SearchHit) => {
    onFeedback?.("nav");
    onGo(hit.doc.target);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!hits.length) return;
      e.preventDefault();
      const next = e.key === "ArrowDown"
        ? Math.min(hits.length - 1, active + 1)
        : Math.max(0, active - 1);
      setActive(next);
      const rows = listRef.current?.querySelectorAll("[data-search-row]");
      (rows?.[next] as HTMLElement | undefined)?.scrollIntoView?.({ block: "nearest" });
      return;
    }
    if (e.key === "Enter" && hits[active]) {
      e.preventDefault();
      open(hits[active]);
      return;
    }
    if (e.key === "Escape" && q) {
      e.preventDefault();
      setQ("");
    }
  };

  const kindsPresent = KIND_ORDER.filter((k) => all.counts[k]);
  const summary = describeSearch(parsed, all);

  /* Only the days carry numbers, so a comparison that matched is worth saying
     out loud: it is the one query somebody runs to get a count. */
  const compared = all.resolved.map(
    ({ term, field }) => `${field.label} ${term.op} ${term.value}`
  );

  return (
    <div className="px-4 pb-10 pt-3">
      <h2 className="font-display text-xl">Search</h2>
      <p className="text-[12.5px] leading-relaxed mt-1 mb-3" style={{ color: C.subtle }}>
        Every note, meal, dose, movement, result and screen in this journal. It never leaves
        the device — this is your own data, read where it already is.
      </p>

      <div className="fhj-sr-box">
        <Icon name="search" size={16} color={C.subtle} />
        <input
          ref={boxRef}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search your journal"
          aria-label="Search your journal"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
        />
        {q && (
          <button type="button" onClick={() => { setQ(""); boxRef.current?.focus(); }}
            aria-label="Clear search" className="fhj-sr-clear">
            <Icon name="x" size={13} color={C.sub} />
          </button>
        )}
      </div>

      {parsed.chips.length > 0 && (
        <div className="fhj-sr-chips" role="list" aria-label="Filters in this search">
          {parsed.chips.map((c, i) => (
            <span key={i} className="fhj-sr-filter" role="listitem">{c.label}</span>
          ))}
        </div>
      )}

      {/* The summary and the empty state would otherwise say the same sentence
          twice about an unrecognised question name, four inches apart. */}
      {!parsed.empty && !all.unknownFields.length && (
        <div className="fhj-sr-summary" aria-live="polite">
          {summary}
          {compared.length > 0 && (
            <span className="fhj-sr-compared"> · {compared.join(", ")}</span>
          )}
        </div>
      )}

      {!parsed.empty && kindsPresent.length > 1 && (
        <div className="fhj-sr-kinds" role="tablist" aria-label="Narrow by kind">
          <button type="button" role="tab" aria-selected={kind === "all"}
            className={"fhj-sr-kind-chip" + (kind === "all" ? " is-on" : "")}
            onClick={() => { onFeedback?.("tap"); setKind("all"); }}>
            All <span>{all.total}</span>
          </button>
          {kindsPresent.map((k) => (
            <button key={k} type="button" role="tab" aria-selected={kind === k}
              className={"fhj-sr-kind-chip" + (kind === k ? " is-on" : "")}
              onClick={() => { onFeedback?.("tap"); setKind(k); }}>
              {KIND_LABEL[k]} <span>{all.counts[k]}</span>
            </button>
          ))}
        </div>
      )}

      {parsed.empty ? (
        <>
          <div className="fhj-section mt-5 fhj-cat-symptom">
            <h3 className="fhj-section-title">Try one of these</h3>
          </div>
          <div className="flex flex-col gap-2">
            {SEARCH_EXAMPLES.map((ex) => (
              <button key={ex.q} type="button" className="fhj-sr-example"
                onClick={() => { onFeedback?.("tap"); setQ(ex.q); boxRef.current?.focus(); }}>
                <code>{ex.q}</code>
                <span>{ex.why}</span>
              </button>
            ))}
          </div>

          <button type="button" className="fhj-sr-helptoggle mt-4"
            aria-expanded={showHelp}
            onClick={() => { onFeedback?.("tap"); setShowHelp((v) => !v); }}>
            <span>How to narrow it down</span>
            <Icon name={showHelp ? "up" : "down"} size={14} color={C.sub} />
          </button>
          {showHelp && (
            <dl className="fhj-sr-syntax">
              {SEARCH_SYNTAX.map((s) => (
                <React.Fragment key={s.token}>
                  <dt><code>{s.token}</code></dt>
                  <dd>{s.means}</dd>
                </React.Fragment>
              ))}
            </dl>
          )}
        </>
      ) : !hits.length ? (
        <div className="fhj-empty mt-4">
          <div className="fhj-empty-title">
            {all.unknownFields.length
              ? `No question here is called “${all.unknownFields[0]}”`
              : "Nothing matched"}
          </div>
          <div className="fhj-empty-text">
            {all.unknownFields.length
              ? "Comparisons work against the questions your journal asks — try the name as it appears on the daily log."
              : parsed.chips.length
                ? "Every filter has to be satisfied at once. Dropping one usually finds it."
                : "Only what has actually been logged is here. Nothing is hidden behind a filter."}
          </div>
          {parsed.chips.length > 0 && (
            <button type="button" className="fhj-btn fhj-btn-secondary fhj-btn-sm mt-3"
              onClick={() => {
                onFeedback?.("tap");
                setQ(parsed.words.concat(parsed.phrases.map((p) => `"${p}"`)).join(" "));
              }}>
              Search without the filters
            </button>
          )}
        </div>
      ) : (
        <div ref={listRef} className="fhj-sr-list mt-3" role="list">
          {hits.map((h, i) => (
            <ResultRow key={h.doc.id} hit={h} active={i === active} Icon={Icon}
              formatDate={formatDate} onOpen={() => open(h)} />
          ))}
          {all.total > all.hits.length && (
            <p className="fhj-sr-more">
              {all.total - all.hits.length} more matched. Narrowing it down — a date, a kind,
              a second word — is faster than scrolling.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
