# APP_STATE.md — Bellwether

> Renamed from "Family Bellwether" at 1.0; older sections below still use the old name.

> **2026-07-17 addendum — repo migration (supersedes stale sections below).**
> The app now lives in a GitHub-ready Vite project (`bellwether/`), not a lone artifact file. `src/App.tsx` is the same single-file app (P2.5–P7 all shipped: reports, swipe prefs, photo compare, report history, durability, Fitbit import, onboarding) plus: Lenis smooth scroll, GSAP screen transitions/finish moment, opt-in Vanta backdrop, self-hosted Fraunces (zero external requests), IndexedDB `window.storage` polyfill (`src/lib/storage.ts` — real artifact storage still wins when present), PWA manifest + service worker (installable, offline). Tests: `tests/pure.test.ts` (8 pure-function tests via `__internals`) + `tests/render.test.tsx` (jsdom full-app smoke). `npm run check` = typecheck + test + build, all green. Source of truth: the repo. Remaining: incremental typing of App.tsx, on-device accessibility pass.
>
> **2026-07-17 addendum 2 — typing & architecture hardening.** New typed core: `src/types/models.ts` (AppDatabase, TrackingSetup, SurveyQuestion, CustomQuestion, DailyEntry, AnswerValue, PhotoMetadata/PhotoEntryMeta, ReportModel, ReportCard, ReportRange, ExportRange/ExportTable, UserSettings, OnboardingState); `src/lib/questions.ts` (sanitizeCustomField — wired into computeProfileTemplate so malformed custom questions degrade safely on every surface; isVisibleOn); `src/lib/answers.ts` (isValidAnswer / coerceAnswer / readAnswer / writeAnswer); `src/lib/validate.ts` (validateDatabase, validateReportModel, causalLanguageAudit). Corrupted local data now shows `src/components/RecoveryScreen.tsx` (download raw file, explicit start-fresh) instead of silently resetting. `__internals` widened with export helpers. Tests: 35 across contract/exports/pure/render suites, all against Connor demo data. App.tsx keeps @ts-nocheck; the typed contract is enforced at runtime + in tests until modules migrate out.
>
> **2026-07-17 addendum 3 — P5 swipe experience + reward polish.** SwipeDeck/SwipeCard upgraded: GSAP fling physics own the card exit (buttons trigger the identical fling via `flingRef` — full buttons-only accessibility path), back-card peek + promote animation, distinct include/skip haptics + sounds in `feedback()`, "n of m" aria-live progress above the dots, end screen "Your report is personalized" with milestone feedback. Reports: header copy now "Your week/month in review"; report screen uses GSAP ScrollTrigger scroll-reveals (Lenis synced via gsap.ticker) instead of CSS stagger; streak card numbers animate via the existing CountUp. FinishCelebration adds "Saved on this device only." Motion lib adds flingCard/promoteCard/initReportReveal/tweenNumber, all reduced-motion no-ops. Tests: 43 across 5 suites (new experience suite covers buttons-only deck completion, 3-card floor + redo, prefs persistence/filtering, catalog personalization, reduced-motion celebration, haptics gating, language audit).
>
> **2026-07-17 addendum 4 — read-only web viewer.** Second Vite entry `/viewer.html` → `src/viewer.tsx` mounts `<App viewer />` with an isolated in-memory `window.storage` (never touches a real journal; photo blobs from full backups hydrate tab-only). `App({ viewer })` additions: `ViewerLanding` (file open/drop + demo browse + friendly validation errors via `validateBackup`), reuses `restoreBackup` for hydration, persistence effect disabled, Log tab filtered from nav, Read-only badges on dashboard + inner headers, `goToLog` no-op, effect bounces log/settings/setup/fitbit to dashboard. Export screens still work on the opened backup. Tests: 50 total; viewer suite covers landing, demo, data-only + full-photo backups, invalid files, no-Log/no-persist guarantees. Gotcha fixed: viewer screen-guard effect must live above App's early returns (hook order).
>
> **2026-07-17 addendum 5 — editable report time frame.** New pure helpers by pickReportRange: `rangeForOffset` (total over any offset, returns `days` logged), `offsetOfPeriod`, `minPeriodOffset`. ReportScreen (non-saved) now has a Week/Month segmented pill + ‹ › period arrows + "latest" jump; arrows clamp to [minPeriodOffset, 0]; switching type snaps to that type's best period; period changes fire select feedback. Thin periods (<4 logged days) show a "Quiet week/month" card with the navigator still usable; save/share hidden there. Report reveals now spring in (back.out 1.3, slight scale pop). Tests: 54 (contiguity, min-offset bounds, navigation + toggle render test, quiet state).
>
> **2026-07-17 addendum 6 — typed export module + reveal throttle.** First module extracted out of App.tsx: `src/lib/exports.ts` (fully typed, no @ts-nocheck) with `serialize`, `csvEscape`, `toCSV`, `META_HEADERS`, `metaCols(profile, tpl, entry)`, `buildWideTable(tpl, profile, entries)`. App.tsx keeps thin wrappers with the historical `metaCols(profile, e)` / `wideTable(profile, entries)` signatures so no call sites changed; a parity test asserts wrapper output === typed-module output cell-for-cell. Report reveal now throttled: period changes within 350ms of each other render instantly (no strobe when flipping fast via arrows/swipe); settling restores the spring reveal + directional slide. Tests: 58.
>
> **2026-07-17 addendum 6 — report paging polish.** Horizontal swipe on the report pages periods (left = forward in time, right = back), axis-locked after 8px, 60px threshold, clamped to [minPeriodOffset, 0]; gestures starting on svg/[data-noswipe]/inputs/buttons are ignored (photo-compare pager marked data-noswipe; A/B slider already touchAction:none). Period changes slide content directionally (`slideFrom`, ±36px power2.out) composed with the spring card reveal. buildReport results cached per `${type}:${start}` in a ref (cleared when db changes) so flipping back/forth is instant. Tests: 57.


> **2026-09-01 addendum — 1.35.0: one tap out of a thirteen-screen deck, and the `alive` ref that broke the front door.**
> No new feature. One control the guided passes never had, and a React bug that made the app's primary button do nothing in development for eleven releases.
> - **The measurement.** Playwright against `vite preview` at 390px, shortest possible route (refuse the name, "nothing in particular", Next on every question group): **27 screens** from hero to first entry. Taps 12–19 are eight photo-subject cards; 20–24 are five extras cards. **Thirteen of twenty-seven screens are a yes/no being answered no.** With the new control: **16**. The walk itself is untouched.
> - **`declineRestOfPhotos` / `declineRestOfExtras`.** Both build the kept set *synchronously* (`new Set([...chosenSubjects].filter(id => !dropped.has(id)))`) rather than reading `photoDetails`, which is a memo over `chosenSubjects` and has not seen the new state on the tick the handler runs. Photos then branch on that local set: `(kept.has("areas") && !!BodyMap) + kept.has("progress")` — nonzero means a detail card is still owed, so it lands on `walkSubjects.length` (the first detail slot); zero means `go("extras")`. **Do not "simplify" this to `setPhotoWalk(walkSubjects.length)` unconditionally** — with no details `photoLast` is `walkSubjects.length - 1` and `photoAt` clamps back onto the last subject card. Extras always `setExtraWalk(walkExtras.length)`, which is the cadence card: `extraLast = extras.length + 1`, so cadence and the nudge are deliberately not skippable.
> - **Placement, twice-changed, and why.** First attempt: a third ghost in `.fhj-fr-foot-row`. That row sets `flex: 1; white-space: nowrap` on its ghosts and its own comment says it is built for two — with three, each gets 98px at 320px and "None of the 8" clips its own label. Second attempt: its own line in `.fhj-fr-foot`, which made the sticky foot ~52px taller and buried "Not this one" on a 320px screen. **Shipped: `.fhj-fr-pw-none`, a third answer inside `.fhj-fr-pw-actions`**, under the Yes and the No, set as quiet text rather than a slab. It is one of the answers, so it lives with them; the foot is back to the two it was designed for.
> - **Gated on `length - at >= 2`.** With one card to go it is "Not this one" under a longer name. The label carries the remaining count because a person who cannot see the deck's length cannot price the tap.
> - **The `alive` bug — read this before writing another one.** `const alive = useRef(true); useEffect(() => () => { alive.current = false; }, []);` is **wrong under StrictMode**. React mounts, cleans up, and re-runs; the cleanup is the only writer, so from the second mount onward `alive.current` is permanently false and every callback guarded by it is a no-op. In `FirstRun` that callback is `heroOut`'s — the hero animated itself away and `setAct("you")` never ran, so **"Start my journal" left a black screen with no way forward, in `npm run dev`, for eleven releases**. Production was unaffected (StrictMode double-invoke is dev-only) and the suite was unaffected (reduced motion makes `heroOut` call back on the same tick), which is exactly why it survived. Fixed in all three sites — `FirstRun`, `AiConnect`, and the Daily Pulse queue in `App.tsx` (where it was silently stopping the queue advancing after an answer) — by re-arming in the effect body: `useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, [])`.
> - **Tests: 1915 across 74 suites** (was 1908/74). `tests/firstRun.test.tsx` 68 → 75, and its `exact()` helper takes a `RegExp` as well as a string so a label carrying a count is findable without the test knowing the count. One flake fixed: `tests/quickAddTiles.test.tsx` waited on the journal write and then asserted the toast synchronously — two different renders; it is a `findBy` now. It failed once in a full parallel run and passed in isolation, which is the signature.
> - **How the first run was measured, for whoever needs it next.** `npm run build && npx vite preview`, **not `npm run dev`** — before this release the dev server could not get past the hero at all, and that is worth remembering as a symptom rather than a quirk. Drive it by clicking the first button matching `/^(continue|next group|last one|…)/i`, and note that the acts are not screens: the rail says six, the person walks twenty-seven.

> **2026-09-01 addendum — 1.34.0: the 44px floor, in both directions.**
> No new feature. One rule that was half-applied everywhere, including on the control the product is built around.
> - **What was actually wrong.** `--fhj-tap: 44px` was used 14 times and every one of them was a `min-height`. Measured in Chromium at 320px: `.fhj-pulse-rung` **21×52**, `.fhj-scale-rung` **26×36**, `.fhj-chip` 42 tall, `.fhj-icon-btn` 32/36/40, ChipsInput/ToggleInput chips 36, `NumberInput`'s steppers 36×36, `TextField` 42, `.fhj-thumb-back` 40, `.fhj-skip` 40, `.fhj-btn-sm` 36, `.fhj-seg > button` 38, `.fhj-thumb-coach` 33. The README claimed a completed target-size audit; it had checked height.
> - **Ten columns is arithmetic, not taste.** `.fhj-shell` is `max-width: 28rem` and the wide override is scoped to the Detailed Log at ≥900px, so a 1–10 row inside a card gets ~288px on a 320px screen → 21px per rung, ~326px at 390px → 29px. No breakpoint fixes it. `.fhj-scale` and `.fhj-pulse-scale` are `repeat(5, minmax(0, 1fr))` now — ~55px — which is the geometry `QuickField` has always used (`grid grid-cols-5 gap-2`, `aspect-square`). Three scales, one shape. `.fhj-scale-rung` lost its fixed `height: 2.25rem` for `min-height: var(--fhj-tap)` (the `@media (min-width: 900px)` override now only raises font-size — leaving a `height` there would re-cap it below the floor on desktop), and `.fhj-pulse-rung` gained `min-width: 0` so a numeral cannot push the grid past its card.
> - **`.fhj-tap-floor` — the pattern for ink that has to stay small.** `position: relative` + an `::after` at `top/left: 50%`, `translate(-50%, -50%)`, `width/height: max(100%, var(--fhj-tap))`. `max()` not a fixed size, so a control already over the floor keeps its own hit area, and a wide-but-short control grows only in the direction it is short. Shared by `.fhj-icon-btn` and `.fhj-chip.fhj-chip-sm`. **Do not put it on a `<span>` inside a button that is already big** — the section headers are whole-row buttons and a nested overlay there only steals taps from its own row; the test asserts the absence.
> - **Grown outright** (`min-height: var(--fhj-tap)`): `.fhj-chip`, `.fhj-segment`, `.fhj-seg > button`, `.fhj-btn-sm`, `.fhj-thumb-back`, `.fhj-thumb-coach`, `.fhj-skip`. In `App.tsx`, four Tailwind chip/pill class strings gained `min-h-[var(--fhj-tap)] inline-flex items-center justify-center` (ChipsInput, ToggleInput's Yes/No, the appointment-pack chip helper, the durability chip helper, QuickField's chips), `NumberInput`'s steppers went `w-9 h-9` → `w-11 h-11`, single-line `TextField`s gained `min-h-[var(--fhj-tap)]`, the Quick/Detailed switch went `minHeight: 40` → `44`, and five small text buttons carry `fhj-tap-floor`.
> - **Two exemptions, deliberate and documented in the changelog:** `.fhj-heat-day` (6×11 — a year in 320px) and `.fhj-picker-arrow` (32×32, floats over a row that also swipes). Both have a full-size route to the same thing. `.fhj-dist-col` is a chart column, not a control.
> - **New `tests/tapTargets.test.ts` (14).** Source assertions, and the header says why: **jsdom has no layout engine**, so `getBoundingClientRect()` returns zeroes and a measuring test passes forever — which is exactly how this shipped. It pins the token, the overlay rule's `max(100%, var(--fhj-tap))` shape, all three scale geometries, the named `min-height` declarations, and runs a sweep over every rule in `index.css` that fails on any selector matching `/button|chip|tab|btn|rung|segment|pill|toggle/` declaring a `min-height` between 24 and 43px (selectors covered by the `::after` floor are exempted by name). That sweep found `.fhj-chip-sm` (34) and `.fhj-seg > button` (38), which the browser walk never rendered.
> - **How the numbers were got, for whoever needs them next.** Playwright against `npm run dev`, `Look around with example data`, viewports 320/390/1280, walking Today → History → Insights → Diary → Experiments → check-in → Detailed Log and scrolling each in 500px steps. Two measures: `getBoundingClientRect()` for the box, and `document.elementFromPoint` at four offsets for the *effective* hit area (which is what proves an `::after` overlay works). Probe the **edge midpoints, not the corners** — a `rounded-full` pill's corners are genuinely outside its shape and a corner probe reports false misses on every chip in the app. Elements under `.fhj-thumbnav` and `.fhj-thumb-coach` are occluded by design, not undersized.
> - **Tests: 1908 across 74 suites** (was 1894/73). One pre-existing failure fixed: `tests/experience.test.tsx`'s report-navigation test asserted "next period is disabled at the current period" after toggling Week → Month, but `pickReportRange` needs ≥4 logged days and the sample journal stops at yesterday — so on the 1st–3rd of any month it opened on last month and failed. Pinned to 2026-09-24, the second calendar-brittle test in this repo to need it (see 1.32.0's `cadenceUi` note).

> **2026-08-31 addendum — 1.33.0: one box over the journal, and an import that reads prose.**
> Two features, and they pull in opposite directions on purpose: search is the most local thing in the app and import is the only thing that sends prose.
> - **New module `src/lib/search.ts` (typed, pure, no App or React dependency).** `SearchDoc { id, kind, date?, time?, title, subtitle?, text?, extra?, numbers?, target }` and `SearchKind` (12 of them, `KIND_ORDER`/`KIND_LABEL`/`KIND_ONE`/`KIND_ICON` beside it — the icon names are checked against App.tsx's own `Icon` set, there is no `flame` or `help`). `buildIndex(SearchSource)` flattens eleven slices plus the resolved `tpl.fields` plus `PLACES` (the screens, with the words people actually search for: "backup" → Export, "vibration" → Settings). `parseQuery(raw, today)` **never fails** — a token that looks like a filter and is not one becomes a word — and returns `words / phrases / without / kinds / from / to / numeric / chips`. `runSearch(docs, query, { today, fields, limit })` applies filters absolutely, ANDs every remaining term, scores by *where* the term landed (title equality 120 → extra substring 8) with a recency nudge capped at 14 so it can never outrank a title match, and returns `counts` over the **whole** result rather than the page. Also `resolveField` (key, then label, then label prefix, then word boundary), `snippetFor`, `highlight` (merged spans), `describeSearch`, `SEARCH_EXAMPLES`, `SEARCH_SYNTAX`.
> - **The one query operator worth the module.** `pain>7` resolves the name against the *questions this journal asks*, and only days carry `numbers`, so a bare comparison is a legitimate whole query returning days. A comparison naming a question that does not exist returns nothing **and says which name it did not recognise** — quietly ignoring it would answer a question nobody asked.
> - **New `src/components/SearchScreen.tsx`.** Thin: index in, ranked list out. Sticky box (`top: 3.75rem`, under the app header), filter chips echoing `parsed.chips`, kind chips whose counts are `all.counts` (so a chip that says 6 shows 6), `↑/↓/Enter/Esc`, marked runs via `highlight`, an empty state that is five runnable example searches with the operator reference behind a disclosure, and a no-results state that offers "Search without the filters".
> - **App wiring.** `searchDocs` is a `useMemo` **above every early return** — this file has already paid once for a hook below one (see the 1.0 crash note above) and it is null-safe because the lock, recovery and first-run screens all render before there is a journal. It depends on `db` as a whole, deliberately. `openSearchHit(target)` answers every target the index can produce; `screen === "search"` is in the router, `SCREEN_LABELS`, `DESTINATIONS` (viewer: true), `DEEP_LINK_SCREENS`, and `screenTitle`. `DiaryScreen` gained `startDate` and App gained `diaryDate` so a meal result opens the Diary *on that day*; the bar's `onGo` clears it, because reached from the bar the Diary is about today again. Search buttons: Today's header row, History's header row, and the app header on every screen that draws one **except `log`** (the day pager already owns two slots there).
> - **`src/lib/import.ts` grew four things, all normalised at the same boundary.** `ImportedItem.span { from, to, days }` from `resolveSpan(kind, date, until, today)` — spannable kinds are `routine` and `food` **only**, because repeating a rating or a bowel movement across a week manufactures records nobody made; capped at `MAX_SPAN_DAYS` (92); a backwards, future or unreadable `until` collapses to no span and the row survives. `shiftItemDate` moves a span whole. `ImportQuestion { id, ask, why?, options, assumed }` + `normaliseQuestions` — at most 3, 2–4 options, `assumed` forced into `options`, diagnostic text dropped; the prompt's contract is that **the rows are already built on `assumed`**, so a question never blocks anything. `ImportInput.answers` round-trips one answer back as settled fact with the notes unchanged. `ImportPlan.unplaced` collects the source fragments of everything the boundary refused. `applyImport` now iterates `datesOf(proposal)` and returns `duplicateIds`, which is what lets the review dry-run itself.
> - **`countKinds` counts span days, not proposals**, so the sentence above the list and the label on the button both say what the tap will actually write.
> - **NoteImportScreen.** `ImportQuestions` card (assumed marked, changing one arms "Read it again with these answers", which goes through the same consent sheet), span badge + "through <date>" on the row, "Already in your journal" from the dry run with one tap to switch them all off, the unplaced list, an error surface on the review branch (a second reading can fail where the first one did not), and a "What can I paste?" disclosure naming both shapes of notes.
> - **CSS.** `.fhj-sr-*` (search) and `.fhj-import-span / -dupe / -dupes / -through / -q* / -kinds`. Gotcha paid for: the app header is `sticky top-0`, so a second sticky element inside a screen needs `top: 3.75rem` or it hides under it.
> - **Tests: 1894 across 73 suites** (was 1821/71). New `tests/search.test.ts` (36) and `tests/searchUi.test.tsx` (15). `tests/import.test.ts` 33 → 48 (spans, questions, unplaced, the answers round-trip) and `tests/importUi.test.tsx` 13 → 20. Gotcha for future UI suites: `genSampleData()` has **no food logs** — use the routine, which always has four items and a fortnight of logs — and its notes are drawn at 18% per day from a four-line bank, so asserting on a specific one is a coin flip.

> **2026-08-31 addendum — 1.32.0: first run asks what you came for, and dates the answer.**
> Three changes, one thread: the setup now knows *why* somebody is here, uses it, and stops making an undated promise.
> - **New module `src/lib/aims.ts` (typed, no App dependency).** `Aim { id, icon, label, blurb, question, needs: { extras, subjects }, marks, suggest, promise, emerging, useful }` and `AIMS` — five of them, `record` ("nothing in particular") pinned last by `aimsFor(modules)`, which otherwise leads with the aims this person's packs reach for. `answersAim(aim, { label, sec })` is a deliberately dumb substring match over the two vocabularies eleven packs share; the alternative (a hand-kept map from aim → field key) is wrong within a month of a new pack. The horizon end: `PER_WEEK`/`perWeek(cadence)`, `daysFor(entries, cadence)` (ceiling — a date reached a day late is a promise broken on the morning it is collected), `shift`, `whenLabel`, `awayLabel`, `horizon({ aim, cadence, from, photos, metricLabel, have })` → three `Milestone`s (`first` 7 or 4 on a weekly journal, `emerging` = `EMERGING_AT`, `useful` = `USEFUL_AT`, all from `lib/evidence` — this module invents no thresholds), `nextRung({ have, ... })` = the first milestone with `left > 0`, null past the top rung, and `readyLine(aim, cadence)`.
> - **`FirstRun` grew an act and a card.** `Act` gains `"aim"` (numbered, second, `FLOW`/`RAIL` are six now — rail labels shortened to fit, `StepRail` indices downstream all +1) and `"bring"` (unnumbered, reached only from the born screen's ghost). New state is one line: `aimId`. It feeds `suggestedExtras` and `suggestedSubjects` (aim `needs` ∪ pack suggestions), `walkExtras` (aim-needed extras first), and the question cards' marking — `aimRows` matches labels only and `aimGroup` matches the section, because tagging six rows because of the heading above them marks nothing. `finish(startWith, ai)` takes both as arguments: the import path connects a key and finishes in one gesture, and `aiOn` has not landed by the time that callback runs. `FirstRunChoice` gains `aim` and `startWith`.
> - **The born screen ends on `horizon(...)`** — `.fhj-fr-holds` (what a day costs) then `.fhj-fr-plan` (three dated rungs) — replacing the three generic beats, plus the honest note that missing days moves the dates.
> - **App wiring.** `buildOnboardProfile` writes `profile.aim`; `firstRunProfile` (now exported on `__internals`) returns `"import"` as its destination for `startWith === "import"`; `beginJournal` routes it and defers the tour via `tourWhenHome` + one effect, because every tour stop points at a dashboard control. `FIRST_RUN_AI_OFFERS.import` is the connection copy for the last card. `PatternsSection` takes `profile`, computes `nextRung({ have: loggedDates(entries).size, cadence: presetIdOf(readCadence(profile)) })` and draws `.fhj-rung` inside the empty-insights card.
> - **CSS.** `.fhj-fr-aims` / `-aim*` (the card that opens under itself), `.fhj-fr-aimnote*`, `.fhj-fr-extra-tag.is-aim`, `.fhj-fr-holds*`, `.fhj-fr-plan*`, `.fhj-fr-import*`, `.fhj-rung*`. Gotchas paid for: `--fhj-ease` is a *duration* (220ms), not an easing function; the on-accent token is `--fhj-on-accent`; `.fhj-fr-eyebrow` is a block everywhere it is a div and needs telling when it is a span inside a button (a button may not contain a div); the plan's date column needs 6.25rem or "Fri, Sep 11" wraps.
> - **Tests: 1821 across 71 suites** (was 1785/70). New `tests/aims.test.ts` (17) pins the arithmetic and the ordering. `tests/firstRun.test.tsx` 52 → 68: the new act arrives unchosen and skippable, it answers with machinery and a date, it changes suggestions and says which answer is talking, it never switches anything on, the marks are selective, the plan is three dated rungs that move with the cadence, and both ends of the import card. `tests/insightsUi.test.tsx` gained the week-one screen. One pre-existing failure fixed while passing: `cadenceUi`'s quiet-state test asserted a state that cannot exist on a Monday (the sample runs to yesterday, which on a Monday is last week) — it pins the clock now.

> **2026-08-29 addendum — 1.28.0: first run stops choosing for you, and offers to walk you through it.**
> Two screens in the middle of first run arrived pre-decided, and both defaults have flipped.
> - **Quick is the default depth.** `FirstRun`'s `depth` starts `"light"`, not `"balanced"`. New module-level `DEPTHS: [Depth, label, meaning][]` holds the presets' meanings; the pills stay label-only (tests match them exactly) and a `.fhj-fr-depth-note` under the row spells out the active one, or says "Your own set" once `hand` is non-null. `presetKeys("light")` now does one swap: if the pack's first three everyday questions are *all* `type === "scale"`, the last slot goes to the first non-scale in the quick set — four 1–10s all move together and correlate with nothing.
> - **No photo subject arrives ticked.** `chosenSubjects = photoPicked ?? EMPTY` (was `?? suggestedSubjects`). `suggestedSubjects` is now only a tag ("suggested for what you track", hidden once on) and the guided pass's ordering. Downstream is unchanged: `firstRunProfile` already treated an empty `photoSubjects` as a real answer, and the "no camera without something to point it at" rule in `firstRunQuickAdd` is what keeps the Photo tile off the dashboard.
> - **Two guided passes, same state as the lists.** `walk: number | null` (one card per question *section*, then a review card drawing `enabledQs` through `PreviewField`) and `photoWalk: number | null` (one card per subject over `walkSubjects`, suggested-first, then a contact-sheet card). Both render as early returns inside their act (`act === "tune" && walkAt !== null`, `act === "photos" && photoWalk !== null`), both write through the same `toggleQuestion` / `setSection` / `answerSubject` handlers the lists use, and neither holds state the list cannot see — leaving mid-pass loses nothing. `photoAnswered` exists only so a "no" reads as a no on the way back through. Exit is on every card (`.fhj-fr-foot-row`: Back, plus "Show me the whole list"), which was the one thing that made the first draft feel like a trap.
> - **Copy that had to come from data.** `FirstRunPhotoSubject.why` (filled for all 8 in `FIRST_RUN_PHOTO_SUBJECTS`) is what the photo pass argues with. `shapeOf(qs)` writes the group-shape sentence and collapses "8 questions here — 8 rated 1–10" to "all rated 1–10".
> - **Orientation.** The pack act draws `.fhj-fr-next` once something is picked: the four screens that follow, and that all of them exist again in Settings.
> - **CSS.** `.fhj-fr-depth-note`, `.fhj-fr-invite*`, `.fhj-fr-walkbar*`, `.fhj-fr-walkqs` / `.fhj-fr-wq*`, `.fhj-fr-walk-bulk` / `-tally*`, `.fhj-fr-pw-shot` / `-then` / `-why` / `-actions` / `-yes` / `-no`, `.fhj-fr-foot-row`, `.fhj-fr-next*`. Gotcha: `.fhj-fr-ghost` is `width: 100%`, so anything putting two of them in a flex row must reset `width: auto` or both wrap.
> - **Tests: 1743 across 69 suites.** `tests/firstRun.test.tsx` grew from 35 to 47 — the Quick default and its non-scale swap, the suggestions-not-ticked rule, both passes end to end, leaving one from the middle, and that a question turned down inside a pass lands in `profile.disabledFields`. Its `toExtras`/`toEntry` helpers now take the photo subjects a test wants picked, since nothing is picked by default any more.

> **2026-08-28 addendum — 1.27.0: how often it asks.**
> The app assumed a daily check-in everywhere and never said so. New module **`src/lib/cadence.ts`** (typed, pure) owns the whole idea, and the load-bearing decision is that **the period is the unit, not the day**: "once a week" means the week owes one check-in, so a Saturday one is worth exactly as much as a Monday one. Everything downstream counts in periods.
> - **Shape.** `Cadence { unit: "day"|"week"|"month"; n; times; days[]; manual?; anchor?; pause? }` on `TrackingSetup.cadence`, plus `TrackingSetup.fieldCadence: Record<key, Cadence>` for questions that ask less often than the journal. Both absent by default — a daily journal stores nothing, so every existing install behaves identically. Both travel in a backup and a sync; both go through `sanitizeCadence` / `sanitizeFieldCadences` in `migrateDb`, which degrade toward asking *more* often rather than less.
> - **API.** `periodStart/End/Dates/Key`, `asksInPeriod`, `periodStatus`, `dueNow`, `nextAsk`, `standing` (the sentence on the check-in card), `cadenceStreak` + `streakNoun`, `adherence`, `isPaused`/`periodPaused`, `fieldDue`/`dueKeys`/`fieldNextLine`, `CADENCE_PRESETS` (9) / `FIELD_CADENCE_PRESETS` (5), `presetIdOf`, `withDays`.
> - **Two flags that are not the same flag.** `Standing.settled` = nothing owed. `Standing.quiet` = nothing owed *and* the cadence has something to say about it. Only `quiet` ever silences the check-in count — a daily journal is "settled" the moment the day is on the record, which is not the same claim as "today's check-in is finished", and only the ring may make the second one.
> - **Wiring in App.tsx.** `loggedDates(entries)` and `readCadence(profile)` / `readFieldCadences(profile)` are the two readers everything shares. `calcStreak(entries, cadence)` is now `cadenceStreak`. `lib/checkin`'s `CheckinSource` takes a `due` set so the ring's denominator is *today's* questions. `DailyPulse` filters `askQueue` by the same set. `GuidedQuickLog` asks only what is due (Detailed Log deliberately still lists everything, with a caption saying when a quiet question returns). `alreadyDone()` returns true when nothing is due, so reminders stay silent. New UI: `CadenceCard` + `WeekdayStrip` in Settings, a per-question picker in `EditSetupScreen`, `CadenceStrip` on both check-in cards, `CatchUpRow` on History (capped at 7, never today, never tomorrow), and a cadence row in FirstRun's "extras" act.
> - **Icons/CSS.** New `pause` and `repeat` icons; `.fhj-cadence-strip / -chip / -line` in `index.css`, with the settled state taking the same green the finished check-in takes.
> - **Tests: 1727 across 68 suites.** New `tests/cadence.test.ts` (61, the arithmetic) and `tests/cadenceUi.test.tsx` (13, the promise that the choice reaches the screens), plus 4 in `checkin.test.ts` for the `due` set.
> - **Gotcha for future work:** `CADENCE_PRESETS` order is asserted in the test suite (densest first) — the picker is sorted along the axis people actually move on.

> **2026-08-07 addendum 7 — 1.0: shipped, not just built.** The app was feature-complete but unshippable and had a crash on every new user's first report. Fixed + added:
> - **Crash fix (critical).** `ReportScreen` declared `revealRef`/`lastReveal`/`hswipe` + a `useLayoutEffect` *below* `if (needsPrefs) return <SwipeDeck/>`. Finishing the first-run card picker therefore rendered more hooks than the previous render → React #310 → error boundary. All hooks moved above that early return (both motion helpers are null-ref safe). Pinned by `tests/experience.test.tsx` → "survives the card picker handing off to the report on the very first run" (verified to fail when the bug is reintroduced).
> - **Print fixes.** GSAP ScrollTrigger left below-fold cards at `opacity:0` (printing doesn't scroll) → `.print-area, .print-area *` forced visible; tinted report header card was white-on-white → `no-print` (the new print masthead covers it); horizontal photo pager was clipped → `.fhj-photo-pager` stacks. Interaction hints marked `no-print`.
> - **Deploy.** `.github/workflows/ci.yml` (npm run check) + `pages.yml` (GitHub Pages, uses `actions/configure-pages` base path). `vite.config.ts` reads `BASE_PATH` (normalised) → `base`, PWA `start_url`/`scope`/`navigateFallback`, plus a `transformIndexHtml` plugin filling `%BASE%`/`%SITE%` in og tags (Vite doesn't rebase `<meta content>`). `SITE_URL` opts into absolute preview URLs.
> - **New typed modules + tests.** `src/lib/reminders.ts` (time validation, `nextOccurrence`, RFC 5545 `.ics` with `RRULE:FREQ=DAILY`, floating local time, folding/escaping, Notification wrappers), `src/lib/durability.ts` (`storageStatus`/`requestPersistentStorage`, `backupNudge`, `describeBackupAge`), `src/lib/deeplink.ts` (`?screen=` allowlist for PWA shortcuts). 22 new tests; 92 total across 9 suites.
> - **App wiring.** Settings gains `ReminderCard` + `PrivacyCard`; `DataDurabilityCard` gains persistence status and backup age; `markBackedUp()` stamps `profile.lastBackupAt` on full backup and JSON export; dashboard shows a backup nudge (`TrendsScreen` now takes `goSettings`/`viewer`); App effects for reminder scheduling, `requestPersistentStorage`, and deep links.
> - **Rename.** User-facing "Family Bellwether" → **Bellwether** (`APP_NAME`/`APP_VERSION` exported from App.tsx). `BACKUP_APP_IDS` accepts both strings forever; new backups write the new one. Removed the stale zip and `GITHUB_QUICKSTART.md`; README + CHANGELOG rewritten.
> - **A11y.** Skip link, `<main id="main">` landmark, `aria-current="page"` on the active tab, header title is an `<h1>`, wider `:focus-visible`, `prefers-contrast: more`.
> - **Still open:** no licence declared (owner's call — package.json intentionally has no `license` field); `App.tsx` still `@ts-nocheck`; on-device a11y pass with a real screen reader not done.

> **2026-08-08 addendum 8 — 1.1: design system, trend-picker fix, optional AI.**
> - **Theme layer (new).** `src/lib/theme.ts` owns two palettes (`dark` default, `light`) and
>   exports a *mutable* token object `C`. App.tsx reads colours as `C.x` at render time, so a
>   theme swap is `Object.assign(C, palette)` + one re-render — no context threaded through
>   ~7k lines. Same values mirrored to `:root` as `--fhj-*` so `index.css` stays in sync.
>   Preference in `localStorage` (`fhj_theme_v1`), read by an inline script in index.html and
>   viewer.html **before first paint** — that script must keep working if the palettes change.
>   `initTheme()` runs as an import side effect, so anything importing `C` is already correct.
>   **Gotcha:** `TEMPLATES[*].color` and `computeProfileTemplate().color` are now live getters
>   (`liveTint()`) returning `C.accent` — per-pack tints are gone deliberately, and the getter
>   is what stops the WeakMap template cache freezing a stale hex.
> - **`src/styles/index.css` is now the component layer** (buttons, chips, cards, segmented,
>   switches, sheets, picker, print). Both inline `<style>` blocks were deleted from App.tsx.
>   New shared primitives in App.tsx: `Button`, `Segmented`, `SwitchRow`, `Badge`, `Modal`.
> - **`src/components/MetricPicker.tsx` (new)** replaces the 30-day trend chip strip. Roving
>   tabindex, wheel→horizontal, edge fades/arrows, scroll-selection-into-view. `scrollTo`/
>   `scrollBy` are feature-detected because jsdom lacks both.
> - **`src/lib/ai.ts` (new, fully typed).** Optional Gemini analysis. Key under its own storage
>   key (`fhj_ai_key_v1`), never in `db`, never in a backup, never logged; `redact()` scrubs
>   key-shaped strings out of anything user-facing. `buildAnalysisInput` sends numeric answers
>   only, day-ordinals not dates, no notes/photos/name. `normaliseAnalysis` + `scrubCausalLanguage`
>   sanitise model output at the render boundary. New db slice `db.ai = { enabled, analysis,
>   dismissed }` (`DEFAULT_AI`, filled by `migrateDb`); `buildFullBackup` carries `analysis`
>   and `dismissed` but deliberately **not** `enabled` — opting in is per device.
> - **A11y.** Contrast audited by script over computed styles on every screen in both themes;
>   `subtle` and `muted` were raised (they carried real body copy at 3.1:1) and five uses of
>   `C.accent` as a *text* colour moved to `C.accentText`/`C.good`. `readableInk()` picks label
>   colour by luminance at the true 0.179 crossover. `tests/theme.test.ts` now fails the build
>   on any AA regression.
> - **Tests: 167 across 12 suites** (was 92/9). New: `ai.test.ts`, `theme.test.ts`,
>   `metricPicker.test.tsx`.
> - **Still open:** unchanged from 1.0 — no licence declared, `App.tsx` still `@ts-nocheck`,
>   on-device screen-reader pass not done.

> **2026-08-08 addendum 9 — 1.2: guided AI setup.** Setup moved out of the Settings form into
> `AiSetupWizard` (in App.tsx, next to `PatternsSection`): a 4-step full-screen flow —
> intro → get key (opens `AI_STUDIO_URL` in a new tab, instructions inline) → paste (auto-verifies
> via `testApiKey` on a 450ms debounce, `checkSeq` ref discards stale results) → review + run.
> Continue is gated per step; a failed check exposes "Use this key anyway" so a network blip is
> never a dead end. `saveKey` fires only when step 3 completes; `setAi({enabled:true})` only at
> the end.
> **Cross-screen wiring:** finishing from Settings can't run the analysis itself (PatternsSection
> owns `run`), so App holds an `aiAutoRun` counter — Settings' `onAiSetupComplete` bumps it and
> navigates to the dashboard; `PatternsSection` watches it via a `ranFor` ref and runs once. The
> wizard's own review step is the confirmation, so this deliberately does *not* re-prompt.
> `AiSettingsCard` is now management-only (test / replace / remove) and delegates all setup —
> including replace — to the wizard, so the two paths can't drift.
> `PatternsSection` now checks for a stored key regardless of `ai.enabled`, so "key present but
> switched off" offers a one-tap re-enable rather than a first-run walkthrough.
> Tests: 182 across 13 suites (new `tests/aiWizard.test.tsx`).

> **2026-08-08 addendum 10 — 1.3: multi-provider AI + the model-rot fix.**
> **The bug:** `AI_MODEL = "gemini-2.5-flash"` was hard-coded. Google retired it for
> newly-issued keys ~3 months before the published Oct 2026 shutdown, so every new user got a
> 404 after a clean setup. Google also moved key format from `AIza…` to `AQ.Ab…`, which the old
> strict prefix check would have rejected.
> **The fix — never hard-code a model.** New `src/lib/aiProviders.ts`: provider catalogue
> (`gemini` | `openrouter` | `custom`), `listModels()`, `scoreModel()`/`pickModel()`, `chat()`,
> `isModelGone()`. Setup calls `testConnection()` → lists models → picks one → stores it on the
> connection. `runPatternAnalysis` re-resolves and retries **once** when `isModelGone` matches
> (guard `allowRetry`; a bare "not found" without the word "model" deliberately does *not* match,
> or a 404 "user not found" would burn a second request).
> **Storage change:** `fhj_ai_key_v1` (bare string) → `fhj_ai_conn_v1` (JSON `Connection`
> `{provider,key,baseUrl,model}`). `loadConnection()` falls back to the legacy key and treats it
> as Gemini, so existing installs keep working; `saveConnection` deletes the legacy key.
> **CORS is the binding constraint** — no backend means the provider must send CORS headers.
> OpenAI does not, so ChatGPT cannot be offered; `OPENAI_NOTE` is rendered in the picker so this
> is answered rather than discovered. A `TypeError` from fetch is indistinguishable from a CORS
> refusal, so `networkMessage()` names CORS specifically for `custom` providers.
> **Wizard is 5 steps now** (provider inserted at index 1). `REVIEW`/`PASTE` are derived from
> `WIZARD_STEPS.length` — don't reintroduce hard-coded step numbers. Progress dots dropped their
> connector lines at 5 steps or the header title truncates at 390px.
> **Verified in-browser** against the real retired-model 404 body and the real `AQ.` key shape;
> could not verify OpenRouter/Groq CORS from the sandbox (egress-blocked) — the runtime check is
> what proves it on the user's machine.
> Tests: 217 across 14 suites (new `tests/aiProviders.test.ts`).

> **2026-08-09 addendum 11 — 1.4: Soft Clinical redesign, food + bowel tracking.**
> **Design system.** Palettes retuned in `src/lib/theme.ts`: dark is warm-neutral *soft
> graphite* (`bg #141519`, `card #1E2026`), light is *warm off-white* (`bg #F4F1EB`,
> `card #FDFBF7`). Accent is a **light** muted blue in dark mode carrying **dark** ink
> (`onAccent #121419`) — white-on-accent can only clear AA if the blue is dark enough to look
> muddy on graphite. New tokens: `sage/lavender/clay` (+`*Text`,`*Soft`) for per-category
> tinting, and `shadowPop`/`shadowPopLg` (hard, zero-blur offsets). **Gotcha:** ~25 screens had
> hand-rolled primary buttons with literal `#fff` text; they were correct against the old
> blurple and unreadable against the new accent. All were converted to `.fhj-btn-primary` or to
> `readableInk(fill)`. Never write a literal ink colour on a themed fill.
> `index.css` gained `--fhj-bw`/`--fhj-bw-strong`/`--fhj-press` and a `.fhj-pop` class: the
> whole neobrutalist register is those three tokens plus one class, so it can be turned up or
> down centrally. Press travels exactly the shadow offset so the element lands flush.
> New component classes: `.fhj-section-title` (display face + category bar), `.fhj-tile(s)`,
> `.fhj-tl-*` (timeline), `.fhj-ai-badge`, `.fhj-empty*`, `.fhj-skeleton`, `.fhj-expand`
> (0fr→1fr grid rows, no JS measurement), `.fhj-photo`, `.fhj-cat-*` (sets `--fhj-mark` /
> `--fhj-tint-soft` / `--fhj-tint-text` for everything inside).
> The pre-paint scripts in index.html/viewer.html duplicate two palette values and are now
> pinned to them by `tests/theme.test.ts` — they silently drifted before.
>
> **`src/lib/tracking.ts` (new, fully typed).** Food and bowel logs live in their own top-level
> arrays (`db.food`, `db.bowel`), not on `DailyEntry`, because a day has one severity but four
> meals. **The load-bearing rule: `FoodLog.nutrition` is only ever written by a person and
> `FoodLog.ai` holds the model's reply whole.** `resolveNutrient` merges them for display and
> reports the source, which is what lets every surface label an estimate as one.
> `acceptEstimate` copies values across (making them immune to a re-run); `discardEstimate`
> drops the model's block. `dayTotals` returns **null, not 0**, for a nutrient nobody recorded.
> `DERIVED_METRICS` bridges many-per-day logs to the one-value-per-day chart; food metrics are
> deliberately `dir: "neutral"` — colouring a calorie count red would be dietary advice via a
> palette. `sanitize{Food,Bowel}Logs` runs on every load (backups are hand-editable).
>
> **AI: one integration, five uses.** `aiProviders.chat()` now takes `image` (Gemini
> `inlineData` / OpenAI `image_url`), a per-call `schema`, and `jsonHint`. `ai.ts` adds
> `analyseFood` (text | photo | photo+text — one function, because the "explicit quantity wins"
> rule must not exist in three places) and `analyseBowelPhoto`. `runStructured` is the shared
> runner (resolve model → send → retry once on `isModelGone`). `isNoVision()` turns a text-only
> model's 400 into a sentence instead of a status code.
> **Safety gotcha, fixed:** `normaliseBowelResult` used to truncate a field *before* screening
> it, so "pale, which can indicate a liver condition" was cut mid-word and the flagged term no
> longer matched. **Always screen the full string, then truncate.**
> Every send goes through `AiSendPreview`, which grew a `lines` mode for single-item sends.
>
> **Dashboard** is now Today / Quick Add / Today's Logs / Trends / Possible Patterns.
> `TrendsScreen` builds `chartEntries` — real answers plus derived values folded in as answers —
> kept separate from `entries` so streaks, calendar and exports are unaffected by a day that
> only has a meal on it. `fieldFor(k)` synthesises a field for a derived key so the chart,
> picker and axis code need no knowledge of food or bowel logs.
>
> **Charts.** Gradient wash (`ComposedChart` + `Area`), draw-in via `chartAnim()` (no-op under
> reduced motion), hover dots, units in tooltips, current week emphasised in `WeeklyBars`.
> **Fixed:** `margin.left: -14` was clipping the leading digit off two-character Y ticks ("10" →
> "L0"); it is `-2` with `width={34}` now.
>
> **Modal a11y.** Every Modal shared one `aria-labelledby` id, so a stacked confirmation sheet
> announced the heading beneath it; ids are per-instance (`React.useId`) now. `useInert()` sets
> the native `inert` attribute imperatively (React 18 won't forward it) so a covered form leaves
> the tab order and the a11y tree.
>
> **Export.** XLSX gains Food and Bowel sheets (one row per log; every nutrient has a value
> column *and* a `_source` column). `buildWideTable` takes an optional `food` argument and
> appends daily totals — no columns at all when there is no food, so existing exports are byte
> -identical.
>
> **Not adopted:** react-bits (copy-in gallery, louder register than this product wants; the
> interactions worth having are a dozen lines of CSS each). Vanta stays opt-in/off.
> Tests: **324 across 17 suites** (new: `tracking`, `aiFoodBowel`, `foodBowelUi`).
> **Still open:** unchanged — no licence declared, `App.tsx` still `@ts-nocheck`, on-device
> screen-reader pass not done.


> **2026-08-09 addendum 12 — 1.5: food tracking that keeps up, sectioned questions, many reminders.**
> **The food library (`db.foods`).** MFP's speed is "you never type a food twice", which is a
> server-side database this app cannot have. The substitute is a library grown from the user's
> own logs — `rememberFood()` runs on every food save, storing figures **per single serving**
> (a "3 × 1 slice" log must not teach it that a slice is 3 slices). `browseFoods(lib, tab, query)`
> backs Recent/Frequent/Favourites/All; **a non-empty query overrides the tab on purpose**.
> `logFromFoodItem()` scales and **writes the figures onto the log**, so editing a saved food
> never rewrites history.
> **Provenance gotcha, and the reason `FoodAiResult.source` gained `"library"`:** an item whose
> numbers were an unconfirmed estimate carries `estimated: true`, and logging it writes into
> `log.ai`, not `log.nutrition`. Without that, saving a food is a laundering step that turns a
> guess into a measurement one tap later. Correcting the figures clears the flag — one fix
> propagates to every future log.
> **Goals** live at `profile.goals`, every field optional. `goalProgress()` returns *nothing* when
> nothing is set (no default calorie target is ever invented), and an unrecorded nutrient yields
> `ratio: null` rather than 0 — "didn't record" ≠ "ate none". Bars are deliberately unjudged: no
> red for over, no green for under.
>
> **FoodScreen** is a new nav destination (`screen === "food"`, also in `DEEP_LINK_SCREENS`):
> date pager, `CalorieRing`, `GoalBar`s, and one `MealSection` per meal with subtotals.
> `FoodPicker` is the fast path; the long `FoodLogSheet` sits behind "Something new". **Quick Add's
> Food tile opens the picker, not the sheet** — the tests walk that route via `openFoodForm()`.
> **Gotcha:** `DashboardScreen` forwards props to `TrendsScreen` but must destructure them itself;
> `@ts-nocheck` hides a missing one until it throws at runtime (`foods is not defined`).
>
> **EditSetupScreen** groups questions into collapsible sections keyed by **pack label** (the
> grouping the user chose), not by `sec`. Sections carry `{field, index}` where `index` is into the
> *whole* ordered list, so reorder arrows still move a question through the real order. A live
> filter query forces matching sections open. **Test gotcha:** the question-pack checkboxes are
> also `role="switch"`, so any switch query inside this screen must be scoped to the section.
>
> **Reminders are a list** (`profile.reminders`), migrated from the single `profile.reminder` by
> `readReminders()` on every load. `nextReminderDue()` drives **one** timer rather than one per
> reminder. `alreadyDone()` suppresses a nudge whose job is done — food reminders check for a log
> **within ±2h of that reminder's time**, since breakfast being logged says nothing about dinner.
> `buildRemindersICS()` writes one VEVENT per enabled reminder with index-suffixed UIDs (two at the
> same time would otherwise collide on import); still floating-time.
>
> **CSS fix:** `.fhj-switch` never set `display`, so as an inline element its width/height
> collapsed and only the knob drew — invisible anywhere it wasn't a flex item.
> **UX fix:** nutrition fields were behind a collapsed `<details>`; the four headline figures are
> always visible now, the rest behind "More nutrients". Typing calories is the most common action
> in a food tracker and must never be one click away.
>
> Tests: **407 across 18 suites** (new: `setupSections`; big additions to `tracking`,
> `reminders`, `foodBowelUi`).
> **Still open:** unchanged — no licence declared, `App.tsx` still `@ts-nocheck`, on-device
> screen-reader pass not done. Food logs are not yet reachable from the Calendar screen.


> **2026-08-10 addendum 13 — 1.8: photo-first logging, AI as a judge, editable Quick Add.**
> **The photo leads both sheets.** `FoodLogSheet` and `BowelLogSheet` open with `LogPhotoField`
> in a `.fhj-photo-lead` frame, above every other field. Everything below it is optional copy,
> not decoration — the ordering is the feature.
>
> **`db.ai.auto` — standing consent, and the rules around it.** New per-device flag alongside
> `enabled`, in `DEFAULT_AI`, and deliberately **not** carried in `buildFullBackup` (restoring a
> journal onto a new phone must not switch on automatic uploads there). When on: attaching a photo
> to either sheet fires the analysis immediately, and the manual buttons skip the `AiSendPreview`
> sheet — the switch already answered that question, and re-asking would make it meaningless on
> the text-only food path. **The photo caption is keyed on the setting, not on `log.photoId`**;
> an earlier cut said "nothing is sent unless you ask" on a screen that had just sent it, which
> is the one wording this feature cannot ship with. `PrivacyCard` gained a third variant for the
> same reason. `judgedRef` (one per sheet) is what stops a re-render, a notes keystroke, or the
> result itself firing a second identical request.
>
> **The bowel model now judges `amount` too**, and its words are mapped onto the form's own
> options. `matchBowelColor`/`matchBowelConsistency`/`bowelSuggestion`/`applyBowelSuggestion`/
> `aiFilledBowelFields` are new in `tracking.ts`. **The mapping is load-bearing, not cosmetic:**
> "dark brown" stored raw matches no chip, lights nothing up, and becomes a category of one in
> every later grouping — survivable while a human read the suggestion and tapped the chip, not
> survivable once the answer lands in the log directly. Anything unmappable is dropped, never
> guessed. `applyBowelSuggestion` only ever fills `null` fields, and `aiFilledBowelFields`
> derives "the model owns this" by comparing to what the suggestion *would* write, so overtyping
> a value drops it off the list with no extra bookkeeping. Once fields are auto-filled they fold
> behind one summary row (`foldDetails`) — this is the "skip Bristol/amount/colour" ask.
>
> **`profile.quickAdd`** — ordered tile ids, `undefined` → `DEFAULT_QUICK_ADD`, `[]` a real choice
> that hides the section. `QUICK_ADD_TILES` is the catalogue (checkin/food/drink/bowel/photo/diary);
> `QuickAdd` takes `{ids, actions}` and drops any tile with no handler, which is how the viewer
> build and a photo-less setup filter themselves without extra conditionals. `sanitizeQuickAdd`
> runs in `migrateDb` (backups are hand-editable). Editor is up/down arrows, matching Edit Setup —
> this app has one reordering idiom.
>
> **`FoodPicker` owns a time and a meal now.** Changing the time re-files the meal via
> `mealForTime` **unless** the user has touched the meal select (`mealTouched` ref) or the picker
> opened as a drink. `onOpenFull` carries `{meal, time}` into `FoodLogSheet` as `defaultTime`.
> **Gotcha this exposed:** `newFoodLog`/`newBowelLog` spread `...partial` last, so an
> explicitly-`undefined` `time` un-set the computed default. Both now filter undefined first.
>
> **Scroll lock.** `lockPageScroll()` in `motion.ts` (ref-counted, `position:fixed` + restore,
> `lenis.stop()/start()`), mounted once per `Modal`, plus `data-lenis-prevent` on `.fhj-sheet`.
> Both halves are needed: the attribute handles wheels inside the sheet, the lock handles wheels
> on the scrim. Stacked sheets only release on the outermost close.
>
> **Backdrops: `dawn`, `drift`, `linen`** added to `BackdropStyle`/`BACKDROP_STYLES`, with a new
> `isBackdropStyle` guard as the single validation point. Same three-layer skeleton; the chooser
> previews restate only the viewport-unit geometry, since `inset`/% values shrink on their own.
> **Verified in a real browser** — the first cut of dawn's preview was nearly black and drift's
> merged into one wash at tile scale.
>
> Tests: **506 across 20 suites** (was 467/20).
> **Still open:** unchanged — no licence declared, `App.tsx` still `@ts-nocheck`, on-device
> screen-reader pass not done.


> **2026-08-18 addendum 14 — 1.12: the routine (meds, supplements, creams, products).**
> **Two objects, and the split is the design.** `RoutineItem` is the *plan* (name, kind, dose as
> free text, `times: RoutineTime[]`, `daily`, archived); `RoutineLog` is one *use* and carries its
> own snapshot of name/kind/dose. Editing or deleting an item can therefore never rewrite a past
> day — the same rule the food diary follows, and the reason items are safe to edit freely.
> Stored as `db.routineItems` / `db.routine`, sanitised on every load in `migrateDb`.
>
> **The interaction the whole feature defends: one tap ticks, the same tap unticks.** No form, no
> confirmation. `RoutineCheckRow`'s whole row is the target; the small `sliders` button beside it
> is the *second* control and the only route to a sheet. `routineChecklist()` produces one row per
> (item, slot), so a twice-daily cream is two independent rows — which is why the row's aria-label
> carries the slot, or morning and bedtime are two buttons with the same name.
>
> **An absent log is silence, not a miss.** `skipped: true` is the only thing that means "I chose
> not to". `routineProgress` counts skips as *answered* but not *done*, and the reminder kind
> `routine` goes quiet only when done + skipped covers the day's rows.
>
> **A slotless log answers any row for its item** (`rowFor`), so a dose logged from the as-needed
> chip or by an older build still ticks the checklist rather than being asked for twice.
>
> **`src/lib/metrics.ts` is new and is now the single registry** of derived daily metrics
> (`DERIVED_METRICS`, `derivedMetric`, `isDerivedKey`, `availableDerivedMetrics`, `derivedSeries`,
> `metricCtx`). It had to move out of `tracking.ts`: `routine.ts` imports `tracking.ts` for the
> clock helpers, so the register that knows about both has to sit above both. `MetricCtx` widened
> to `{food?, bowel?, routine?, routineItems?, date}` and the two callers now pass a source object
> instead of positional arrays. Routine metrics are `rt_taken` and `rt_done`, both `dir: neutral`
> **on purpose** — a red adherence number is advice.
>
> **Everywhere else:** `RoutineScreen` (`screen === "routine"`, reached from the dashboard section
> header and an optional Quick Add tile) pairs a date pager + the shared `RoutineChecklist` with a
> manage list; timeline rows; `buildRoutineTable`/`buildRoutineItemsTable` + three columns on the
> wide table; full backup/restore; sync kinds `routine`/`routineItem` in `types.ts`, `project.ts`
> (`COLLECTIONS`, `FIELD_OF`); `.fhj-cat-routine` (gold, `--fhj-chart2`) and `.fhj-check-*` in
> index.css; four new icons (pill/bottle/drop/tube); demo data gets four items and a fortnight of
> doses that **stops at yesterday**, so the demo always opens with today still to do.
>
> **Gotcha:** the checklist row originally drew a kind icon on its right; at phone width it cost
> "CeraVe moisturising cream" its last two words to repeat what the dose line said. Verified in a
> real browser, in both themes, and removed.
>
> Tests: **704 across 28 suites** (was 658/26) — `tests/routine.test.ts` + `tests/routineUi.test.tsx`.
> **Still open:** unchanged — no licence declared, `App.tsx` still `@ts-nocheck`, on-device
> screen-reader pass not done.



> **2026-08-18 addendum 15 — 1.13: the Diary (meals + routine on one page).**
> **`FoodScreen` → `DiaryScreen`.** Screen id stays `"food"` (deep links, nav, tests); the nav
> label is **Diary**. It is now a tab-level screen — added to the `showHeader` exclusion list —
> because its own sticky `DayBar` *is* the header and the shared one was stacking a second title
> above it. `DaySummary` draws the food half always (it carries the way in to daily targets) and
> the routine half only when there is a routine. One `date` state drives meals and doses both.
>
> **Density work, and why each piece.** `RoutineCheckRow` gained `compact` — one line, dose while
> pending, clock once done — used on the Diary *and* the dashboard, so there is one row style in
> the app. `MealSection` lost its empty branch entirely; `MealChips` renders every empty meal as
> one row of add buttons (aria-label `Add food to X`, unchanged, which is what kept the existing
> tests honest). A filled meal's add button moved into its header. A slot whose rows are all
> answered folds to one summary row (`opened` state in `RoutineChecklist`, groups of one never
> fold — nothing to save and it would cost a tap to undo).
>
> **`onLogRows` / `saveRoutineRows`.** The "All N" button on a slot header logs every pending row
> in that slot in **one** `setDb`, with one toast and one Undo that restores `routine` *and*
> `routineItems` (the use-counts move with it). Only shows at ≥2 pending.
>
> **`RoutineScreen` is the plan only.** Its pager, progress card and checklist are gone — they
> were a second copy of the day, one tab away, that could drift out of step with the Diary's.
> `RoutineProgressCard` was deleted with them. It keeps add/edit/archive/search plus a
> "Tick things off" link back.
>
> **The dashboard routine lost its `Card` wrapper.** 28px of card padding was truncating
> "CeraVe moisturising cream" there while the identical component fitted it on the Diary.
>
> **Gotcha:** the progress sentence was briefly split across two elements for `tabular-nums`
> (`<span>3 of 5</span> done`), which broke every `getByText(/\d+ of \d+ done/)` and would have
> read as three fragments to a screen reader. It is one text node with the class on the parent.
>
> Tests: **713 across 29 suites** (was 704/28) — new `tests/diaryUi.test.tsx`.
> **Still open:** unchanged — no licence declared, `App.tsx` still `@ts-nocheck`, on-device
> screen-reader pass not done.


> **2026-08-18 addendum 16 — 1.14: the 12-month heatmap on Insights.**
> **New typed module `src/lib/heatmap.ts` + `src/components/YearHeatmap.tsx`.** The lib is pure
> and clock-free: `monthsEnding(today, n)`, `buildHeatmap({today, months, valueOn, loggedOn})` →
> `HeatMonth[]` (each row exactly 31 day-of-month slots, `null` past the month's end),
> `heatSummary(months, dir)` → per-month + whole-year counts/average/best/hardest read through
> the metric's direction, `mixHex`/`rampBetween`/`heatRamp`/`heatColor` for the ten-step ramp,
> and `heatLegendEnds`/`heatExtremeLabels` for direction-aware wording. Nothing imports App.tsx.
>
> **Layout: months as rows, days-of-month as columns.** Not the contribution-graph shape. The
> arithmetic decides it: a card is ~330px on a phone, so 53 week columns give ~5px/day and 31 day
> columns give ~9px. Weekday alignment is the cost; the Calendar screen already owns weekday
> questions with 44px targets. `.fhj-heat*` classes live at the foot of `src/styles/index.css`;
> the grid bleeds `-0.75rem` past the card padding because 32px is three more pixels per square.
>
> **Interaction: select, then open.** A 9px square cannot be a one-tap route into an editor. First
> tap sets `selected` and fills the readout strip under the grid (day, score, and an Open / "Log
> it" button); a second tap on the same square opens it. The strip is always present — it shows
> the year's headline ("33 of 352 days logged · avg 6.3") when nothing is selected — so the card
> never changes height. Read-only viewer passes no `onOpenDay`, which drops the button and makes
> the second tap inert.
>
> **A11y.** 365 buttons is one tab stop: roving `tabIndex` (selected → today → last logged),
> arrows ±1 day / ±31 for a month, Home/End. Every square's `aria-label` is the long date plus
> "Itch 7 out of 10" / "logged, no rating" / "nothing logged". **Read it month by month** is the
> non-chart fallback — a real `<table>` with `scope` on both axes, one row per month, plus the
> year's best/hardest named in prose.
>
> **Three empty states, deliberately different.** Score = filled square; logged-but-no-answer-for-
> this-metric = outline in `C.sub`; nothing logged = `C.faint` fill. A sparse year has to read as
> sparse rather than as a hole in the drawing.
>
> **Scale metrics only.** `heatMonths` is `null` unless `metricField.type === "scale"`, and the
> card falls back to `ChartEmpty` naming the metric's unit. It reads `entries`, not
> `chartEntries`: the derived metrics folded into the latter are counts and grams and have no
> place on a severity ramp.
>
> **Gotcha:** cells were first 13px tall with a 3px radius, which at 8px wide rendered as a field
> of pills rather than a grid; and the fallback table overflowed the card until the headers went
> to one word ("Best"/"Hardest") and the row header to `Aug 2026`. Both found in a real browser,
> both themes, at 390px.
>
> Tests: **747 across 31 suites** (was 713/29) — new `tests/heatmap.test.ts` (20 pure) and
> `tests/heatmapUi.test.tsx` (14 jsdom).
> **Still open:** unchanged — no licence declared, `App.tsx` still `@ts-nocheck`, on-device
> screen-reader pass not done.


> **2026-08-19 addendum 17 — 1.15: Insights rebuilt; episodes are a first-class record.**
> **Four new pure modules, none of which draws anything.** `src/lib/distribution.ts` (buckets,
> mean/median/mode with ties broken toward the median, population SD → `steady|mixed|swinging`,
> hard/calm counts against `HARD_AT=7`/`CALM_AT=3` on the *badness* scale so `dir` decides which
> end is which). `src/lib/episodes.ts` (the `HealthEpisode` model, `sanitizeEpisodes`,
> `startFlare`/`endFlare`/`updateEpisode`/`removeEpisode`, `episodeStats`, `episodeYear`,
> `compareEpisodeYears`, `episodeBands`). `src/lib/longterm.ts` (`monthlyAverages`, `yearLines`,
> `sameMonthLastYear`, `extremeMonths`, `longestStableRun`, `seasonalAverages`, with
> `MIN_DAYS_PER_MONTH=6` and `MIN_YEARS_FOR_SEASON=2` exported so the UI can print *why* a thing
> is hidden). `src/lib/relationships.ts` (`pairUp` with lag, `ranks` with ties averaged,
> `spearman`, `strengthOf` gated on n, `MIN_PAIRS=12`/`SOLID_PAIRS=30`, and `RELATIONSHIP_COPY`
> as the single object the causal-language audit reads). All four are clock-free — every caller
> passes `today`.
>
> **Episodes through the database.** `AppDatabase.episodes`, re-exported `HealthEpisode` from
> `types/models`, `sanitizeEpisodes` in `migrateDb`, an `episodes` branch in `validateDatabase`,
> `"episode"` added to `RecordKind` + `COLLECTIONS` + `FIELD_OF` in `sync/project`, and
> `episodes` in `buildFullBackup`/`restoreBackup`. Deletes go through `addTombstone` like every
> other collection.
>
> **`InsightsScreen` replaced wholesale.** New order: range selector → hero → four `SummaryCard`s
> → `MainTrendChart` → `EpisodesSection` → `YearHeatmap` (+ `LongTermView` in a Disclosure) →
> `ScoreDistribution` → `MetricComparison` → `RelationshipExplorer` → the pre-existing
> PatternsSection/reports/photos/recent/backup/export tail. `INSIGHT_RANGES` carries both `label`
> (the control) and `prose` (the same window in a sentence) — without the second one every line
> read "3 months average".
>
> **Pinned metrics** live on `profile.pinnedMetrics` (max 4) and are written on every toggle via
> `pinMetrics`. `MetricPicker`'s label on this screen is now **"Pinned metrics"**, which broke
> `tests/metricPicker.test.tsx`'s App-level query (the component's own default is unchanged).
>
> **Deleted:** `MultiMetricChart`, `MetricChart`, `seriesFor` — all three fixed at 30 days,
> superseded by `MainTrendChart` (range-aware, episode bands) + `components/MetricComparison`
> (ratings share one 1–10 axis; every other unit gets its own small chart, synchronised by
> recharts `syncId`). `seriesBetween` is the range-aware `seriesFor`.
>
> **New screen `episode`** (`EpisodeDetailScreen`), reached from the flare card or the timeline,
> with `episodeId` held in App state. Its chart deliberately draws ±14 days around the flare.
>
> **Gotchas, all found in a real browser:**
> · An `<Area>` sharing a `dataKey` with a `<Line>` prints the value twice in the tooltip —
>   fixed with `tooltipType="none"` on every Area (three charts).
> · The Insights range selector is a `radiogroup`, so `tests/aiWizard.test.tsx`'s unscoped
>   `getAllByRole("radio")` started picking it up through the wizard sheet; the query is now
>   scoped with `within(dialog)`.
> · Group-comparison bar values were printed *over* the fill and had to clear contrast against
>   fill and track in two themes; they are outside the track now.
> · A native `<select>` with the platform arrow stripped reads as a heading, not a control — one
>   chevron fixes it.
> · The demo journal is ~33 days, so the 3-month range has no previous period; the "vs previous"
>   line correctly becomes "no earlier period to compare with", and the test pins that.
>
> Tests: **852 across 36 suites** (was 747/31) — `tests/distribution.test.ts` (14),
> `tests/episodes.test.ts` (33), `tests/longterm.test.ts` (20), `tests/relationships.test.ts`
> (20), `tests/insightsUi.test.tsx` (18).
> **Still open:** unchanged — no licence declared, `App.tsx` still `@ts-nocheck`, on-device
> screen-reader pass not done.

> **2026-08-19 addendum 18 — 1.16: the Appointment Pack.**
> **`src/lib/appointmentPack.ts` (new, fully typed, pure, clock-free).** The whole pack is one
> `buildAppointmentPack(input)` over `{today, range, entries, primary, metrics, episodes,
> routineItems, routineLogs, sections, noteDates, questions, photo}`. Range helpers
> (`rangeOfDays`, `rangeSinceAppointment`, `rangeCustom`, `previousWindow`) are exported because
> Export builds the range and the pack screen consumes it — the two must agree on one window.
> Floors are exported too (`MIN_AVERAGE_DAYS=3`, `MIN_CHANGE_DAYS=5`) so the UI can print *why*
> something is missing: every section that is on but empty lands in `pack.omitted` with a reason,
> which the section switches show and the paper never does.
> Two decisions carry the module. **Changes are ranked by relative movement** (`|delta| / |prev|`)
> — ranking on the raw delta would fill every pack with whichever metric has the largest units,
> and a step count would permanently outrank a 1–10 rating. **Adherence counts from
> `item.createdAt`**: the app keeps no history of schedules, only the plan as it stands today, so
> counting a medication added on Monday against four earlier weeks would invent a failure.
> As-needed items are counted (`taken`) and never scored (`adherence: null`).
>
> **`src/components/AppointmentPackView.tsx` (new).** Presentational; takes the built pack, a
> `meta` block, a `renderPhoto` render prop (so the module never touches photo storage), and
> optional edit callbacks — omit them and it is a read-only document, which is what the viewer
> gets. The question editor writes through `onQuestionsChange`; starters are offered only while
> the list is empty.
>
> **Profile slice `profile.appointment`** (`{lastAppointment, sections, questions, noteDates,
> photoField}`), sanitised on every load in `migrateDb` via `sanitizePackPrefs`. It is *not* in
> `DEVICE_LOCAL_PROFILE_KEYS`: the questions somebody has been collecting for a fortnight describe
> the journal, not the machine, so they travel with sync and with a backup.
>
> **New screen `pack`** (`AppointmentPackScreen`), reached only from Export via `openPack(range)`
> → `packParams`. `AppointmentPackCard` is the entry point and is the first thing on Export,
> above CSV/Excel/JSON, which now sit under a "Raw data" heading.
>
> **Print.** `.fhj-pack-*` classes in `index.css` with a second `@media print` block: four
> figures across, section fills dropped, `break-inside: avoid` per section, and a rule under each
> question to write the answer on. Two things bit here and are worth remembering: the pack's
> masthead is `print-only` (on screen the app header and the control card already say it), and
> **section headings read their colour from the live theme**, so on paper a dark-theme ink printed
> as pale grey and the headings vanished — the print block now forces `#1a1c21` on
> `.fhj-pack-head`/`.fhj-pack-title` and `#4a4d57` on `.fhj-eyebrow`. `.fhj-shell` also had to
> join `.max-w-md` in losing its max-width, or the whole document printed as a 28rem column down
> the left of an A4 page. Verified by rendering to PDF in headless Chromium.
>
> Tests: **896 across 38 suites** (was 852/36) — `tests/appointmentPack.test.ts` (30, the
> arithmetic and everything it refuses to print), `tests/appointmentPackUi.test.tsx` (14, the pack
> being first on Export, one tap to a page, section switches, and questions surviving a reload).
> **Still open:** unchanged — no licence declared, `App.tsx` still `@ts-nocheck`, on-device
> screen-reader pass not done.

> **2026-08-19 addendum 19 — 1.17: the fast daily experience.**
> **Two new pure modules.** `src/lib/pulse.ts` (`pulseState` — what counts as recorded;
> `dayKind`/`badness` on the same 7/3 thresholds as `distribution.ts`; `followUps(ctx)` — the
> three-to-five optional details, ranked by whether the day is hard or calm, filtered by what is
> already answered, capped at five, `scoreWord`). `src/lib/quickActions.ts` (`scoreOf` =
> frequency × `recencyWeight`, half-life 10 days; `rankIds(ids, stats, today, mode)` — a *stable*
> sort so unused ids keep catalogue order, and `"manual"` returns them untouched; `noteUse`;
> `sanitizeActionStats` bounded at 60 keys; `repeatSuggestions` across foods, routine items,
> photo fields, number fields and the note). Both clock-free.
>
> **Today.** `DailyPulse` + `PulseScale` sit above Quick Add and write through `onPatch`
> (`upsertEntry`) directly — the dashboard now takes `onPatch`. The saved line is derived from
> `entries` on every render; nothing about it is local state. `FollowUpCard` renders the app's own
> `FieldInput`, so an answer given there is identical to one given in the survey.
>
> **Navigation.** `NAV` is `[dashboard, add(action), history]`. The + is not a screen: it sets
> `addSheet` in App and jumps to Today, which owns every sheet it can open (`AddSheet`,
> `NoteSheet`, `MeasurementSheet` — which skips its own picker when a setup has one number —, and
> `RoutineQuickSheet`, which reuses `RoutineChecklist`). New screen `history`
> (`HistoryScreen`) embeds `CalendarScreen embedded` plus recent-day rows and the two doors
> (Insights, Diary). `showHeader` now also excludes `history`; the shared header gained a gear.
> **Nine test call sites navigated via the old tabs** and were rewritten to go through History.
>
> **Truthfulness.** `patchHasContent`/`entryValueCount` are the one definition of "logged".
> `upsertEntry` refuses to *create* an entry from a patch with no content (an existing entry still
> accepts a null — that is clearing an answer). `GuidedQuickLog` shows `NothingLogged` instead of
> `FinishCelebration` when the day has no value, and `skipBatch` no longer writes nulls over
> answers that already exist.
>
> **Onboarding.** `ONBOARD_STEPS` is welcome / focus / **metric** / questions / photos / body /
> **first** — the appearance step is gone (all of it was already in Settings' `AppearanceCard`).
> New `profile.keyMetric`, honoured by `computeProfileTemplate` only while it names an enabled
> 1–10 field, chosen in setup and editable in `EditSetupScreen`. `onComplete(profile, dest,
> firstEntry)` — the first entry is written by App, because the profile it belongs to does not
> exist until that call.
>
> **Quick Add.** `resolveQuickAdd(profile, {hasPhotoField, stats, today})` ranks;
> `profile.quickAddOrder` ("auto" | "manual") and `profile.actionStats` are new profile fields,
> sanitised in `migrateDb` and synced with the profile. Every Quick Add and + action is wrapped in
> `track(id, fn)` so a new action cannot forget to be counted. `RepeatRow` (food-only) is
> superseded by `QuickRepeats`, fed by `repeatSuggestions`.
>
> **Gotchas.** The nav's `aria-label="Add to today"` collided with the food sheet's "Add to
> breakfast" in one test query — accessible names in this app are close enough together that
> screen-level regexes need anchoring. The viewer renders `ViewerLanding` before any nav exists,
> so a nav assertion there has to go through "browse example data" first.
>
> Tests: **955 across 43 suites** (was 936/42) — `tests/pulse.test.ts` (14),
> `tests/pulseUi.test.tsx` (7), `tests/navigation.test.tsx` (14), `tests/completion.test.tsx` (7),
> `tests/quickActions.test.ts` (15); `onboarding` and `appearance` rewritten for the health-first
> flow.
> **Still open:** unchanged — no licence declared, `App.tsx` still `@ts-nocheck`, on-device
> screen-reader pass not done.

> **2026-08-19 addendum 20 — 1.18: the first thirty seconds.**
> **`src/components/FirstRun.tsx` (new)** is the first-run surface: four acts in one component
> (`hero | focus | entry | born`) held in local state, with `onComplete(choice)` handing App
> `{modules, keyMetric, score, note}`. It is fully presentational — the pack catalogue arrives as
> a `packs` prop built by `FIRST_RUN_PACKS()` in App.tsx (a function, not a constant, because
> `TEMPLATES[*].color` is a live getter that follows the theme), and even `Icon` is passed in, so
> the component draws nothing of its own and can be reasoned about without App.
>
> **`src/lib/intro.ts` (new, typed)** is the choreography: `heroIn` (clip-reveal lines → rail draw
> → fragments → CTA, then per-fragment float loops on their own periods, returning one killer),
> `actIn`, `rungPop`/`readoutSwap`, `liftCard`/`landCard` (the FLIP, deliberately split because
> the act that owns the card unmounts between the two — capturing a rect and cloning later would
> animate from a position that no longer exists), `buildTimeline`, `bloom`, `countUp`. Everything
> no-ops under reduced motion and calls its `onDone` regardless.
>
> **App wiring.** `if (!db.onboarded)` now renders `FirstRun` (with `AmbientBackdrop` behind it);
> `detailedSetup` state swaps in the untouched `OnboardingWizard`. `beginJournal(profile, dest,
> firstEntry)` is the single writer for both paths and takes `firstEntry.note`. The short path
> builds its profile with `buildOnboardProfile` over the packs' `quick` fields, so both paths
> produce the same object. `justBegan` runs `animateStepIn` on the first dashboard once.
>
> **The hook-order trap, paid for a second time.** The `justBegan` effect was first written next to
> the JSX it animates — below `if (!db.onboarded) return`, `if (!lock)`, `if (corrupt)` — and
> every existing-journal test went blank with "Rendered more hooks than during the previous
> render". Same bug as addendum 7's `ReportScreen` crash. **In App.tsx, every hook goes above the
> early-return stack**, which now starts at `if (!viewer && lock === undefined)`.
>
> **Drag-to-rate.** `BigScale` reads the value off the pointer's x within the row. Two details are
> load-bearing: it must *not* `setPointerCapture` (capture retargets the click and the plain tap
> stops working — this cost a debugging round in the browser), and the click that ends a drag is
> suppressed via a flag cleared on the *next* `pointerdown` rather than when a click consumes it,
> because a drag ending off a rung produces no click at all and a stale flag ate the following tap.
>
> **CSS.** One `/* First run — the four acts */` block: `.fhj-fr-*`. Type is set much larger than
> anywhere else in the product (`clamp(2.6rem, 13vw, 3.5rem)` on the hero), the collage is a rail
> with fragments hanging off it at their own widths and rotations (the same shape act four draws
> for real), and `.fhj-fr-card.is-live` takes `--fhj-day` from the score so the card carries the
> day's temperature.
>
> **Verified in a browser, not only in jsdom:** the whole flow end to end in dark and light, with
> `reducedMotion: "reduce"` and without, zero console errors, plus a real mouse drag across the
> scale proving tap-then-drag-then-tap all still register.
>
> Tests: **967 across 44 suites** (was 955/43) — `tests/firstRun.test.tsx` (12);
> `onboarding`/`appearance` now reach the long form through the hero.
> **Still open:** unchanged — no licence declared, `App.tsx` still `@ts-nocheck`, on-device
> screen-reader pass not done.

> **2026-08-19 addendum 21 — 1.18: the trend chart *is* the comparison; the app's own select.**
> **`MetricComparison` absorbed `MainTrendChart`.** Insights let you pin four metrics and drew
> one; the comparison lived in a separate "Side by side" card three sections down. That card is
> gone and `MainTrendChart` is deleted. `components/MetricComparison` gained `primaryKey` (the
> lead series: heaviest line, `mainHeight` rather than `subHeight`, dots when the window is ≤62
> days), `avgKey` (defaults to `"avg"` — the primary's trailing 7-day average, drawn dashed in
> `C.avgLine` on whichever of the two chart kinds the primary lives on), `note` (printed under
> the primary's own chart), and `renderEmpty` so App can pass its own `ChartEmpty`. The ratings
> chart is a `ComposedChart` now, not a `LineChart`, because it has to carry the fade and the
> average. A series with fewer than 3 points in the window is not drawn: its key is faded and,
> when nothing else shares that chart, an empty state says how many days it has.
>
> **`comparisonData` in `InsightsScreen`** now also carries `avg` — the same 7-day trailing mean
> `seriesBetween` computed, over the pinned primary — so the chart takes one `data` array.
> `seriesBetween` itself stays: `EpisodeDetailScreen` still uses it.
>
> **`src/components/FieldSelect.tsx` (new)** replaces the two native `<select>`s in
> `RelationshipExplorer`. Select-only combobox pattern: a `<button role="combobox">` trigger, and
> the list rendered through `createPortal` into `document.body` as the app's standard
> `.fhj-scrim` + `.fhj-sheet` with `role="listbox"` on the scrolling body. Options are grouped
> "Rated 1–10" / "Measured its own way"; ratings deliberately print no per-row unit (the group
> title says it once). A filter field appears at ≥9 options and resets on every open. Keyboard:
> ↑/↓/Home/End move `active`, Enter/Space commits, Escape closes, focus returns to the trigger.
> It calls `lockPageScroll()` from `lib/motion` itself, so Lenis does not scroll the page behind
> it — `Modal` in App.tsx is not reachable from `components/`.
>
> **Gotchas:** a `<button>` needs an explicit `role="combobox"` or Testing Library's
> `getByRole("combobox")` never finds it; the global `input:focus-visible` outline out-specifies
> a class-level `outline: none`, so the filter needed its own `:focus-visible` rule (the wrapper
> already lights up); the active-row lookup walks `[data-k]` nodes rather than building a
> selector, because field keys are user-authored.
>
> **CSS.** `.fhj-select*`, `.fhj-sel-*`, `.fhj-opt*` replace `.fhj-rel-choose/.fhj-rel-select*`;
> `.fhj-cmp-key*` is the chart key shared by both chart kinds; `.fhj-rel-pickers` goes two-up
> above 34rem.
>
> **Verified in a browser:** dark and light, single pin and four pins, a rating primary and an
> own-unit primary, the sheet open, filtered, and empty.
>
> Tests: **978 across 45 suites** (was 967/44) — `tests/fieldSelect.test.tsx` (10);
> `insightsUi` swapped its two `<select>` assertions for the combobox/listbox and now pins that
> every pinned metric reaches the trend chart.
> **Still open:** unchanged — no licence declared, `App.tsx` still `@ts-nocheck`, on-device
> screen-reader pass not done.

> **2026-08-19 addendum 22 — 1.18: chart view options, and the scroll lock that scrolled.**
> **The bug worth remembering.** Closing *any* sheet flew the page from the top back down to
> where it was, over about a second. `lockPageScroll` pins the body (`position: fixed; top: -y`)
> and restored the offset with `window.scrollTo`, which is animated twice here: the stylesheet
> sets `html { scroll-behavior: smooth }`, and Lenis *replaces* `window.scrollTo` with its own
> eased version. The restore now suspends smooth behaviour, writes `document.scrollingElement
> .scrollTop` directly (the one route neither intercepts), then `lenis.start()` →
> **`lenis.resize()`** → `lenis.scrollTo(y, { immediate: true, force: true })`. The `resize()` is
> not optional: Lenis measured the document while it was pinned, so its cached limit is 0 and its
> own `scrollTo` clamps straight back to the top — which is exactly what the first attempt at
> this fix did. The lock also holds the scrollbar gutter open (`body.paddingRight`) so desktop
> cards stop shuffling 15px sideways when a sheet opens. `tests/scrollLock.test.ts` (6) pins all
> of it, including "never calls `window.scrollTo`".
>
> **`src/lib/chartView.ts` (new, pure)** is the saved `ChartView`: `shape` (line | area | steps |
> dots), `avg` (off | on | only), `breakGaps`, `apart`, `zoom`, plus `DEFAULT_CHART_VIEW`,
> `sanitizeChartView` (per-field fallback — one bad key must not discard the rest),
> `chartViewSummary` for the closed disclosure row, `curveOf`, and `avgKeyOf` — the `avg~<key>`
> row key, prefixed so it can never collide with a real field key. Persisted at
> `profile.chartView` via `saveChartView`, and it syncs like `pinnedMetrics` does.
>
> **`src/components/ChartViewControls.tsx` (new)** is five `fhj-segmented` rows inside App's
> `Disclosure`, each with a line saying what the choice *costs*. Two rows are conditional:
> "Several ratings" needs more than one rating pinned, and both rating rows need a rating at all.
>
> **`MetricComparison` is panel-driven now.** It builds a `Panel[]` (`apart` → one per field;
> otherwise the ratings share one and every own-unit metric keeps its own), sorts the primary's
> panel first, and draws each with its own domain — `[1,10]`, or a fitted range computed here,
> or `["auto","auto"]` for own units. `avg: "only"` swaps every series' `dataKey` for its
> average, fills included. The date axis is drawn under the *last drawn* panel, not the last
> field. Rows now carry an average per metric rather than one for the primary.
>
> **`WeeklyBars` → `PeriodBars`**, with a Weeks/Months segmented control (`monthlyBars`, six
> calendar months) and `n` on every bar so the tooltip can say how many days are behind it. The
> Disclosure's own label follows the choice ("Week by week" / "Month by month").
>
> **CSS.** `.fhj-view*` (the controls), `.fhj-cmp-keyset`; `.fhj-rel-pickers` goes two-up at
> 46rem rather than 34rem — at 34rem "COMPARED WITH" wrapped and the two triggers stopped
> matching.
>
> **Verified in a browser:** every shape, every average mode, gaps, apart, the fitted axis and
> its confession, weeks vs months, and the scroll offset measured before/after all four ways of
> closing a sheet (Escape, scrim, Close, choosing) — unchanged to the pixel at 120ms, 400ms and
> 1200ms.
>
> Tests: **997 across 47 suites** (was 978/45) — `tests/chartView.test.ts` (6),
> `tests/scrollLock.test.ts` (6), `insightsUi` +7 (the view controls, the fitted-axis caption,
> the reset, weeks/months).
> **Still open:** unchanged — no licence declared, `App.tsx` still `@ts-nocheck`, on-device
> screen-reader pass not done.

> **2026-08-19 addendum 23 — 1.19: Quick Add is shaped like the condition; first run guides the
> whole setup.**
> **The catalogue grew from seven tiles to fourteen and learned what a setup can answer.**
> `QUICK_ADD_TILES` now carries an optional `needs` key (`photo | number | scale | water | hr |
> trigger | flare`), and **`quickAddContext(tpl)`** — the one function three callers share
> (dashboard, editor, end of first run) — derives both the fields each tile writes to
> (`waterField`, `hr.rest`/`hr.stand`, `triggerField`, `scaleFields` sorted main-number-first)
> and the `caps` object `tileSupported` checks against. Derived from the *template*, not the pack
> list, so switching `resting_hr` off in Edit Setup removes the Heart rate button.
>
> **`PACK_QUICK_ADD` + `defaultQuickAdd(modules)`** replace the fixed `DEFAULT_QUICK_ADD` when a
> profile has no saved `quickAdd`: check-in always leads, then each pack's list round-robin (so
> two conditions each get their first choice before either gets its third), capped at six.
> `DEFAULT_QUICK_ADD` survives as the no-packs fallback. **Existing installs are affected** —
> they had no `quickAdd` either — which is intended and non-destructive.
>
> **New actions.** `flare` (starts/ends the open episode on the key metric — `beginFlare`/
> `finishFlare` are now passed to Today as well as Insights), `symptom` (`SymptomSheet`: pick a
> 1–10 question, rate it, closes itself), `hr` (`HeartRateSheet`: two `NumberPadSheet`s and the
> live difference, with `HR_RISE_NOTE` and a "record, not a diagnosis" line), `water` (no sheet at
> all — one `onPatch` plus a toast with Undo), `trigger` (`TriggerSheet` over `ChipsInput`), plus
> `note` and `measurement` promoted from the + sheet. `ScaleInput` gained `hideLabel` for sheets
> that already print the question as their title.
>
> **One handler map, two doors.** `quickAddActions`/`addActions` are merged into one `actions`
> object, and `ADD_ACTIONS` is deleted: **`AddSheet` now takes `ids={quickAddIds}`** and renders
> the person's own row, with the remaining supported tiles behind an "Everything else (n)"
> disclosure and an "Edit these buttons" link into `QuickAddEditor`. `tileFace(tile, live)` is
> how a tile describes today rather than naming a feature (Check-in → "Done today", Flare → "End
> flare · day 6", Water → "3 cups so far"); both surfaces read the same `live` map.
>
> **First run is six acts and one path.** `OnboardingWizard` (~600 lines), `ONBOARD_PACKS`,
> `ONBOARD_STEPS` and the `detailedSetup` state are **deleted**, along with
> `tests/onboarding.test.tsx`. `BodyMap`, `spotLabel`, `PROMISES` and `buildOnboardProfile`
> survive and are now *props to* `FirstRun` (the component still draws nothing of its own).
> Two new acts sit between the packs and the entry:
> - **tune** — the merged pack questions (photos and weight excluded; they are act four's job)
>   grouped by section, with `depth` presets (Quick/Balanced/Thorough) and `hand: Set | null` —
>   null means "still following the preset", which is what lets going back and changing a pack
>   re-derive the list instead of stranding answers about questions that no longer exist. The
>   cost model (`checkInSeconds`/`checkInTimeLabel`, exported for tests) prints the honest
>   seconds-a-day and re-runs `readoutSwap` on every change. The key metric is locked on.
> - **extras** — `FIRST_RUN_EXTRAS` (photos/routine/food/flare/bowel/weight, pre-ticked by
>   `suggest` per module), the body map when a skin pack is in play, the live preview of the
>   Quick Add row being assembled, and the reminder chips.
>
> `FirstRunChoice` grew `enabledKeys`, `customQuestions`, `extras`, `spots`, `reminder`;
> **`firstRunProfile(choice)`** turns all of it into `[profile, dest, firstEntry]` — including
> `profile.quickAdd` via `firstRunQuickAdd` (extras' tiles first, then `defaultQuickAdd`, then
> filtered by `caps`) and `profile.reminders` via `newReminder`. `beginJournal` is unchanged and
> is now the only writer.
>
> **CSS.** `.fhj-fr-rail-steps` (the four-segment progress rail), `.fhj-fr-cost*`,
> `.fhj-fr-depth*`, `.fhj-fr-q*` (sections and switch rows), `.fhj-fr-own*` (a question of your
> own), `.fhj-fr-extra*`, `.fhj-fr-spot*`, `.fhj-fr-preview*`, `.fhj-fr-nudge*`,
> `.fhj-fr-promises`.
>
> **Verified in a browser, not only in jsdom:** the whole first run for eczema+POTS and for POTS
> alone; water/heart-rate/symptom/flare/trigger each pressed and the write checked; the + sheet
> mirroring the row; zero console errors.
>
> Tests: **1014 across 47 suites** (was 997/47) — `tests/quickAddTiles.test.tsx` (13, new),
> `firstRun` 12 → 21, `onboarding` (9) deleted; `foodBowelUi`, `navigation` and `routineUi`
> updated for a Quick Add row that is no longer a fixed four.
> **Still open:** unchanged — no licence declared, `App.tsx` still `@ts-nocheck`, on-device
> screen-reader pass not done.

> **2026-08-20 addendum 24 — 1.20: the first run knows who it is for; the survey act teaches;
> photos ask what they are of.**
>
> **Eight screens, five numbered.** `Act` is now
> `hero | you | focus | tune | photos | extras | entry | born`; `FLOW` is the five numbered ones
> and `RAIL = ["Tracking","Questions","Photos","Extras","First entry"]` is the single source for
> every `StepRail`. The hero's CTA lands on `you`, not `focus`.
>
> **The doorway (`you`).** Deliberately outside `FLOW` — a step number turns a welcome into a
> registration form. Holds `name` and `age`, both refusable. `skipYou()` *clears* both rather
> than walking past them, so nothing half-typed is kept by accident. `first` (the first token of
> the trimmed name) is what the greeting, the focus heading, the tune sub-copy, the CTA and the
> born headline all use. New `AgeDial` is a real `<input type="range">` under the paint (keyboard
> + screen reader for free, and `fireEvent.change` in jsdom), `AGE_MIN/MAX/DEFAULT = 5/100/32`,
> with the implied birth year printed under the numeral. The persuasion is `.fhj-fr-letter` — the
> appointment-pack masthead drawn with their own answers filling into it — plus `.fhj-fr-why`.
>
> **Age is stored as `profile.birthYear`, never as an age.** `profileAge(profile)` (App.tsx,
> beside `blankProfile`) derives it and is the only reader; it clamps to 0–130 and returns null
> otherwise. `TrackingSetup.birthYear?: number` added to `types/models.ts`. Surfaced on the
> appointment pack (`Meta.age`, new optional field on `AppointmentPackView`), the printed
> weekly/monthly masthead, the XLSX Profile sheet (`profile_age`), and `greetingFor(d, name)` on
> Today. `EditSetupScreen` gained an age box that writes `birthYear` back through `updateProfile`
> — an emptied box clears it, because "I'd rather not say" has to be reversible.
>
> **The tune act teaches the survey system.** New `MiniControl({type})` draws the answer control
> (ten rungs / Yes+No / chips / a boxed number / three lines) and appears in three places: the end
> of every question row, inside the lens chips, and inside the custom-question type picker. New
> `PreviewField({q})` is the same six shapes at answering size. `Lens = all | scale | toggle |
> other` + `LENSES` + `inLens(type, lens)` drive the chip row (each with a live *n on* count);
> the lens filters `sections` at render time only and force-opens every section while active, so
> it can never change what is kept. `previewOpen` renders `.fhj-fr-pv` — the whole enabled
> check-in in order, with the seconds-a-day at the foot. `CUSTOM_TYPES` gained `text`, the picker
> is a 2×2 grid, and the composer draws the question being written via `PreviewField`.
>
> **Photos are their own act.** `FirstRunPhotoSubject` + the `photoSubjects` prop;
> `FIRST_RUN_PHOTO_SUBJECTS` (App.tsx) offers areas / flare / progress / meal / label / swelling /
> healing / anything, pre-ticked by `suggest` per module, with `areas` dropped unless a `skin`
> pack and a `BodyMap` are both in play. `kind: "spots"` opens the body map (moved here out of
> `extras`), `kind: "progress"` opens the Front/Side/Back chips (`angles`). `shots` flattens
> subjects + spots + angles into the labelled contact sheet (`.fhj-fr-sheet`), and `photosOn =
> shots.length > 0` is what puts the Photo tile in the preview row. **`photos` is deleted from
> `FIRST_RUN_EXTRAS`** and `FirstRunExtra.spots` with it.
>
> `PHOTO_SUBJECT_FIELDS` maps each plain subject to a photo question (`c_photo_flare`,
> `c_photo_meal`, `c_photo_label`, `c_photo_swelling`, `c_photo_healing`, `c_photo_any`) with its
> own `rated` and `requiredInSession` — a flare is rated and chased, a plate of food is neither.
> `buildOnboardProfile` builds them beside the mapped body areas and re-uses a pack's own photo
> field where the key matches rather than duplicating it. `FirstRunChoice` grew `name`, `age`,
> `photoSubjects`, `progressAngles`; `firstRunProfile` no longer guesses angles or spots, and
> synthesises a `photos` entry for `firstRunQuickAdd` only when a photo question actually exists.
>
> **CSS.** A second first-run block: `.fhj-fr-you*`, `.fhj-fr-age*`, `.fhj-fr-letter*`,
> `.fhj-fr-why*`, `.fhj-fr-mini-ctl*`, `.fhj-fr-lens*`, `.fhj-fr-pv*`, `.fhj-fr-own-pv`,
> `.fhj-fr-subject*`, `.fhj-fr-angle*`, `.fhj-fr-sheet` / `.fhj-fr-frame*`. `.fhj-fr-own-type
> span` was re-scoped to `> span:not([class])` so it stops catching the drawn control now sitting
> beside it. Both new animations (`fhjFrFrame`, the preview reveal) are no-ops under
> reduced motion.
>
> Tests: **1027 across 47 suites** (was 1014/47) — `firstRun` 21 → 34 (three new describes: the
> doorway, understanding the survey you are designing, what is worth a photograph);
> `appearance`'s "does not ask about the look" now checks the doorway *and* the tracking screen.
> **Still open:** unchanged — no licence declared, `App.tsx` still `@ts-nocheck`, on-device
> screen-reader pass not done.


> **2026-08-20 addendum 25 — 1.21: the sun, the sky, an experiment and a lab result — and the seam
> that makes them one product.**
>
> **Seven new typed modules, none of which read a clock.** Every function that needs "now" is
> handed it, which is what lets the live session screen, the "next window" card and the test suite
> run the same code and agree.
>
> - **`src/lib/solar.ts`** — NOAA low-precision solar position, sunrise/sunset/solar noon (with a
>   real `polar: true` branch: `hourAngle` returns NaN and everything downstream becomes `null`
>   rather than NaN o'clock), daylight duration, `daySamples()`, clear-sky UV, SED arithmetic,
>   `minutesToBurn`, `uvbFraction`, `estimateVitaminD`, and the window finders. **Calibration is
>   load-bearing and pinned by tests**: `clearSkyUV = 12·sin(elev)^2.2` fits the published
>   clear-sky curve (8.7 at 60°, 5.6 at 45°, 2.6 at 30°); `IU_CONSTANT = 12500` puts the reference
>   case (fair skin, ~80% BSA, one MED) at 8–20k IU and a realistic twenty minutes in a t-shirt in
>   the hundreds-to-low-thousands. SPF is credited at ~40% of its label because nobody applies
>   2 mg/cm². Synthesis **plateaus** (`1 − e^(−1.6·medFraction)`), so more sun never buys
>   proportionally more estimate. The estimate is always a ±35% range and always carries its
>   `assumptions[]` as *data*, so the disclosure panel cannot drift out of step with the maths.
> - **`src/lib/sun.ts`** — `SunSession` (a snapshot: skin, exposure, shade, SPF and the sample arc
>   are copied at log time, so correcting a skin type in Settings can never rewrite a past day),
>   `LiveSession` held in React state and *never* in `db` (a half-finished session would sync to
>   another device as one that is somehow still running there), `readout()` integrating dose over
>   samples rather than UV-now × duration, `burnState()`, `finishSession()`, `manualSession()`,
>   `sunDay`/`sunTotals`, `firstLightAfterWaking`, and `SUN_METRICS`.
> - **`src/lib/context.ts`** — `ContextConsent` (off, `location: "device"|"manual"|"off"`),
>   `coarse()` (2 dp ≈ 1 km, applied **before** storage or a request, in one place), `DayContext`,
>   Open-Meteo URL builders + `parseForecast`/`mergeAir` split from the fetch so the parsing is
>   testable without a network, `withPressureChange` (never across a gap), `mergeContexts`,
>   `needsRefresh`, `CONTEXT_METRICS`, and the observation builders. `hardDayObservation` needs
>   ≥20 overlapping days and ≥2/3 of the hardest days on one side of the median;
>   `bandObservation` needs ≥8 days each side and a ≥0.5-point gap.
> - **`src/lib/labs.ts`** — `LabResult` with `kind: "measurement" | "estimate"` (the type-level
>   guard that keeps a sunlight estimate out of the lab column), a 21-test catalog with unit
>   conversions, `labSeries()` (converts a mixed-unit history onto the **latest** unit, converting
>   the lab's own range with it), `rangeStatus` (`"unknown"` when no range was captured — the
>   catalog range is a *prefill*, never a verdict), `changesBetween()`, and `vitaminDBesideSun()`.
> - **`src/lib/experiments.ts`** — `Experiment` (`split` | `beforeAfter`), `splitPoint()` (the
>   **lower** median, not the upper: a bimodal factor like "9 glasses on the days I remember, 2 on
>   the days I don't" puts every day below an upper median and produces a 50-vs-0 comparison),
>   evidence graded on `min(high, low) × 2`, `suggestExperiments`, `STARTERS`.
> - **`src/lib/evidence.ts`** — one ladder for the whole app.
>   `EMERGING_AT/USEFUL_AT/ESTABLISHED_AT = 12/30/90`, plus `USEFUL_WEEKS = 3` and
>   `ESTABLISHED_PERIODS = 3` months, so a burst of days is capped at Emerging. **No confidence
>   percentages anywhere** — pinned by a test that greps the serialised output for `\d+%`.
>   `STANDING_LIMITATIONS` is on every report.
> - **`src/lib/series.ts`** — the seam. `variables(sources)` flattens survey answers, food, bowel,
>   routine, sun, environment and labs into one list of `{ k, label, unit, dir, sec, kind,
>   value(date) }`, which is how an experiment compares a pollen count against a symptom without
>   either side knowing about the other.
>
> **New db slices**, all sanitised on every load like everything before them: `db.sun`, `db.labs`,
> `db.experiments`, `db.context`, plus `profile.context` (consent) and `profile.sun` (skin type,
> usual exposure, waking time). `SCHEMA_VERSION = 3`. All four are in `buildFullBackup` and in the
> JSON export; the *consent* rides inside `profile` deliberately — unlike the AI opt-in, it
> describes what the journal may contain rather than what a device may send.
>
> **New screens** (`sun`, `experiments`, `labs`), reached from three new doors on History and from
> two new Quick Add tiles (`sun`, `lab`). New components: `SunScreen`, `SolarArc`,
> `ExperimentsScreen`, `LabsScreen`, `EvidenceMeter`, `DayContext` (`SkyGlyph`, `ContextWash`,
> `ContextStrip`, `TempTrace`, `washScale`).
>
> **`lit` — the cross-feature glue.** App-level state `{ dates: Set<string>, label: string }`, set
> by `illuminate(dates, label)` from a context observation, an experiment half, "light these days
> up", a lab period or a flare. History reorders to show exactly those days and shows a
> `.fhj-lit-bar` naming what lit them; `TempTrace` and the sun history mark them. It lives in App
> rather than in a screen precisely so it survives navigation.
>
> **Gotcha, and the one that nearly repeated 1.0's crash.** The shared derivations
> (`allVariables`, `experimentResults`, `experimentSuggestions`, `experimentStarters`) sit *below*
> the lock-flow early returns in `App()`. They were first written with `useMemo` — a conditional
> hook, which is the exact shape of the React #310 crash documented in addendum 7. They are now
> plain expressions gated on `screen`, so Today computes only pinned experiments and every other
> screen computes none. **Do not add a hook below those early returns.**
>
> **Two other gotchas.** (1) The daily-context effect is the only unprompted network call in the
> app; it is guarded on consent, on `contextBusy`, on once-an-hour, and on `needsRefresh`, and it
> fails silently — an error banner over somebody's health data because a forecast API had a bad
> minute is the tail wagging the dog. (2) Decorative tile glyphs (☀ ◎ ⌁) are `aria-hidden`, or
> they end up inside the accessible name ("☀SunTime outside") and every query for the button
> breaks.
>
> **Appointment pack + exports.** Two new pack sections (`labs`, `sun`, both default-on, both
> explaining themselves in `omitted` when empty) and three new XLSX sheets (Measurements, Time
> outside, Weather). The sun sheet's columns are deliberately long —
> `vitamin_d_estimated_iu_low/high` and `vitamin_d_estimate_is_a_model_not_a_measurement` — because
> in a spreadsheet six months later, next to a column of laboratory values, `vitamin_d_iu` would be
> a lie by omission. `appointmentPack.ts` now imports `convertValue` from `labs.ts` so the printed
> series matches the app's.
>
> **Tests: 1,278 across 53 suites** (was 1,217/52). New: `solar` (40), `sun` (31), `context` (42),
> `labs` (36), `experiments` (41), `nextGenUi` (36, driven through the real app rather than
> mounting screens in isolation — the release's claim is that the systems talk to each other, so a
> test that mounts one alone would pass while the wiring was broken), plus 12 export-table and 12
> pack-section tests. Every new module's user-facing copy passes `causalLanguageAudit`.
>
> **Still open:** unchanged — no licence declared, `App.tsx` still `@ts-nocheck`, on-device
> screen-reader pass not done. Wearables / Apple Health passive collection deliberately deferred
> to the next expansion.


> **2026-08-23 addendum 26 — 1.23: one hand.**
> The whole release is one constraint: *nothing in this app may require the hand that
> is holding the coffee.* Two new files own it.
>
> - **`src/lib/oneHanded.ts`** — everything about the thumb layer that can be reasoned
>   about without a browser. `navGo`/`navBack`/`navParent` (the stack; `ROOT` is always
>   its floor, roots reset rather than pile up, a screen already on the stack is
>   *returned to* rather than pushed twice, depth capped at 12 by trimming from the
>   bottom); `DESTINATIONS` + `destinationsFor({viewer, exclude})`; the arc
>   (`ringCapacity` → `ringPlan` → `ringsNeeded` → `fanRadii` → `arcLayout`, wrapped by
>   `fanLayout(count, {hand, width, height})`, plus `pickArcTarget`); the gesture
>   thresholds (`edgeStart`, `edgeDirection`, `backProgress`, `shouldCompleteBack`,
>   `reachDrop`, `LONG_PRESS_MS`, `ARC_OPEN_DY`, `REACH_TRIGGER`); `readHand`/`setHand`/
>   `onHandChange` (localStorage `fhj_hand_v1`, mirrored to `<html data-hand>`);
>   `fanSeen`/`markFanSeen` (`fhj_fan_seen_v1`); and `onSystemBack`.
> - **`src/components/ThumbNav.tsx`** — `ThumbNav` (the bar, the coach mark and the fan)
>   and `EdgeBack` (the side-edge peel). It takes `Icon` as a prop rather than importing
>   it, because App.tsx imports the component and the icon set lives in App.tsx.
>
> **App.tsx changes are deliberately small.** `screen` is now `navTop(navStack)` and
> `setScreen(id)` still takes a string, so none of the ~44 call sites changed. `goBack`,
> `backTo`/`canBack`, `hand`, `reaching` and `shellRef` all live in the state block at the
> top of `App()`, above every early return. The bar, the reach-catch and `EdgeBack` are
> rendered **outside** `.fhj-shell`, and this is load-bearing: the shell is what moves
> (sideways under an edge drag, downwards under reach), and a `position: fixed` child of a
> transformed element is fixed to its moving parent rather than to the viewport — the bar
> would ride away with the page it is steering.
>
> **Five gotchas, all of them found the hard way.**
> 1. *The bar must not morph.* The first version turned the left slot into Back on inner
>    screens. It read well and was wrong in the hand: the value of the bar to a thumb is
>    that the thumb stops needing to look. The three are fixed; Back is a fourth thing
>    above them. Several existing tests click `nav > History` from inner screens and were
>    the first to catch it.
> 2. *The + and the fan's pivot must be the same point.* They were a hundred pixels apart
>    (+ centred, fan pivoting on the corner), so press-and-slide steered relative to a
>    place the thumb was not. The + now sits at the end of the bar on the held side and
>    the fan measures that button's `getBoundingClientRect()` at open time. Do not
>    reintroduce a pivot position in CSS.
> 3. *A click follows a pointerup.* Holding the + to navigate would also fire the button's
>    `onClick` and open the add sheet behind the new screen. The guard is a ref
>    (`handled`), not state — React may already have re-rendered by the time the click
>    dispatches.
> 4. *Icons inside a labelled button.* The Back pill renders an arrow plus the word
>    "History"; without `aria-label` its accessible name is "History" and every
>    `getByRole("button", {name: "History"})` in the suite matches two elements. Same
>    family as addendum 11's decorative-glyph gotcha.
> 5. *`setPointerCapture` throws.* Safari refuses for a pointer it has already released,
>    and throws rather than returning false. Wrapped: a fan that opens is worth more than
>    a fan that steers.
>
> **The arc is computed, never chosen.** A fixed "five per ring" is right for exactly one
> phone. `ringCapacity` asks each ring how many items its own arc length holds at
> `itemSizeFor(width)` px each, `ringsNeeded` takes the fewest rings that fit, and
> `ringPlan` shares the items out in proportion to capacity (largest remainder), so the
> spacing matches across rings instead of packing the inner one and stranding two outside.
> `fanRadii`'s outer bound is `width − 104` — the width of a whole item, label included,
> not the disc — or the outermost label runs off a small phone. **`itemSizeFor` and the
> `@media (max-width: 359px)` block in index.css must agree**, or the geometry reserves
> space the stylesheet does not use.
>
> **Which hand is a device fact, not a journal one**, so it sits in localStorage beside the
> theme rather than in `profile.prefs`: it has to work in the read-only viewer and before
> a profile exists. It is exposed in `AppearancePanel` (both copies — first run and
> Settings) and inside the fan.
>
> **New CSS lives in one block** in `src/styles/index.css`, immediately before the print
> section: `.fhj-thumbnav*`, `.fhj-thumb-*`, `.fhj-fan-*`, `.fhj-edgeback*`,
> `.fhj-reach-catch`, and `.fhj-shell.is-reaching`. The old `.fhj-nav-add` is gone with the
> old bar. `--fhj-reach` is written onto `:root` by an effect in App.tsx so the stylesheet
> and the gesture cannot disagree about the distance.
>
> **Verified in a real browser at 390×844**, in both themes — which is where the pivot
> mismatch, the coach mark coming apart into three flex items, the mid-word label breaks
> and the near-white-on-near-white light-theme fan all showed up, and none of which a
> jsdom test would have caught.
>
> **Tests: 1,341 across 55 suites** (was 1,288/53). New: `tests/oneHanded.test.ts` (36 —
> the stack, the geometry, the thresholds, the storage) and `tests/oneHandedUi.test.tsx`
> (17 — driven through the real app: the bar's shape, back-to-where-you-came-from, the
> phone's back button, the fan's contents and keyboard route, handedness, reach, and that
> a plain tap on the + still opens the add sheet). Four existing suites were updated where
> they asserted the old bar order or the old fixed "Back to dashboard" label.
>
> **Still open:** unchanged — no licence declared, `App.tsx` still `@ts-nocheck`, on-device
> screen-reader pass not done. The fan has a keyboard route (`ArrowUp` on the +) and takes
> focus, but the press-and-slide selection is a pointer gesture with no keyboard analogue
> beyond tabbing the open fan.

> **2026-08-27 addendum 29 — 1.26.1: the "Again" row's real bug was its contents,
> not its CSS.**
> Addendum 28 fixed a genuine class collision that was deforming this row, and the row still
> read as broken afterwards, because the collision was the second problem. The first:
> `repeatSuggestions` ranks by frequency, the highest-frequency items anybody has are daily
> routine doses, and `RoutineCard` renders on Today for every active routine item — so the
> two visible slots of a horizontal scroller were always a worse copy of the checklist a
> couple of inches below (which has a progress count, an All button and an Adjust control),
> while the weight/sleep/photo/note that had no other home on Today sat off the edge behind
> a fade.
>
> - **`src/lib/quickActions.ts`.** `RepeatKind` loses `"routine"`; `RepeatSource` loses
>   `routineItems`; the routine loop is deleted. Enforced in the ranking rather than by the
>   caller because there is no configuration where it is not true — `RoutineCard` always
>   renders when a routine exists, and an item with no logs never reaches the ranking.
>   `tests/quickActions.test.ts` now passes `routineItems` anyway (cast) and asserts nothing
>   routine-shaped comes back, so the rule survives a caller that has not read the change.
> - **App.tsx.** `QuickRepeats` is a `.fhj-again-list` of `.fhj-again-row`s in one divided
>   card, not a `Rail`; `max` 8 → 5 (the eight only fitted because six were off-screen);
>   `runRepeat` loses its routine branch; `REPEAT_CAT` loses its routine tint.
> - **CSS.** `.fhj-again` (fixed-width horizontal card) → `.fhj-again-row` (full-width row).
>   The row idiom is deliberately a third thing: Quick Add above is a grid of large tiles
>   that *open* pickers, the Routine below is separate row-cards with checkboxes, this is one
>   card of divided rows where the tap writes immediately.
>
> **`src/components/Rail.tsx` now has no consumer, and is kept on purpose** — documented in a
> note at the top of the file. It was extracted *from* `MetricPicker`, which still carries
> its own worse `.fhj-picker-scroll` duplicate; deleting the good implementation and leaving
> the duplicate would be backwards. Migrating MetricPicker onto it is the open task. Unlike
> the dead `.fhj-rail` wizard block removed in 1.26.0, its styles are scoped to classes only
> it emits, and `tests/rail.test.tsx` still asserts nothing else claims `.fhj-rail`.
>
> **Two stale selectors caught by the suite**, both worth noting as the shape of this kind of
> change: `tests/foodBowelUi.test.tsx` scoped an assertion to `.fhj-scroller` to prove a
> newly-saved food reaches the Again row, and the Again cases in `tests/rail.test.tsx`
> asserted rail markup. Both now target `.fhj-again-list`.
>
> **2026-08-26 addendum 28 — 1.26: today's check-in has a name, a state, and a place in
> History; and the "Again" row stops being dressed by a dead screen.**
> Three changes, one of which is a bug that had been deforming the busiest row on the first
> screen for a long time without anybody being able to see why from the markup.
>
> - **`src/lib/checkin.ts` (new, fully typed, pure).** One answer to "of what today asked
>   for, how much is in", read by both screens so they cannot disagree.
>   `checkinStatus(src)` → `{ parts, done, total, left, ratio, pct, untouched, complete,
>   extras }`; `checkinLine` / `checkinVerb` (the words); `checkinPips` + `PIP_LIMIT` (the
>   marks). **The policy is the module's reason to exist:** only *counted* parts are in the
>   fraction — the askable questions (via `isAskable` from `lib/pulse`) and the routine rows
>   scheduled for today (a skip counts, same rule as `routineProgress`). A photo, a note and
>   a meal are `counted: false` and shown beside the ring, because there is no honest daily
>   denominator for any of them and a progress ring in a medical journal may not invent one.
>   Two edge cases have tests: a primary key that is not itself askable adds one question
>   *only if that field exists in the setup* (otherwise an empty journal reads a permanent
>   "0 of 1"), and `complete` is never true when `total === 0`.
> - **App.tsx.** New shared pieces beside the pulse: `CheckinRing` (SVG arc + count, arc
>   suppressed below half a pixel so a round line-cap cannot draw a dot that reads as 1),
>   `CheckinPips`, `CheckinParts`, `TodayCheckinCard` (replaces the `fhj-pulse-more` link)
>   and `HistoryTodayCard`. `HistoryScreen` now takes `routineItems`, computes the same
>   status, renders today at the top, and **filters today out of `recent`** so the day is
>   not on one screen twice with two different amounts on it.
> - **Naming.** "Add more detail" → **Today's check-in** everywhere. Three test files named
>   the old string; `foodBowelUi`'s "Today's Logs is a way in" case now matches the section
>   heading exactly (`/^(Open|Start) today's check-in$/i`) because Today legitimately has two
>   doors into the check-in now.
>
> **The `.fhj-rail` collision (the actual "Again" bug).** A wizard header from an older first
> run owned `.fhj-rail` — `display:flex`, `overflow-x:auto`, a mask, and crucially
> `.fhj-rail button { border-radius: pill; background: transparent; padding: 5px 7px }` —
> and it outlived its markup. `src/components/Rail.tsx`, the app's one horizontal scroller,
> claims the same class, and the dead block sat *later in the stylesheet*, so it won. Every
> card in every rail was being given a wizard step's clothes, which is what made the Again
> row look like lozenges with the names falling out, and what stripped the scroll arrows of
> the card background separating them from the content underneath. Nothing rendered
> `.fhj-rail-dot`, `.fhj-rail-label`, or a rail button with a `data-state`, so the block was
> deleted rather than renamed. `tests/rail.test.tsx` now reads `index.css` and asserts both
> that nothing matches `.fhj-rail button` and that `.fhj-rail {` is declared exactly once —
> the only kind of guard that catches a class-name collision, since jsdom has no cascade.
>
> **`.fhj-repeat*` → `.fhj-again*`.** Rebuilt on top of the fix: fixed `width` (not
> shrink-to-fit, so the row is a row), `min-width: 0` on the text column (which is the
> property that actually produces an ellipsis rather than an overflow), and the icon moved
> out of the sentence into a `--fhj-mark`-tinted medallion. The dead `RepeatRow` — an older
> food-only "Again" that nothing rendered and that was the only other consumer of
> `.fhj-repeat` — went with it. The rail's edge fade widened 1.75rem → 3rem and its arrows
> shrank to 1.875rem so an arrow always lands on faded content.
>
> **Pips are a CSS grid, not a wrapping flex row.** `flex: 1 1 0` gave a full first row of
> 5px hairlines and a short second row of 18px lozenges — the same mark at two sizes, which
> stops the row being countable. `repeat(auto-fit, minmax(0.5rem, 1fr))` keeps every mark
> the same width when the row wraps and still lets a short setup spread across the card.
> `PIP_LIMIT` is 36, not 18, because the shipped packs run to ~31 questions-plus-doses and
> at 18 almost nobody would ever have seen the marks at all.
>
> **2026-08-23 addendum 27 — 1.24: rituals, and the staggered weekly tune-up.**
> The routine (`src/lib/routine.ts`) models *things*. This adds the second shape it could
> never carry: a **process**. A `Ritual` is an ordered list of `RitualStep`s; a `RitualRun`
> is one day's attempt; a `RitualReview` is one answered (or dismissed) weekly tune-up —
> and that last collection is also the scheduler's only memory, which is what makes
> "answered" and "won't be asked again this week" the same fact rather than two that drift.
>
> - **`src/lib/rituals.ts` (new, fully typed, pure).** Catalogues (`RITUAL_STARTERS`,
>   `FEELINGS`, `FRICTIONS`, weekday names); constructors (`newRitual`/`newStep`/`newRun`/
>   `newReview`, `ritualFromStarter`); run arithmetic (`toggleStep`, `completeRun`,
>   `clearRun`, `skipRun`, `runProgress`, `runComplete`); reading (`dayBoard`,
>   `boardProgress`, `ritualStreak`, `bestStreak`, `weekDots`, `ritualReport`); **the
>   scheduler** (`pickReviewDay`, `nextReviewDate`, `dueReviews`, `dueReview`,
>   `spreadReviewDays`); the payout (`suggestTweaks`, `applyTweak`, `tweakReceipt`,
>   `tuneUpCards`, `weekLine`, `celebrationFor`); `RITUAL_METRICS`; three sanitisers.
> - **`src/components/Rituals.tsx` (new, typed).** `RitualsCard` (Today), `RitualPlayer`,
>   `RitualTuneUp`, `RitualsScreen` (+ `StarterPicker`, `RitualEditor`), `WeekStrip`. It
>   inlines its own handful of SVG glyphs rather than importing the icon set, for the same
>   reason `ThumbNav` takes `Icon` as a prop: the set lives in App.tsx and App.tsx imports
>   this file.
>
> **The scheduler is the feature.** The failure it is built around: four rituals set up on
> one Sunday afternoon produce four dialogs the next Sunday, and the feature is off by the
> third week. Five rules, all tested: each ritual gets its own weekday (`pickReviewDay`
> picks the least-used day and, among ties, the one with the widest circular gap to any day
> already taken — seven rituals fill seven days before any day repeats); one a week per
> ritual, which *waits* rather than being lost if the app isn't opened; never two within
> `REVIEW_GAP_DAYS` (2) of each other, enforced against the newest review date across *all*
> rituals; nothing before `REVIEW_MIN_AGE` (7) days and `REVIEW_MIN_RUNS` (3) days of
> history; and a snooze costs `SNOOZE_DAYS` (2), not a week. `dueReview` also only runs when
> `screen === "dashboard"`, not in the viewer, and not while the player is open.
>
> **Rule 1 (a run is a record) is enforced in `runProgress`, not in a comment.** Both `done`
> and `total` come off the run — `done = min(run.done.length, run.total)` — so no edit to a
> ritual can recount a past day. `total` is re-read from the plan on every *write*
> (`toggleStep`, `completeRun`), which is how today catches up with an edit made this
> morning while yesterday is never touched. An earlier version filtered `run.done` against
> the ritual's current required-step set; that made the tune-up's own "make this step
> optional" tweak silently un-complete a fortnight, which is the exact bug the rule exists
> to prevent.
>
> **Wiring in App.tsx:** three db slices (`rituals`, `ritualRuns`, `ritualReviews`), all
> sanitised in `migrateDb` with `spreadReviewDays` on top (it only moves rituals that
> actually clash, so an existing spread is never reshuffled); writers `saveRitual`
> (assigns `reviewDay` on **insert only** — every creation path goes through it, so it is
> the one place that can promise the stagger), `deleteRitual`, `saveRitualRun`,
> `completeRitual`/`clearRitual`, `logRitualStep`, `answerTuneUp`, `snoozeTuneUp`; two
> pieces of shell state (`playingRitual` by id, `tuneDismissed`); the player and the
> tune-up mounted **outside** the shell alongside `ThumbNav`, for the transformed-parent
> reason addendum 26 gives.
>
> **Gotchas.**
> 1. `.fhj-section` is a *horizontal flex header row*, not a container. Wrapping the card's
>    rows in it laid the whole list out sideways off the right edge. The heading is
>    `.fhj-section`; the list is its sibling. `RoutineCard` was already built this way.
> 2. Giving the demo journal rituals with no reviews put a tune-up dialog over the
>    dashboard on mount and broke **41 existing tests** that assert on the demo app. The
>    sample data now ships two reviews, dated `t0-2` and `t0-4`, which also puts two
>    different next-tune-up dates on the manage screen — the stagger, visible.
> 3. `tests/ritualsUi.test.tsx` clears `ritualReviews` when it wants the dialog. Do not
>    "fix" the demo by removing them.
>
> **Also fixed (pre-existing):** `restoreBackup` dropped `sun`, `labs`, `experiments` and
> `context` — `buildFullBackup` wrote them and the restore never read them back.
>
> **Exports:** `buildRitualsTable` + `buildRitualRunsTable` in `src/lib/exports.ts`
> (structural `RitualLike`/`RitualRunLike` types, so that module still imports nothing but
> the model contract). Two XLSX sheets, "Rituals" and "Ritual days".
>
> **Metrics:** `MetricCtx` in `tracking.ts` grew `rituals`/`ritualRuns` behind a **type-only**
> import of `./rituals` (erased at build, so no runtime cycle — `rituals.ts` imports
> `tracking.ts` for the clock helpers). `RITUAL_METRICS` folded into `DERIVED_METRICS`.
>
> **Tests: 1,533 across 62 suites** (was 1,436/60). New: `tests/rituals.test.ts` (75) and
> `tests/ritualsUi.test.tsx` (22). Verified in a real browser at 390×844 in both themes.


_Last updated: 2026-07-07. This file is the single source of truth for resuming work on this project in a new chat._

## 1. App Purpose & Target User

**Family Bellwether** is a private, mobile-first, single-user health self-tracking web app (a Claude.ai React artifact). Despite the name, it is **not** a family/multi-profile app — one person builds one personal tracking setup by choosing question packs (and adding their own questions) that match their situation.

Target user: someone managing a specific health concern (skin condition, diet experiment, chronic symptom pattern, etc.) who wants a **daily 1–2 minute check-in**, not a medical form. Example real-world configurations (not built-in profiles, just illustrations of what one person might pick):
- **Connor**: Eczema/Skin + a few Carnivore/Diet questions
- **Rich**: Carnivore/Diet only
- **Jacob**: POTS/Dysautonomia only

The shipped sample data uses the "Connor" configuration (Eczema + a few Carnivore questions) as the one example setup.

## 2. Core Features

- Choose "question packs" (modules) and toggle individual questions on/off
- Add fully custom questions (many answer types)
- Reorder questions
- Per-question visibility control across 5 surfaces: Quick Log, Detailed Log, Dashboard, Charts, Export
- **Frictionless Quick Log**: 4 questions per screen (batched), big tap targets, auto-advance scroll, Back/Skip/Continue, review screen before saving
- Detailed Log: longer, scrollable, all enabled questions
- Dashboard: today's key metric, streak, 7/30-day averages, week-vs-week comparison cards, 30-day trend chart, weekly bar chart, cautious "possible pattern" insights, recent entries
- Calendar heatmap (tap a day to edit past entries)
- Export: CSV, Excel (XLSX, multi-sheet), JSON backup — date range filters (7/30/all/custom)
- Local autosave (no login, no server)
- First-run medical disclaimer modal

## 3. Current Screens

| Screen | Route/state | Notes |
|---|---|---|
| **Dashboard** | `screen === "dashboard"` (default/landing) | Wraps `TrendsScreen`; header has gear (Settings) + sliders (Edit Setup) icons |
| **Log** | `screen === "log"` | Quick (batched guided flow) or Detailed (scrollable) tab; any past date editable |
| **Calendar** | `screen === "calendar"` | Heat-dot month grid, tap day → Log |
| **Export** | `screen === "export"` | Single setup, date range, CSV/XLSX/JSON |
| **Settings** | `screen === "settings"` | Disclaimer, link to Edit Setup, Restore example data, Erase all data |
| **Edit Setup** | `screen === "setup"` | Full screen: toggle packs, reorder/enable/disable/delete questions, per-question visibility pills, add custom questions |

Bottom nav (always visible): Dashboard · Log · Calendar · Export. Settings/Edit Setup are reached via header icons, not the nav bar.

## 4. Data Tracked

Built-in question packs (modules), each with its own field set:
- **Eczema / Skin**: overall severity, itch, dryness, redness, per-area severity (neck/scalp/hands), sleep quality, stress, sweat level, moisturized/treatment toggles, possible triggers, notes
- **Carnivore / Diet**: adherence, foods eaten, non-carnivore foods flag, weight, energy, mood, cravings, hunger, digestion comfort, bloating/gas/nausea, bowel movement, sleep, water intake, salt/electrolytes, activity, off-plan tags
- **POTS / Dysautonomia**: overall symptom severity, dizziness, palpitations, fatigue, brain fog, nausea, heat intolerance, standing tolerance, water intake, salt/electrolytes, resting/standing HR, flare day, time upright
- **Coming soon (not built)**: IBS/Digestion, Migraine, Allergy/MCAS, Fatigue/Long COVID, Autoimmune, Thyroid/Metabolic, Joint Pain, General Wellness

Custom question types a user can add: 1–10 rating (default/recommended), yes/no, multiple choice, multi-select, number, text note, time, date, body area (preset chips), photo log (yes/no presence only — no actual image upload).

Every field carries: `k` (key), `label`, `type`, `dir` (sym/pos — which direction is "worse"), `quick` (default visibility flag), `sec` (section/pack label).

## 5. Privacy & Safety

- **No login, no server** — all data stored locally via the artifact's `window.storage` API (in-memory fallback if unavailable).
- **Disclaimer** (shown on first run, also in Settings/Export):
  > "This app is a personal tracking tool and is not medical advice. It does not diagnose, treat, cure, or prevent any condition. For medical concerns, symptoms, medication changes, restrictive diets, fainting, allergic reactions, abnormal labs, or major health changes, consult a qualified healthcare professional."
- **Insights language is strictly non-causal** — always "possible pattern," never "caused by." Pattern note shown alongside insights: "Possible pattern in your own logs — not proof of cause…"
- `computeInsights()` requires ≥6 paired days, group size ≥3, and a difference ≥0.8 before surfacing a "possible pattern" card (median-split over last 30 days).

## 6. Tech Stack

- Single-file React artifact for Claude.ai (`family-bellwether.jsx`)
- React hooks only (`useState`, `useEffect`, `useRef`, `useMemo`) — no Redux/routing library; `screen` state string drives navigation
- **recharts** for line/bar charts
- **SheetJS (xlsx)** for Excel export (`import * as XLSX from "xlsx"`)
- Tailwind utility classes + inline style objects for design tokens
- Fraunces (display serif) via Google Fonts `@import`, system-ui for body text
- Persistence: `window.storage` key `"fhj_v1"`, debounced save (500ms), in-memory fallback (`mem{}`) if `window.storage` is unavailable
- No backend, no auth, no external API calls other than the font import

## 7. File Structure

Everything lives in **one file**:
```
/mnt/user-data/outputs/family-bellwether.jsx   ← the entire app (~1,940 lines)
```

Rough internal organization (top to bottom):
1. Date/format/RNG helpers, `colorFor()`
2. `orderFields()`, `getProfileTemplate()` — merges enabled modules + custom questions into one "virtual template" (dedupes same-key fields, applies per-question overrides, reorder, computes `chartMetrics` vs `dashboardMetrics` separately)
3. `blankProfile()`, `genSampleData()` — single example profile + ~34 days of generated history
4. `entriesFor()`, `entryOn()`, `calcStreak()`, `avgWindow()`, `trendFor()`, `seriesFor()`, `weeklyAverages()`, `computeInsights()`
5. Small UI primitives: `Icon`, `Card`, `SectionTitle`
6. Field input components: `ScaleInput`, `ToggleInput`, `ChipsInput`, `NumberInput`, `TextField`, `DateTimeInput`, `FieldInput` (dispatcher)
7. `QuickField`, `GuidedQuickLog` — the batched Quick Log flow
8. `LogScreen` — Quick/Detailed tab container
9. `TrendArrow`, `MetricChart`, `WeeklyBars`, `TrendsScreen` (= Dashboard content)
10. `CalendarScreen`
11. Export helpers: `serialize`, `csvEscape`, `toCSV`, `download`, `metaCols`, `wideTable`, `ExportScreen`
12. `SettingsScreen`, `DisclaimerModal`
13. `buildCustomField`, `AddCustomQuestion`, `EditSetupScreen`
14. `DashboardScreen` (header wrapper around `TrendsScreen`)
15. `NAV`, `export default function App()` — app shell, screen routing, persistence wiring

## 8. Important Design Decisions Already Made

- **Single user, single setup** — no profile switching, no "all profiles" export. This was a deliberate correction from an earlier multi-profile design; do not reintroduce profile switching.
- **`getProfileTemplate(profile)`** is the one function everything reads from (Dashboard, Log, Calendar, Export, Insights) — it merges enabled modules + custom questions, dedupes by field key (first module wins, so e.g. "sleep quality" is asked once even if two packs define it), applies per-question overrides, and applies custom reorder.
- **Five independent visibility flags per question**: `quick`, `detailed`, `dashboard`, `chart`, `exportable` (all default `true` except `quick`, which is set explicitly per field). Stored as overrides in `profile.fieldOverrides[key]`.
- **Quick Log is batched (4 questions/screen)**, not one-question-at-a-time — this was a deliberate revision from an earlier single-card-per-question version, per explicit user direction.
- **"Skip" vs "Continue"** in Quick Log are functionally different: Skip clears any answers given on that screen before advancing; Continue keeps them.
- Reorder is manual up/down arrows (not drag-and-drop) — kept intentionally simple.
- Photo question type only logs yes/no presence, not an actual image file (documented limitation, accepted).
- Body-area and multi/single-choice custom question types are implemented as `type: "chips"` under the hood (with different `single`/`options`), not as separate renderers — keeps the component surface small.
- Time/date custom types are the only two new dedicated input renderers added beyond the original five/six field types.
- Export only includes columns where `exportable !== false`.

## 9. Current Bugs / Unfinished Work

- **Just fixed, unverified in-app**: `actionsRef` (used to auto-scroll to the Back/Skip/Continue bar once a batch is fully answered) was declared but never attached to the JSX — this was just patched (`ref={actionsRef}` added to the action-bar `div`). **Needs a manual test pass** to confirm the auto-scroll behavior (scroll to next unanswered card, or to the button bar once the batch is complete; snap-to-top on batch change) actually feels good on a real phone.
- No JSON **import**/restore — export only, can't load a JSON backup back in.
- No per-profile rename safeguards — editing the setup's name has no validation beyond trim.
- Reorder state (`profile.fieldOrder`) only captures keys once the user has pressed an up/down arrow at least once; freshly-added packs/questions rely on "natural order" fallback, which is correct but untested with complex multi-pack reordering.
- The 8 "coming soon" packs (IBS, Migraine, Allergy/MCAS, Fatigue/Long COVID, Autoimmune, Thyroid/Metabolic, Joint Pain, General Wellness) are listed in the UI but have **no field definitions** — selecting them isn't possible yet, they're just a text list.
- No automated tests — verification so far has been `esbuild` syntax checks only, not runtime/browser testing.

## 10. Next 5 Recommended Development Tasks

1. **Manually test the auto-scroll fix** in Quick Log on an actual mobile viewport — confirm scroll-to-next-card and scroll-to-action-bar timing feels natural, not jumpy.
2. **Build out one more question pack** (General Wellness is the most broadly useful) so "coming soon" isn't just a label.
3. **Add JSON import/restore** so a downloaded backup can be re-loaded into the app.
4. **Add basic validation/guardrails in Edit Setup** — e.g. prevent saving a setup with zero enabled questions, warn before disabling a pack that has logged history.
5. **Polish empty/edge states** — e.g. Dashboard when zero questions are marked `dashboard: true`, Quick Log when all questions in the last batch are skipped, Calendar with zero entries.

## 11. User Preferences & Constraints (stated during this project)

- Wants **concise, implementation-focused collaboration** — minimal over-explanation, no restating prior context after interruptions, no long reasoning shown.
- Prefers **targeted patches** over rewrites — edit only the relevant function/section, don't regenerate the whole file.
- Wants a **short plan + confirmation before large architectural changes** (though will sometimes give a fully detailed spec upfront that itself counts as the confirmed plan).
- Strong emphasis on **mobile-first, low-friction daily logging** — this is the single most repeated priority across the project ("as easy as tapping a couple buttons," batched screens over long forms, auto-advance/auto-scroll).
- Non-medical, cautious language is non-negotiable: "possible pattern," never "caused by."
- Prefers big tap targets, sticky/accessible action bars, minimal typing.
- Wants the file returned as a downloadable artifact after each round of changes, with a short summary + known limitations — not a wall of explanation.

---

## Instructions for Starting a New Chat

1. Start a new Claude.ai chat (or continue in this Project if using Claude Projects).
2. Save this file as `APP_STATE.md` in **Project knowledge** (or paste it as the first message if not using Projects).
3. Also re-upload the current working file: **`family-bellwether.jsx`** — this document describes it but is not a substitute for the actual code.
4. In your first message to the new chat, say something like:
   > "This is the Family Bellwether project. See APP_STATE.md for full context. Here's the current file. [describe the next task]"
5. Point Claude to section 9 (bugs) and section 10 (recommended tasks) if you want it to pick up where this session left off without re-explaining.
