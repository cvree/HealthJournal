# Changelog

## 1.3.0

### Fixed

- **AI observations were broken for every new user.** The build hard-coded
  `gemini-2.5-flash`; Google retired that model for newly-created keys months ahead of its
  published shutdown date, so setup completed and then every analysis returned
  `404 — this model is no longer available to new users`. No model ID is hard-coded any more:
  setup asks the user's own key what it can reach and scores the results (newer over older,
  small and fast over frontier, free over paid, stable over preview). A model that disappears
  later repairs itself — the app re-resolves from the live list, retries exactly once, and
  remembers the new choice.
- **Google's newer `AQ.` API keys are handled properly.** Key-format checks are deliberately
  lenient now (a strict `AIza` prefix test would have locked out everyone issued a key after the
  format changed), masking handles both, and redaction covers `AQ.`, `sk-`, and bearer tokens as
  well as the old `AIza` shape.
- Verifying a key now lists models rather than sending a throwaway prompt, so it proves the
  endpoint is reachable, CORS allows it, the key is accepted, *and* something usable is behind
  it — the last of which is what the old check missed.

### Choose your own AI

- A provider step in the setup walkthrough: **Google Gemini** (default, free, no card),
  **OpenRouter** (free models, no card, one key for many makers), or **any OpenAI-compatible
  endpoint** — Groq, Mistral, or a model running on your own machine.
- **The ChatGPT question is answered in the picker instead of being left to fail.** OpenAI's API
  sends no CORS headers, so a browser can't call it without a server to relay through, which is
  the one thing this app refuses to have. The note says so, and points at OpenRouter as the way
  to reach OpenAI's models anyway.
- A custom endpoint that won't answer now says CORS is the likely cause rather than reporting a
  bare network failure — the difference between a five-minute fix and an afternoon.
- Every provider brings its own console instructions, key hint, and key URL, so step 3 describes
  the page the user is actually looking at.
- Settings shows which provider and model are connected, and testing reports the model in use.

50 new tests (`tests/aiProviders.test.ts`, plus provider coverage in the wizard suite); 217
total across 14 suites.

## 1.2.0

### Guided AI setup

Turning on AI observations used to mean: read a Settings card, flip a switch, leave the app to
find Google AI Studio, work out which button on that page makes a key, come back, paste, pick a
storage mode, save, navigate back to the dashboard, find the section again, press Analyse, then
confirm. Ten steps across two screens and an external site, with nothing holding your place.

It is now a four-step walkthrough launched by one button, which never leaves the screen it
started on:

- **Every step does one thing**, with a progress indicator, a sticky action bar in the same
  place each time, and Back always available.
- **Getting the key is walked through, not assumed.** The step that happens on Google's site
  opens in a new tab and spells out the four things to click there — that page is where most
  people stopped.
- **The key verifies itself the moment it's pasted.** No Test button to know about, no finding
  out it was wrong four steps later. An incomplete key is caught locally without spending a
  request; a rejected one says what Google said and offers an explicit override so a flaky
  connection or a not-yet-propagated key isn't a dead end.
- **Continue is disabled until the step is actually done**, and says why underneath.
- **Finishing setup and getting a result are the same action.** The last step shows the exact
  payload and sends it, landing on the observations — rather than telling you where to find a
  button you now have to go and press.
- **Thin journals still finish.** Under five logged days the last step completes setup, explains
  that observations need at least five, and says the Analyse button is waiting.
- **Nothing is turned on early.** The key is written only when its step completes, and the
  feature flips on only at the end.

Settings is now the management surface — test, replace, remove — rather than a second, subtly
different copy of setup. Replacing a key runs the same guided flow. Someone who already has a
key skips to the run; someone who has a key but switched the feature off gets a one-tap
re-enable instead of a rerun of the walkthrough.

15 new tests (`tests/aiWizard.test.tsx`); 182 total across 13 suites.

## 1.1.0

A visual and interaction pass over the whole app, a proper fix for the 30-day trend selector,
and an optional AI layer on Possible Patterns that you own the key to.

### Design system

- **Dark mode, and it's the default.** A deep charcoal/slate ground with soft elevated
  surfaces, hairline borders, and one restrained indigo accent. Question packs no longer each
  carry their own tint — ten hues made the interface change colour depending on which packs you
  had enabled.
- **Light mode is a real design, not an inversion**, plus a "match system" option. The choice is
  remembered on the device and applied by an inline script *before the first paint*, so a cold
  start in dark mode never flashes white.
- **Colours moved out of the components.** `src/lib/theme.ts` owns both palettes and a live
  token object; a theme switch mutates it in place and mirrors every token onto `:root` as a
  `--fhj-*` custom property. The lock, recovery, and viewer-landing screens each carried a
  private copy of the old palette and were light-mode islands the theme could never reach —
  they now read the same tokens as everything else, as does the ambient backdrop.
- **Shared primitives** (`Button`, `Segmented`, `SwitchRow`, `Badge`, `Modal`, `Card`) and a
  component layer in `src/styles/index.css`, so screens compose instead of restating padding,
  radius, and hover behaviour inline. More breathing room throughout, one type scale, one
  motion vocabulary of two durations and two curves.
- Hover, focus, active, and disabled states on everything interactive; a heavier focus ring;
  tap targets floored at 44px.

### Fixed

- **The 30-day trend selector couldn't reach most of its metrics.** It was a bare
  `overflow-x` strip with the global stylesheet hiding every scrollbar, so past the first few
  chips the rest were reachable only by a horizontal trackpad gesture with nothing on screen to
  suggest it. Now a real component: edge fades and arrows that appear only when there's more to
  see, vertical wheel translated to horizontal scroll, roving-tabindex keyboard navigation
  (←/→/Home/End), the selection always scrolled into view, and a live "n of m selected" count.
  Nothing is clipped — the strip bleeds past the card's padding so a chip is never half-hidden
  by a rounded corner.
- **Contrast failures across both themes**, found by auditing computed styles on every screen
  rather than by eye: caption and eyebrow text was being used for real body copy at 3.1:1, the
  accent fill was used as a text colour in five places, and the severity ramp put white labels
  on its pale-green step. The ramp now picks its own label colour by luminance, and
  `tests/theme.test.ts` fails the build if any token pair drops below WCAG AA.
- Visibility pills in Edit Setup looked identical on and off — the only difference was a
  hairline border, which in dark mode is no difference at all. Filled vs dashed now carries the
  state, and the pack toggles and per-question checkboxes got real tap targets.
- Chart tooltips rendered on Recharts' hard-coded white panel, punching a hole in a dark screen.
- A shadow tuned for a pale background, invisible in dark; a modal scrim that ignored the theme;
  "Delete photos — all of them" wrapping around its own byte count.
- The dashboard hero put a two-line label beside a badge, pushing the number down and leaving a
  hole; the week-over-week tiles collided their value with their trend wording.

### AI observations (optional, off by default)

- Bring your own **Google Gemini** key and Possible Patterns gains a second, clearly-labelled
  source alongside the on-device maths: symptoms recurring together, changes after certain days,
  sleep/mood relationships, timing patterns, improving and worsening trends, and drifts from
  your own baseline. Locally calculated patterns are unchanged and keep working with no key.
- **Nothing runs on its own, and nothing is sent without a preview you confirm** that states the
  day count, value count, payload size, and metric names going out — and what never goes: notes,
  photos, your name, and anything outside the window.
- Only numeric answers leave the device, with days numbered from the window start rather than
  dated. Enforced by tests, not just by intent.
- **The key is never hard-coded, never logged, and never in a backup** — it lives under its own
  storage key outside the journal object, the same arrangement as the PIN record. Add, replace,
  test, and remove it; keep it on the device or for the session only. Settings states the real
  limitation instead of implying a vault: a locally stored key is not encrypted and cannot be.
- Findings are phrased as observations, never conclusions; output that ignores that instruction
  is softened on the way in rather than rendered as-is. Metric names the app never sent are
  dropped, day ranges are clamped to the window, and strength is described in words because a
  language model's confidence is not a p-value.
- Every pattern card carries its evidence behind a "why this was suggested" disclosure, a date
  range, and a dismiss control. Loading, empty, error, no-key, and rate-limited states are all
  designed rather than defaulted.
- The Privacy card's "no network requests" claim now tracks reality: it says so when AI is off,
  and states the single on-request call when it's on.

### Tests

167 across 12 suites, up from 92 across 9. New: `ai.test.ts` (payload minimisation, key
handling, causal-language scrubbing, error mapping), `theme.test.ts` (persistence, token parity,
WCAG AA on every pair the UI uses), `metricPicker.test.tsx` (every option reachable, one tab
stop, full keyboard traversal).

## 1.0.0

The release that makes this a product someone else can actually use: it can be deployed and
reached, it explains itself, it reminds you to log, it protects your data, and the report you
print is one you'd hand to a doctor.

### Fixed

- **The first report a new user opened crashed.** `ReportScreen` declared refs and a layout
  effect *after* its `if (needsPrefs) return <SwipeDeck/>` early return, so the render that
  followed the card picker ran more hooks than the one before it (React error #310) and dropped
  straight into the error boundary. Every hook now sits above that return, with a regression
  test that finishes the picker and asserts a real report comes out.
- Printing a report produced half a blank page: the GSAP scroll-reveal left every card below the
  fold at `opacity: 0`, and printing does not scroll. Print styles now force the report visible.
- The report's tinted header card printed as white text on white paper.
- The photo-comparison pager scrolls horizontally, so on paper everything past the first body
  spot was cut off. Spots now stack down the page.

### Shipping

- **GitHub Pages deploy workflow** plus a **CI workflow** running `npm run check` on every push
  and PR. The build is base-path aware (`BASE_PATH`), so a project sub-path site works unchanged,
  and `SITE_URL` produces absolute URLs for link previews.
- Full Open Graph / Twitter metadata with a generated 1200×630 preview image, `robots.txt`, a
  `noscript` explanation, and a pre-React boot screen so a slow phone load isn't a white rectangle.

### Staying with it

- **Daily reminders.** Pick a check-in time and download a repeating `.ics`, so the phone's own
  notification system does the reminding with the app closed — the one approach that works
  without a server. Browser notifications are offered alongside, labelled with what they can and
  can't do, and suppressed on days already logged.
- **Home Screen shortcuts** ("Log today", "This week's report") via a `?screen=` deep link on a
  strict allowlist.

### Not losing your journal

- Requests **persistent storage** so browsers stop evicting the origin, and reports plainly
  whether it was granted — including the iOS Safari seven-day rule and what to do about it.
- Tracks when you last downloaded a restorable backup and surfaces a dashboard nudge once the
  journal has enough in it to be worth losing. Backup age is shown in Settings.

### Reports you can hand over

- The printed report is now its own document: a masthead naming the setup, range, entry count,
  and print date; hairline card borders instead of fills; page-break avoidance; and a footer
  carrying the pattern caveat and the full disclaimer.

### Product

- Renamed from "Family Health Journal" to **Health Journal** — it was never a multi-person app.
  Backups written under the old name still restore, forever.
- New in-app **Privacy** panel stating, checkably, what the app does and does not do — and the
  cost of that: nobody can recover your journal for you.
- Accessibility: skip link, `main` landmark, `aria-current` on the active tab, wider
  focus-visible coverage, and `prefers-contrast: more` support.
- Removed a stale 211 KB `health-journal-github-ready.zip` and folded `GITHUB_QUICKSTART.md`
  into a rewritten README.

---

## 0.9.0 and earlier

Developed as a Claude.ai artifact, then migrated to this Vite project. Highlights: twelve
question packs with custom questions and per-surface visibility; batched Quick Log with smart
defaults; dashboard trends and cautious pattern detection; calendar; in-app camera with A/B
photo comparison; weekly/monthly reports with a swipe-to-choose card deck and report history;
CSV/XLSX/JSON exports and full photo backup with restore; wearable import; PWA offline install;
optional PIN lock; read-only backup viewer; corrupted-data recovery; Capacitor iOS wrapper with
a WidgetKit starter.
