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
