# Bellwether - P3-P8 Product Plan

## 0. Sequencing

Recommended order:

**P2.5 -> P3 -> P4 -> P5 -> P6 -> P7 -> P8**

P2.5, Data Durability, should ship before P4-P6. Photo-heavy reports should not be built on top of photos that do not survive backup and restore. P2.5 should include storage meter, free-up-space tools, full photo backup, JSON restore, and XLSX photo legend.

Nothing below reopens already shipped features.

---

## 1. Daily Survey UX Upgrades - P3

Current Quick Log is already batched at about 4 questions per screen. These are upgrades, not a rebuild.

### Smart Defaults

- Pre-fill each scale with the user's 7-day median as a ghost value.
- Example: "Tap to confirm 3 - same as usual."
- One tap confirms the default.
- Any other tap overrides it.
- Toggles default to yesterday's answer with a subtle "yesterday" tag.
- Goal: reduce a typical log to around 8 taps.

### Auto-Advance

- Answering the last unanswered question in a batch scrolls to the action bar.
- Pulse the Continue button when the batch is ready.
- Single-question batches auto-advance after about 400ms.

### Progress

- Add a thin segmented progress bar at the top.
- Use 1 segment per batch.
- Show a time estimate such as "~40 seconds left."
- Reuse the onboarding time-estimate logic.

### Typing Reduction

- Collapse notes behind a "+ note" chip.
- Add recent-note suggestions as tappable chips.
- Use the last 5 distinct short notes.

### Finish Moment

- Add confetti-lite using CSS particles, no library.
- Add streak count-up animation.
- Show one rotating encouraging line, such as "Day 12 - steady."
- Add haptic feedback and a subtle sound tick.
- Avoid a modal; make it the review screen's success state.

---

## 2. Haptics and Sound - P3

### Haptics

Use `navigator.vibrate()` with feature detection.

Suggested patterns:

- Tap: `10ms`
- Select: `15ms`
- Batch complete: `10-30-10`
- Save success: `20-40`
- Milestone: `30-50-30`

Important note: iOS Safari does not support vibration. Feature-detect support, hide the haptics toggle when unsupported, and lean on sound and animation there.

### Sound

Use the Web Audio API with fully synthesized sounds.

Constraints:

- No audio assets
- No network calls
- Preserve the single-file constraint
- Keep sounds subtle and premium

Suggested sounds:

- Tap tick
- Select pop
- Save chime, two-note
- Milestone flourish, three-note

Sound design:

- 150ms or shorter
- Around -18dB gain
- Debounced
- Sound off by default
- User must opt in

### Settings

Add:

```ts
profile.prefs = {
  sound: false,
  haptics: true,
}
```

Settings should include:

- Sound on/off
- Haptics on/off when supported
- Reduced motion support

### Implementation

- Create a single `feedback(type)` helper.
- Call it from input components.
- Lazily create the `AudioContext` on the first user gesture, as required by browsers.

---

## 3. UI Polish - P3

### Card System

Create one consistent card system with variants:

- Default
- Stat
- Action

Suggested style:

- 16px radius
- Unified shadow token
- Consistent padding and spacing

### Button Hierarchy

Use a clear button hierarchy:

- Primary: filled
- Secondary: tonal
- Tertiary: text

Audit all screens to remove one-off button styles.

### Empty States

Add friendly empty states with an illustration glyph and one-line action for:

- Dashboard when no dashboard metrics exist
- Calendar when no entries exist
- Gallery when no photos exist
- Charts when fewer than 3 data points exist

### Transitions

- Add 150-200ms opacity/translate transitions on screen changes.
- Use one shared screen wrapper.
- Avoid layout-shifting animations.

### Microcopy

- Every destructive or confusing action should have one plain-language explanation.
- Keep language friendly and non-medical.

### Navigation

- Keep the current 4 navigation items.
- Do not add new navigation screens in P3.

---

## 4. Roadmap Phases

---

## P3 - UX Polish, Haptics, and Sound

### Goal

Make logging feel effortless and rewarding. Make the app feel premium.

### User Value

A daily log that can be completed in under 60 seconds, with satisfying feedback that encourages repeat use without feeling gimmicky.

### Features

- Smart defaults
- Auto-advance improvements
- Segmented progress bar
- Time-left estimate
- Collapsed notes
- Recent-note chips
- Finish celebration
- Haptics
- Optional premium sounds
- Consistent card system
- Button hierarchy cleanup
- Empty states
- Screen transitions
- Microcopy pass

### Data Model Changes

```ts
profile.prefs = {
  sound: boolean,
  haptics: boolean,
}
```

Entry data stays unchanged. Ghost-default logic is computed, not stored.

### UI Components Needed

- `feedback()` helper
- `ProgressBar`
- `FinishCelebration`
- `EmptyState`
- `NoteChips`

### Risks and Edge Cases

- Vibration is unsupported on iOS Safari.
- Confetti can be janky on low-end phones.
- Smart defaults could nudge users to log inaccurately.

### Mitigations

- Feature-detect haptics.
- Cap confetti at 20 particles.
- Respect `prefers-reduced-motion`.
- Require an explicit tap to confirm ghost defaults.
- Never auto-save ghost defaults.

### Acceptance Criteria

- Median log time is 60 seconds or less with defaults.
- Sound is off by default.
- Haptics and sounds are disableable.
- Reduced motion is honored.
- Build passes.
- Pure-function tests pass for default computation and streak count-up math.

---

## P4 - Weekly and Monthly Report System

### Goal

Generate a scrollable "Your week" or "Your month" story from existing entry data.

### User Value

This becomes the payoff for logging. It makes trends and patterns visible without spreadsheets.

### Features

- Dashboard report entry point, such as "Your week is ready."
- Show report card only when there are at least 4 logged days in the period.
- Vertical scroll of story cards.

Report cards may include:

- Period header
- Streak
- Best day
- Worst day
- Most-improved metric
- Most-common symptom level
- Weekly or monthly averages vs prior period
- Trend sparkline per chart-enabled metric
- Notes highlights
- Routines, such as top toggles or chips by frequency
- Possible-pattern cards reusing `computeInsights()`
- Photo teaser card linking to Gallery until P6

### Cautious Language

Every comparative card should include a footer like:

> From your own logs - not proof of cause.

Rules:

- No causal claims
- No diagnosis
- No medical advice
- Centralize copy strings in one `REPORT_COPY` object for auditability

### Personalization

The report card catalog should come from `getProfileTemplate()`.

Only render cards when:

- Required fields exist
- Minimum data threshold is met

Examples:

- POTS setup: standing tolerance and HR cards
- Skin setup: itch, severity, and photo cards
- Diet setup: adherence and weight cards
- Custom questions with `chart: true`: generic trend cards

### Implementation

Use a pure report builder:

```ts
buildReport(db, range) => ReportModel[]
```

Then render card descriptors through a component map:

```ts
card.type => ReportCardComponent
```

This keeps report logic unit-testable in Node.

### Data Model Changes

None in P4. Reports are computed on demand.

### UI Components Needed

- `ReportScreen`
- `ReportCard` variants
- `Sparkline`, reusing Recharts if already present
- `DeltaBadge`

### Risks and Edge Cases

- Sparse data can create weak reports.
- Calendar weeks vs rolling windows can confuse users.
- 30-day aggregate performance.

### Mitigations

- Use min-data gates per card.
- Gate the entire report at 4 logged days.
- Use calendar week Monday-Sunday and calendar month.
- State the range clearly on the header card.
- Memoize report building.

### Acceptance Criteria

- Report renders with 4 or more logged days.
- Cards hide individually below their data floor.
- String audit confirms no causal language.
- Works with any question pack combination, including custom-only.

---

## P5 - Swipe-Based Report Customization

### Goal

Add a first-run and re-runnable report card picker.

Swipe right means include. Swipe left means skip.

### User Value

The report feels personal and avoids irrelevant cards.

### Features

- Trigger before first report generation.
- Show deck of available card types from the personalized report catalog.
- Each card includes:
  - Title
  - One-line description
  - Mini mock visual
- Swipe gestures.
- Fallback yes/no buttons for accessibility and desktop.
- Progress dots.
- End screen: "You can change this anytime in Settings -> Report cards."
- Settings list view with toggles as the non-swipe editor.

### Implementation

- Use pointer events.
- Drag card with rotate/translate transform.
- Decision threshold: 35% of card width.
- No gesture library.
- Add haptic feedback on decision.

### Data Model Changes

```ts
profile.reportPrefs = {
  [cardKey]: boolean,
}
```

New card types introduced later should default to true and appear once in a "new card" prompt.

### UI Components Needed

- `SwipeDeck`
- `SwipeCard`
- `ReportPrefsSettings`

### Risks and Edge Cases

- Swipe conflict with vertical scroll.
- User skips every card.
- Android WebView gesture feel may vary.

### Mitigations

- Lock axis after 8px of movement intent.
- Require at least 3 included cards or warn.
- Make buttons a first-class fallback.

### Acceptance Criteria

- Deck can be completed using buttons only.
- Preferences persist.
- Preferences filter `buildReport()` output.
- Preferences are editable from Settings.
- Three-card minimum is enforced.

---

## P6 - Photo Comparison Report Cards

### Goal

Add before/after photo pairs inside weekly and monthly reports, grouped by body spot.

### User Value

This is likely the most motivating artifact for skin tracking.

### Features

For each photo field and body spot with at least 2 photos:

- Pair earliest-in-window or compared-to baseline vs latest.
- Show side-by-side card.
- Display date and linked rating under each photo.
- Horizontal swipe through spots:
  - Left hand
  - Right hand
  - Neck
  - Scalp
  - Face
  - Custom spots
- Tap opens full-screen A/B view with slider divider.

Caption template:

> Left: {date}, rated {n}. Right: {date}, rated {n}.

Rules:

- No adjectives like "better" or "worse" unless based on rating labels.
- No "improvement" claims from photos alone.
- No treatment success language.
- Delta badge shows numbers only.

### Implementation

- Reuse `PHOTO_INDEX_KEY` index and `comparedTo` metadata.
- Pair selection should be a pure function:

```ts
pickPairs(index, entries, range)
```

- Use thumbnails from existing `fhj_thumb:` blobs in cards.
- Load full-resolution images lazily on tap.

### Data Model Changes

No new model required if existing photo metadata is sufficient.

This depends on P2.5 so photos are backed up before users emotionally invest in them.

### UI Components Needed

- `PhotoCompareCard`
- `ABSlider`
- `SpotPager`

### Risks and Edge Cases

- Mismatched framing.
- Large blobs slow down old devices.
- Privacy risk when sharing reports.

### Mitigations

- Prefer existing framing-ghost baseline photos.
- Label similar framing as best-effort.
- Use thumbnails in cards.
- Load full-res on demand.
- Exclude photo cards from share images by default.

### Acceptance Criteria

- Pair selection is deterministic and unit-tested.
- Card hides when there are fewer than 2 photos per spot.
- Slider works with touch and keyboard.
- Zero causal or treatment-success language.

---

## P7 - Export, Share, and Report History

### Goal

Let users save, revisit, export, and share reports.

### User Value

Users can send progress to a partner, doctor, or family member and look back at past weeks/months.

### Features

- Save report as a snapshot.
- Report history list in Settings or Dashboard card.
- Do not add a fifth nav item.

Export options:

1. JSON snapshot inside normal backup
2. Shareable PNG summary card through canvas rendering
3. Print/PDF through `window.print()` stylesheet
4. XLSX `report_summary` sheet when exporting a range with a saved report

### Implementation

Snapshot should store the descriptor model, not rendered HTML:

```ts
ReportModel[]
```

Photos should be referenced by `photoId`, not duplicated.

If a photo is missing or freed, show a "photo missing" placeholder.

Canvas share-card should be drawn from descriptors.

### Data Model Changes

```ts
db.reports = [
  {
    id: string,
    type: 'week' | 'month',
    range: DateRange,
    createdAt: string,
    model: ReportModel[],
  }
]
```

Cap history at the last 24 reports. Prune oldest with confirm.

### UI Components Needed

- `ReportHistoryList`
- `ShareCardRenderer`
- Print stylesheet

### Risks and Edge Cases

- Storage growth.
- Stale saved models after copy changes.
- Accidental photo sharing.

### Mitigations

- Store small descriptor models only.
- Do not duplicate photos.
- Store copy version and re-render defensively.
- Photo sharing must be explicitly toggled on per share.
- Photo sharing is off by default.

### Acceptance Criteria

- Saved report reopens identically.
- Share PNG contains no photos unless toggled.
- Snapshots survive JSON backup and restore round-trip.
- Report history is capped.

---

## P8 - Production Hardening

### Goal

Make the app a trustworthy daily driver.

### Features

- Unit test suite for pure functions:
  - Report builder
  - Photo pair picker
  - Insights
  - Merge engine
  - Default computation
- Error boundary around app shell.
- Recovery screen that says the user's data is safe.
- Unified storage-failure toasts.
- Schema version bump.
- Forward migration function.
- Performance pass:
  - Memoize `getProfileTemplate()`
  - Virtualize gallery if more than 100 photos
- Accessibility pass:
  - Focus order
  - Labels
  - Contrast
  - Reduced motion
- Final copy and disclaimer audit.

### Data Model Changes

```ts
schemaVersion: number
```

### Risks and Edge Cases

- Migration bugs.
- Render errors hiding data.
- Storage failure confusion.
- Large photo galleries.

### Mitigations

- Unit-test migrations against fixture DBs from every prior phase.
- Error boundary must preserve access to backup/export where possible.
- Friendly storage-failure messages.
- Gallery virtualization for large photo sets.

### Acceptance Criteria

- All tests pass.
- App recovers from a thrown render error without data loss.
- Accessibility issues are addressed.
- No console errors on a full user journey.
- Final language audit confirms no medical advice or causal claims.

---

## Suggested Next Step

Ship **P2.5 Data Durability** first, then move to **P3 UX Polish, Haptics, and Sound**.

If this plan is approved, the next implementation prompt should ask for the exact functions, insertion points, and patch sequence for the selected phase before coding.