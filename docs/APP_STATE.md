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
