# Changelog

## 1.8.0

### The photo is the first thing the log asks for

In both the food sheet and the bowel sheet, the camera has moved to the top.
It used to sit five fields down — below three text inputs in the food sheet,
below four chip grids in the bowel one — which had the single fastest, richest
answer either form can take reading as an optional extra for people who had
already done the typing. It is the headline now, in its own frame, and
everything under it is explicitly optional.

### AI can fill the log in for you

A new switch in Settings (**"Let AI fill in the log for you"**, off until you
turn it on, and only offered once AI observations are on):

- **Attach a photo and it is read straight away.** No per-send confirmation —
  the switch is the consent, and it says so in as many words on the switch
  itself and again on the Privacy card.
- **Bowel entries: Bristol type, amount, colour and consistency** are filled
  in from the photo. Amount is new — the model was never asked for it before.
  You can skip all four and just take a picture.
- **Meals: the nutrition estimate runs by itself**, photo or description.
- **It fills blanks, never overwrites you.** Any field you have already
  answered wins; the model only completes what you left empty, and anything it
  wrote stays labelled as its work until you type over it.
- **Its words are mapped onto the form's own options.** "dark brown" becomes
  the **Dark brown** chip rather than a string matching no option — without
  that, an auto-filled colour was a category of one in every later grouping.
  Anything that can't be mapped is left blank rather than guessed at.
- **Once it has answered, the detail fields fold into one line** you can tap to
  open. Nothing is hidden, it is just no longer in the way of pressing Save.

Off, none of this changes: the analysis buttons still ask before every send,
and the app still makes no network requests at all until you opt in.

### Quick Add is yours to arrange

The four tiles on the dashboard were fixed. They are now editable from an
**Edit** link on the section heading: choose which appear, in which order, from
a catalogue of six.

- **New tiles:** **Drink** (the food picker filed as a drink instead of as
  whatever meal the clock implies) and **Food diary** (jumps to the day's
  meals and totals).
- Reorder with arrows, remove with ×, Reset to the original four. Nothing
  applies until Save.
- Choosing none is a real choice and hides the section.

### Say when you ate it, without opening the long form

The one-tap path through the food picker always stamped whatever the clock said
at the moment you tapped, and the only fix was to save the item and reopen it.
There is now a **time and meal control at the top of the picker**, applying to
whatever you tap below it. Changing the time re-files the meal to match —
unless you have picked a meal yourself, in which case yours stands. The time
carries through into the long form if the meal turns out to be something new.

### Three more backdrops

- **Dawn** — a low horizon that rises and settles, keeping the colour below the
  reading column rather than behind it.
- **Drift** — slow, far-out-of-focus motes.
- **Linen** — the weave of the paper notebook the whole product is modelled on.

Same three-layer skeleton as Fog and Aurora, same tinting from your colour
slider, same reduced-motion behaviour.

### Fixes

- **A sheet scrolls itself, not the page behind it.** Lenis owns the document
  scroller and had no idea a dialog was open, so a wheel or a flick anywhere
  over the bowel sheet — the longest form in the app — scrolled the dashboard
  underneath and left the sheet exactly where it was. Sheets now opt out of
  smooth scrolling, and the page is pinned (and put back, at the right scroll
  position) while any dialog is up, including stacked ones.
- **Today's Logs is a way in.** The whole heading row opens today's check-in
  rather than a small text link at the far end of it.
- **A `time` or `meal` passed through as `undefined`** no longer un-sets the
  default it was meant to fall back to, which could produce a log with no time
  on it at all.

## 1.7.0

### The ambient backdrops actually appear now

They were a Vanta/three.js WebGL scene, and for most people they never drew
anything at all. Three reasons, each sufficient on its own: the scene needed a
live WebGL context, so a driver blocklist, iOS Lockdown Mode or a context lost
to a tab sleep left it silently blank; it refused to start on any device
reporting fewer than 4 CPU cores or less than 4GB of RAM, which is a normal
phone rather than an exotic one; and it dragged ~613KB of three.js into the
bundle to draw what is, honestly, a few blurred gradients.

- **Rewritten in CSS.** No WebGL, no canvas, no feature detection, no
  device test — it runs on the compositor and works anywhere a gradient does.
- **`three` and `vanta` are gone from the dependency list**, taking a 613KB
  chunk with them. The font upgrade below spends ~30KB of that back.
- **Two styles, and a real "off":** **Fog** (slow overlapping fields) and
  **Aurora** (tall raking curtains). Both are tinted from your colour.
- **Reduced motion keeps the atmosphere and drops the movement**, rather than
  removing the backdrop altogether the way the old one did.

### Pick how it looks on the first launch

A new second step in setup, before it asks about anything medical: backdrop,
colour, theme, Night Light. The rest of the setup then runs wearing the choice,
so it is a preview of the app rather than a description of one. It is the same
component as the Settings panel, not a copy of it.

### A horizontal colour slider

- **Drag the hue** to re-tint buttons, charts, focus rings and the backdrop.
- **Every position stays contrast-checked.** The accent is *solved* rather than
  picked: the app walks lightness until the pair actually measures at WCAG AA,
  for every hue, in both themes. The test suite checks all 360° — 1,440
  generated palettes — because "a designer eyeballed it" stops being a strategy
  once there are 360 accents and any one of them can be the one you choose.
- **The semantic colours don't move.** Food, bowel and symptom cards are told
  apart by hue, and the severity ramp means something; dragging those along
  with the accent would break both at exactly the setting you liked.

### Night Light

Where the dark theme went, and then some. Dark/Light/System are still there and
now sit at the top of Appearance instead of below the fold.

- **It takes the blue out of the pixels**, rather than laying a warm sheet over
  the top. `#FFFFFF` really does stop being `#FFFFFF`.
- **The accent is pulled into the amber band too**, whatever the slider says —
  the largest saturated area on screen is the last place to leave blue running.
- **Readability is repaired, not assumed.** Warming every channel preserves
  which of two colours is lighter but not the ratio between them, so a pair
  that measured 3.02:1 in daylight can land at 2.89:1. Every token is pushed
  back over its own bar afterwards, and tested.

### Feedback ships louder

- **Sounds on by default.** For journals that were silent only because the app
  of the day was silent — a deliberate mute from v2 onward is still respected.
- **A vibration strength control, defaulting to Vivid.** The web exposes pulse
  *duration*, not amplitude, so a stronger setting is a longer pulse; the
  silences between pulses are stretched far less, or a double-tap stops reading
  as one gesture.

### The J

The display face is Fraunces, an optical-size family with a real `opsz` axis
from 9 to 144 — and the app was loading the cut with that axis subsetted away
and baked at **14**, the *text* optical size. Every heading was being drawn with
letterforms designed for 14px and then scaled up: heavy slab terminals, tight
apertures, and a chunky flat-topped J that took the worst of it.

Now it loads the `opsz` cut and turns on `font-optical-sizing`, so a 30px title
is drawn with the shapes meant for 30px and the 60px streak number with the
shapes meant for 60px.

## 1.6.0

### The question editor is filed by subject, not by pack

1.5.0 grouped the editor into one collapsible section per pack, which was the
right shape and the wrong axis. Nobody arrives thinking "Joint Pain / Mobility
pack, third row" — they arrive thinking *I want to stop being asked about my
knees*. And a pack drawer is still forty rows once it's open.

- **Categories, not packs**: Symptoms, Pain, Sleep, Mood, Energy, Digestion,
  Food, Bowel movements, Hydration, Activity, Medications & supplements, Vitals
  & body, Skin care, Triggers, Photos, and your own questions. Every question
  in every pack is filed explicitly, so nothing lands in a surprising drawer;
  a test walks all eleven packs and fails if anything falls through to "Other".
- **Grouping by pack is still one tap away** for anyone who thinks in the packs
  they switched on.
- **Every header carries its own count** — "12 questions · 8 of 12 on" — so the
  shape of a setup is readable without opening anything.
- **Search spans questions, packs, sections and category names**, with a live
  match count, and forces matching drawers open.
- **Rows are only built once a drawer is opened.** With every pack enabled —
  about 120 questions, the largest setup the app allows — the editor now opens
  with *no* question rows rendered at all, and the biggest single category is
  under half the total.
- **The arrows reorder inside a category.** They used to swap against the raw
  global neighbour, which flung a question into a different drawer the moment
  you tapped one; the swap is still written into the one global order.

### A sound of its own

The old feedback layer was six sine beeps at fixed pitches — the sound of a
microwave, on a screen where someone is recording how much pain they were in
today. `src/lib/sound.ts` replaces it with a small instrument built from one
primitive: an oscillator, an envelope, and a whisper of filtered noise so a tap
reads as a finger on a surface rather than a tone generator.

- **A voice per action**, not per event type: a tactile tap, a warmer select, a
  two-note switch that rises to turn on and falls to turn off, a quiet drawer,
  a low navigation cue that is deliberately not a confirmation, a wooden knock
  for reordering, a satisfying pluck for Quick Add, a warm rising third when
  something saves, and an F–A–C arpeggio with a soft bell for finishing the
  day's journal.
- **It never repeats itself.** Every voice detunes a few cents, and the tactile
  sounds walk an F pentatonic in a shuffled bag rather than replaying one pitch.
  Twenty taps sound like an instrument, not twenty notifications.
- **Quiet and short.** Master sits low behind a lowpass and a soft limiter;
  taps are under 90ms and nothing but the completion moment runs past a third
  of a second. Nothing is wired to scroll, hover or focus.
- **Finishing the day is unmissable.** The rattle guard that stops fast taps
  from buzzing used to be able to swallow a once-a-day celebration that
  happened to follow a tap by 30ms; completions and milestones skip it.
- Audio is created lazily on a real gesture, and the context is handed back
  while the app is in the background.

### Sound and the ambient backdrop now ship on

Both are most of what makes this feel like a place rather than a form, and an
off-by-default delight is one almost nobody sees.

- **New journals arrive with sound, haptics and the moving backdrop on**, each
  one switch away in Settings, and Settings can now play a sample of each sound.
- **Nothing existing is overwritten.** Prefs carry a version stamp: a journal
  that predates these defaults ran silent with a still background, and that was
  the app's behaviour rather than an unset field, so it keeps it. Anything
  already chosen passes through untouched.
- **The backdrop stands down on its own** — under `prefers-reduced-motion`
  (now watched live, so switching it on in the OS stops the fog without a
  reload), on a device reporting under 4GB or under four cores, and while the
  tab is in the background, where it releases the WebGL context entirely.
- It loads at idle after first paint, so a 600kB shader chunk never competes
  with the app booting.

### Fixed

- **A question shared by several packs was listed once per pack.** Brain fog is
  in four packs, so the editor showed four identical rows, all four writing the
  same answer — while the copy above them promised shared questions are "only
  asked once", and the rest of the app already deduped by key. One row now,
  labelled with how many packs are asking for it.

## 1.5.0

### Food tracking that keeps up with a real day

The first version could log a meal. It could not log *lunch* in five seconds,
which is the only thing that decides whether anyone keeps using a food tracker.

MyFitnessPal solves that with two million foods on a server. This app has no
server and no account, so it solves the half that actually does the work:
**people eat the same thirty or forty things on repeat**, so the library builds
itself out of your own logs and the second time you eat something is one tap.

- **A personal food library**, grown by using the app. Saving a meal saves the
  food, per single serving — logging "3 × 1 slice" doesn't teach it that a slice
  is three slices.
- **A picker built for speed**: search, plus Recent / Frequent / Favourites
  tabs, a one-tap `+` on every row, and a serving stepper for anything that
  isn't exactly one portion. Search deliberately overrides the tab — once
  you're typing, you want one specific thing.
- **Quick-add calories** for "I know roughly what that was and I don't want to
  describe it".
- **A Food tab**: date pager, calorie ring, macro bars, and the day grouped
  into Breakfast / Lunch / Dinner / Snack / Drink with per-meal subtotals. A
  flat list of nine items is a receipt; grouped, it's a diary.
- **Copy yesterday**, for the days that repeat.
- **Optional daily targets** — calories and any macros you care about, left
  blank by default. Progress bars fill and that is all they do: no red for over,
  no green for under. The app doesn't have an opinion about your calorie count.
- Corrections propagate: fixing a food's figures once fixes them everywhere
  after.

**Provenance survives re-use.** A saved food whose numbers began as an
unconfirmed AI estimate is marked as such, and logging it writes into the log's
`ai` block rather than its `nutrition` — otherwise saving a food would be a
laundering step that turns a guess into a measurement one tap later. Re-logged
estimates still read "about 520 kcal" and still carry the badge.

### The question editor is navigable again

Every question from every enabled pack used to render as one flat run —
routinely sixty rows, with the one you came to change somewhere in the middle.

- **Collapsible sections, one per pack**, each showing how many of its questions
  are on. Everything starts closed, so the screen opens short.
- **A filter across the top.** A live query forces matching sections open — a
  search hit inside a shut drawer helps nobody.
- Expand/collapse all, and the reorder arrows still operate on the whole
  ordered list, so moving a question up out of its section works as before.

### More than one reminder

One daily time could never express what this app needs nudging for. A check-in
belongs at the end of the day; meals belong at meal times, because the point of
food tracking is logging it *while you eat*.

- **A list of reminders**, each with its own name, time and on/off switch.
  Presets for breakfast, lunch, dinner and an evening check-in.
- **One calendar file covering all of them** — still floating-time, so 8am
  means 8am wherever you wake up, and still the delivery route that works with
  the browser closed.
- Notifications know what they are nudging toward, and stay quiet when the job
  is already done — a dinner reminder checks for food logged around that time
  rather than "any food at all today", since breakfast says nothing about
  dinner.
- One timer armed for whichever reminder is next, rather than one timer each.
- Existing installs keep the single time they set; it becomes the first entry
  in the list.

### Fixed

- **Toggle switches rendered as a bare knob with no track** anywhere they
  weren't inside a flex container — `.fhj-switch` never set `display`, so as an
  inline element its width and height collapsed.
- The nutrition fields sat behind a collapsed disclosure. Typing calories is
  the single most common action in a food tracker; the four headline figures
  are always visible now, with the rest behind "More nutrients".

83 new tests (food library, goals, multi-reminder scheduling, the sectioned
editor, and the one-tap logging loop end to end); **407 total across 18 suites**.

## 1.4.0

### A new visual system

The app was functional and plain. It now has a design system rather than a set of
conventions — *Soft Clinical* with a deliberate hint of neobrutalism, applied through shared
tokens and components instead of screen by screen.

- **New palettes.** Dark is soft graphite — a warm-neutral charcoal rather than the blue-black
  every developer tool ships. Light is warm off-white, rebuilt at the same structure rather than
  inverted. The accent family is muted blue, sage, lavender and clay, chosen to sit beside each
  other in a chart without competing.
- **A tactile register, used sparingly.** Borders one notch above a hairline, hard offset
  shadows, and a press that travels exactly the shadow's own offset so the element lands flush
  instead of shrinking. It appears on primary actions, Quick Add tiles and selected metrics —
  and nowhere else, which is what keeps it reading as emphasis rather than as a house style.
- **Bold section titles** in the display face, each with a small category-tinted bar, so a food
  section and a symptom section are told apart before either is read.
- **25 hand-rolled primary buttons** across the app were replaced with the shared primitive.
  They had baked in white-on-accent text, which was correct for the old dark blurple accent and
  unreadable on the new one; ink is now derived from the fill everywhere via `readableInk()`.
- New reusable components: Quick Add tiles, timeline rows, AI provenance badges, empty states,
  skeletons, expandable cards, photo transitions, category tinting.
- **Dark mode is still the default**, light mode is a first-class option, and the choice is
  still read before first paint — the pre-paint script is now pinned to the real palette values
  by a test, because it duplicates two of them and could silently drift.
- Contrast is enforced in both themes by `tests/theme.test.ts`, now covering the category hues
  as fills *and* as text.

### Food tracking

- Log a meal or drink with the category, date and time, description, serving, weight/quantity,
  notes, and a photo.
- **Optional AI estimation** from a photo, from text, or from both. With both, an explicitly
  stated quantity is treated as fact — the model estimates around it rather than overriding it
  with a guess about a typical portion.
- Estimates can cover calories, protein, carbs, fat, fiber, sugar, sodium and notable
  micronutrients, and every one of them is labelled **AI Estimated** and editable.
- **A number you entered and a number a model guessed are never stored in the same field.** The
  effective value is yours if present and the estimate otherwise, and the UI can always say
  which one it drew. "Use these" copies an estimate across to become yours — which also makes it
  immune to a later re-run.
- Values are rounded to a resolution the method can actually support, and an estimated calorie
  count reads "about 520 kcal" rather than "520 kcal".

### Bowel movement tracking

- Quick log with date and time, Bristol type (all seven, with their descriptions), amount,
  colour, consistency, urgency, straining, discomfort, notes, and an optional photo.
- **Optional** photo analysis suggests observable attributes only — Bristol type, colour,
  consistency, form. It never diagnoses: the prompt forbids it four ways, and
  `normaliseBowelResult` drops any field that strays into interpretation regardless of what the
  model returns. Suggestions are never written into the log; the user accepts them.
- A photo stays on the device unless the user explicitly asks for that photo to be analysed.

### One AI integration, five uses

- Pattern analysis, food text, food image, food image + text, and bowel image now share one
  integration — the same stored connection, model resolution, retry-once-if-the-model-is-gone
  behaviour, redaction, and output normalisation.
- **Every outbound request passes through the same consent sheet**, which describes exactly
  what is about to be sent before it goes. Nothing is sent on save, in the background, or on a
  retry without asking again.
- A model that reads text but not images now says so, instead of surfacing a raw 400.
- AI remains entirely optional. With it switched off there is no analysis button anywhere, and
  the app makes no network request at all.

### A simpler dashboard

Rebuilt around five sections: **Today**, **Quick Add**, **Today's Logs**, **Trends**, and
**Possible Patterns**, with reports, photos and recent entries below them.

- Quick Add is four tactile tiles — check-in, food, bowel, photo.
- Today's Logs is one timeline carrying every kind of entry in the order it happened, tinted by
  category, with photo thumbnails and AI badges where they apply.
- Today's food totals appear on the hero card, and say when a total leans on an estimate.

### Trends

- Food and bowel logs are many-per-day, so they reach the 30-day chart as **derived daily
  metrics** — calories, each macro, bowel movement count, average Bristol type, urgency,
  straining, discomfort. Only metrics with real data behind them are offered.
- Calorie and macro metrics are deliberately directionless: colouring a calorie count red would
  be the app giving dietary advice through a palette choice.
- The chart itself is more polished — a soft gradient wash under the line, a draw-in animation
  that respects `prefers-reduced-motion`, rounded joins, hover dots, units in the tooltip, and a
  weekly-average bar chart where the current week stands forward.
- **Fixed: the Y axis was clipping two-digit ticks** — a negative left margin cut the leading
  digit, so "10" rendered as "L0".

### Export

- XLSX gains **Food** and **Bowel** sheets, one row per log. Every nutrient has a value column
  *and* a `_source` column saying whether it was entered or estimated — a spreadsheet is exactly
  where someone would go looking for that distinction.
- The daily table and CSV gain that day's nutrition totals, and a flag for a day whose totals
  lean on an estimate.
- Full backups and JSON exports carry food and bowel logs; restoring sanitises every row, so one
  malformed entry in a hand-edited file can't cost the user the other three hundred.

### Fixed

- **A truncation hole in the bowel-photo safety filter.** Descriptive fields were cut to length
  *before* being screened, so a sentence like "pale, which can indicate a liver condition" had
  the flagged word sliced in half and passed through intact enough to still read as a diagnosis.
  Screening now runs on the whole string.
- **Stacked dialogs were mislabelled and leaky.** Every `Modal` used the same `aria-labelledby`
  id, so a confirmation sheet announced the heading of the form underneath it; and that form's
  own Cancel button stayed focusable behind the dialog asking about it. Ids are now per-instance
  and the covered form is made `inert`.
- Times restored from a backup are validated, not just shape-checked — `25:99` used to pass and
  then sort into the middle of the timeline.

107 new tests (`tests/tracking.test.ts`, `tests/aiFoodBowel.test.ts`, `tests/foodBowelUi.test.tsx`,
plus palette and pre-paint coverage); **324 total across 17 suites**.

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
