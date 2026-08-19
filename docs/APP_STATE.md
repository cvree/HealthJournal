# APP_STATE.md — Health Journal

> Renamed from "Family Health Journal" at 1.0; older sections below still use the old name.

> **2026-07-17 addendum — repo migration (supersedes stale sections below).**
> The app now lives in a GitHub-ready Vite project (`health-journal/`), not a lone artifact file. `src/App.tsx` is the same single-file app (P2.5–P7 all shipped: reports, swipe prefs, photo compare, report history, durability, Fitbit import, onboarding) plus: Lenis smooth scroll, GSAP screen transitions/finish moment, opt-in Vanta backdrop, self-hosted Fraunces (zero external requests), IndexedDB `window.storage` polyfill (`src/lib/storage.ts` — real artifact storage still wins when present), PWA manifest + service worker (installable, offline). Tests: `tests/pure.test.ts` (8 pure-function tests via `__internals`) + `tests/render.test.tsx` (jsdom full-app smoke). `npm run check` = typecheck + test + build, all green. Source of truth: the repo. Remaining: incremental typing of App.tsx, on-device accessibility pass.
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


> **2026-08-07 addendum 7 — 1.0: shipped, not just built.** The app was feature-complete but unshippable and had a crash on every new user's first report. Fixed + added:
> - **Crash fix (critical).** `ReportScreen` declared `revealRef`/`lastReveal`/`hswipe` + a `useLayoutEffect` *below* `if (needsPrefs) return <SwipeDeck/>`. Finishing the first-run card picker therefore rendered more hooks than the previous render → React #310 → error boundary. All hooks moved above that early return (both motion helpers are null-ref safe). Pinned by `tests/experience.test.tsx` → "survives the card picker handing off to the report on the very first run" (verified to fail when the bug is reintroduced).
> - **Print fixes.** GSAP ScrollTrigger left below-fold cards at `opacity:0` (printing doesn't scroll) → `.print-area, .print-area *` forced visible; tinted report header card was white-on-white → `no-print` (the new print masthead covers it); horizontal photo pager was clipped → `.fhj-photo-pager` stacks. Interaction hints marked `no-print`.
> - **Deploy.** `.github/workflows/ci.yml` (npm run check) + `pages.yml` (GitHub Pages, uses `actions/configure-pages` base path). `vite.config.ts` reads `BASE_PATH` (normalised) → `base`, PWA `start_url`/`scope`/`navigateFallback`, plus a `transformIndexHtml` plugin filling `%BASE%`/`%SITE%` in og tags (Vite doesn't rebase `<meta content>`). `SITE_URL` opts into absolute preview URLs.
> - **New typed modules + tests.** `src/lib/reminders.ts` (time validation, `nextOccurrence`, RFC 5545 `.ics` with `RRULE:FREQ=DAILY`, floating local time, folding/escaping, Notification wrappers), `src/lib/durability.ts` (`storageStatus`/`requestPersistentStorage`, `backupNudge`, `describeBackupAge`), `src/lib/deeplink.ts` (`?screen=` allowlist for PWA shortcuts). 22 new tests; 92 total across 9 suites.
> - **App wiring.** Settings gains `ReminderCard` + `PrivacyCard`; `DataDurabilityCard` gains persistence status and backup age; `markBackedUp()` stamps `profile.lastBackupAt` on full backup and JSON export; dashboard shows a backup nudge (`TrendsScreen` now takes `goSettings`/`viewer`); App effects for reminder scheduling, `requestPersistentStorage`, and deep links.
> - **Rename.** User-facing "Family Health Journal" → **Health Journal** (`APP_NAME`/`APP_VERSION` exported from App.tsx). `BACKUP_APP_IDS` accepts both strings forever; new backups write the new one. Removed the stale zip and `GITHUB_QUICKSTART.md`; README + CHANGELOG rewritten.
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


_Last updated: 2026-07-07. This file is the single source of truth for resuming work on this project in a new chat._

## 1. App Purpose & Target User

**Family Health Journal** is a private, mobile-first, single-user health self-tracking web app (a Claude.ai React artifact). Despite the name, it is **not** a family/multi-profile app — one person builds one personal tracking setup by choosing question packs (and adding their own questions) that match their situation.

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

- Single-file React artifact for Claude.ai (`family-health-journal.jsx`)
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
/mnt/user-data/outputs/family-health-journal.jsx   ← the entire app (~1,940 lines)
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
3. Also re-upload the current working file: **`family-health-journal.jsx`** — this document describes it but is not a substitute for the actual code.
4. In your first message to the new chat, say something like:
   > "This is the Family Health Journal project. See APP_STATE.md for full context. Here's the current file. [describe the next task]"
5. Point Claude to section 9 (bugs) and section 10 (recommended tasks) if you want it to pick up where this session left off without re-explaining.
