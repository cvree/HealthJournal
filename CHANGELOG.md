# Changelog

## 1.36.0

The buttons that give you your data back now work on the phone you installed this on.

### Three findings from a browser walk, and two of them were the same bug

The app was measured at 390px and 320px against a production build, and read in
the places a browser cannot reach. Two of what came back were the same failure
wearing different clothes: **the web has exactly one way to hand somebody a
file and one way to wake a phone, this app used both, and inside a WKWebView
neither of them exists.**

That is where the packaged iOS build runs.

### The file

Every file this app makes for somebody to keep — the CSV, the spreadsheet, the
JSON backup, the reminder calendar, the report image, and the raw file the
recovery screen offers when a journal will not open — left through one line:

    const a = document.createElement("a"); a.download = name; a.click();

Correct on the web, and the entire mechanism behind the claim this app makes
hardest: *your record is yours, and you can take it anywhere.* In a WKWebView
it does nothing. No file, no share sheet, no error. The button is simply dead,
silently, and the one promise the app cannot afford to break is the one it was
breaking without saying so.

`src/lib/saveFile.ts` is the whole fix. On the web it is the same anchor,
unchanged — the tests pin that it is still an anchor, still carries the
filename, still leaves nothing behind in the document. On a phone the file is
written to the app's own cache and handed to the system share sheet, where
*Save to Files*, *Mail* and *AirDrop* already live. The person chooses where it
goes, which is the same bargain a download folder is, and nothing leaves the
device unless they send it.

Cache rather than Documents, deliberately: this is a handoff, not a library the
app keeps. A second copy of a full photo backup sitting in Bellwether's own
folder is storage nobody asked for, on the device of somebody who may be
carrying two years of photographs.

Three things fell out of doing it properly. A share sheet somebody cancelled
resolves as success — *couldn't save your export* after a deliberate tap on
Cancel is the app calling somebody wrong. The durability card only marks a
journal backed up if the backup actually left, because claiming one that did
not is the single lie a durability screen may not tell. And the sentence under
the button now says *Shared* on a phone and *Downloaded* in a browser, because
"downloaded" is a word from the other platform.

### The reminder

`lib/reminders.ts` was honest about the web's limits and built two layers on
them: a notification the page fires while it is alive, and a downloadable
`.ics` the phone's own calendar keeps forever. Both assume a browser. Inside
the packaged app there is no `Notification` global at all, so
`notificationPermission()` returns `"unsupported"` and layer one is not
unreliable but absent — and layer two is a file, which is the paragraph above.

So the shipped app had no working reminder for the one behaviour that decides
whether a journal survives: coming back tomorrow.

A packaged app is the one place this is easy *and* costs nothing. A local
notification is scheduled on the device by the operating system — no push
service, no server, no token, no identifier, nothing to send. That is the exact
constraint `lib/reminders.ts` was written around, satisfied rather than worked
around. `src/lib/nativeReminders.ts` mirrors the reminder list onto the phone
and stores nothing of its own: every sync cancels what is pending and schedules
what the profile says, so a reminder somebody deleted cannot outlive it as a
ghost that fires at the old time forever. Erasing the journal takes them off
the phone too — a deleted journal that still taps you on the shoulder every
evening is the worst version of a notification there is.

Settings leads with it on a phone and demotes the calendar file to *or put them
in your calendar instead*. In a browser that block does not exist and nothing
about the screen has changed.

**Also missing, and found by running the sync:** `@capacitor/app` and
`@capacitor/haptics` were never in the Podfile either. The widget bridge and
the Taptic Engine have both been shipping as web fallbacks. All five plugins
are declared now, and the app's privacy manifest gains
`NSPrivacyAccessedAPICategoryFileTimestamp` (C617.1) — Capacitor's Filesystem
pod ships no manifest of its own, and an upload that touches a required-reason
API with nothing declaring it comes back as ITMS-91053 before a human sees it.

### And Today stopped contradicting itself

Two numbers, one screen, four inches apart. The corner of the pulse card read
`0 of 27` — the questions in the template, via `surveyProgress`. The check-in
card below it read `33 to answer` — the questions *plus* the doses scheduled
for today *plus* the rituals today asked for, via `checkinStatus`. On any setup
with a routine on it the two are guaranteed to disagree, and the demo journal
shipped disagreeing by six.

`lib/checkin.ts` exists to stop Today and History disagreeing about somebody's
day, and says so in its own header: *a person who reads "7 of 11" on one screen
and "8 of 12" on the other has learned that neither is worth reading.* It was
being contradicted inside a single card.

Both read the same module now. One consequence is stated rather than hidden: on
a journal with a routine, answering every question here leaves the bar short of
its end, because the day genuinely is not done — and the card immediately below
names what is left and opens it. The alternative was a bar that filled while
the day was not finished.

**And the estimate is arithmetic now.** `checkinLine` said *about a minute*
over any number at all. On the setup this app actually ships that read **33 to
answer, about a minute** — one and four fifths of a second per item, doses
included. It is a small clause and it is the first promise the card makes to
somebody deciding whether this is a two-minute habit or a chore.
`checkinEstimate` uses the Quick Log's own arithmetic, which was sitting a few
hundred lines away the whole time: four seconds an item, rounded to the nearest
five, printed in whole minutes and in words. The same card now reads **33 to
answer, about two minutes**, and it over-estimates slightly at the short end on
purpose — a minute that turns out to be forty seconds is a pleasant surprise,
and the reverse is what gets an app deleted.

### The parts

- `src/lib/saveFile.ts` — `saveFile(blob, name)`, `savedVerb(where)`. Resolves,
  never throws: every caller is a button with a sentence under it, and a
  rejected promise in an export handler is a button that goes quiet. Seven call
  sites, including `RecoveryScreen`, where a dead button would mean offering
  somebody a rescue that is not one immediately before offering to wipe what is
  left.
- `src/lib/nativeReminders.ts` — `nativeRemindersSupported`, `nativeReminderState`,
  `requestNativeReminders`, `plannedNotifications` (pure, so the schedule is
  testable without a phone), `syncNativeReminders`, `clearNativeReminders`.
  Notification ids are a djb2 hash of the reminder's own id, kept under 2^31 for
  the Android side's Java int — a counter would stack a second copy of the same
  reminder on every sync.
- `src/lib/checkin.ts` — `checkinEstimate(items)`.
- `src/App.tsx` — the pulse card's count and bar read `checkinStatus`;
  `surveyProgress` is no longer imported.
- Tests: **1941 across 76 suites**. New `tests/nativeHandover.test.ts` (13) pins
  that the web path is unchanged, that nothing native is touched in a browser,
  and that the phone's schedule is derived from the journal and only from it.
  `tests/checkin.test.ts` gains 5 for the estimate, `tests/pulseUi.test.tsx` 2
  for one denominator.

**Not verified on a device.** The web half is measured and pinned; the native
half is written against the plugin contracts and cannot be exercised from here.
Run `npx cap sync ios` on a Mac (CocoaPods is not installed in this
environment, so `pod install` was skipped) and check the export, the backup and
a scheduled reminder on hardware before trusting any of it.

## 1.35.0

The day closes, and you can see the stack of days behind it.

### The moment this app exists for was drawn as a checkbox

Everything in Bellwether points at one event. You answer the last thing today
asked for, and the day you were living becomes a day that is written down. That
is the product. It is why the ring exists, why the pips exist, why the card is
called *today's check-in* rather than *add more detail*.

Here is what happened when it fired: the ring swapped a numeral for a tick, and
the sentence under it changed from *One left.* to *Today is fully on the
record.* No sound, no weight under the thumb, nothing that marked the difference
between the twelfth answer and the eleventh. A state change, at the visual
weight of ticking a box on a form, spent on the one moment the whole app is
arranged to produce.

And it was worse than flat, because it was *anticlimactic in a specific way*:
the row of marks under the title — the part people actually watch, the thing
that makes "two left" something you finish rather than something you are told —
reached its most complete state and became fourteen identical solid blocks. A
shape that had finished saying anything at the exact moment the card had the
most to show.

### What it does now, and what it still refuses to do

**A seal.** `sealDay` in `lib/motion.ts`. The card settles once, a wash of the
pack's own colour crosses it, the tick stamps into the middle of the ring, and
the days behind today arrive mark by mark. It lasts about as long as closing a
page, and it fires with `feedback("complete")` — sound, and a weight under the
thumb on a phone that has a motor.

**It fires on the transition, once.** `complete` is derived from the journal on
every render, which means it is true for the rest of the day and true again
tomorrow morning on an app that was finished last night. Neither of those is the
moment. `useDaySeal` opens its ref at whatever the day already was, so arriving
on a finished day is silent and only an answer that *closes* the day is an
event. A receipt played every time you open the app is not a receipt; it is a
noise you learn to ignore by Thursday.

**The stack of pages.** The pip row is replaced — not joined — by the fortnight
behind today, with today's mark solid on the end of it. Same visual language,
one row of marks at a time, and it exists only in the state where the other row
has nothing left to tell anybody. This is the satisfaction closing a page in a
paper journal actually gives: nobody said well done, the thing you are making is
simply visibly thicker than it was.

**What it is not, and will not become.** There is still no badge, no score, no
streak counted at you and no congratulation. A day the journal has nothing on is
a hairline in that row and nothing else — no red, no gap count, no "four
missed". `recordStrip` in `lib/checkin.ts` owns the rule and the tests pin it,
including the one that matters most: today is marked because the journal holds
it, not because it is today. A card that draws its own last mark solid
regardless is a card that would show a finished day on an empty one.

### The parts

- `src/lib/checkin.ts` — `recordStrip(logged, date, days = 14)`, `RECORD_STRIP_DAYS`,
  `recordStripLine(strip)`. Pure, and asked against the same `loggedDates` set
  every cadence question in the app uses, so the row can never claim a day the
  streak does not. The words are a fact about the journal — *3 of the last 14
  days are on the record.* — and carry the row for anyone who cannot see it.
- `src/lib/motion.ts` — `sealDay(el)`. A GSAP timeline over `[data-seal-wash]`,
  `[data-seal-stamp]` and `[data-seal-mark]`; a no-op under reduced motion, like
  every other entry point in that file.
- `src/App.tsx` — `useDaySeal(complete, key)`, `SealWash`, `RecordStrip`, and a
  finished `CheckinRing` that stamps rather than ticks. Both cards use them:
  the one at the foot of the pulse on Today, and the one at the top of History,
  because finishing the day from the record is finishing the day.
- `src/styles/index.css` — `.fhj-seal-wash` (the band built with `color-mix`
  off a `--fhj-seal-tint` the card sets, so any pack colour works;
  `plus-lighter` only under `[data-theme="dark"]`, because on a pale card that
  blend is a flashbulb rather than a page closing), `.fhj-record-strip` /
  `.fhj-record-mark`, `.fhj-ring-stamp`, and both cards made a stage for the
  wash. Reduced motion drops the wash entirely.
- Tests: **1921 across 75 suites**. New `tests/dayClose.test.tsx` (6) pins the
  transition — fires on the closing answer, silent on a day already finished
  when you arrived, fires again if you clear the number and answer it a second
  time — and that the finished card swaps one row of marks for the other rather
  than showing both. `tests/checkin.test.ts` gains 7 for the row itself,
  including a month-and-year crossing and the guarantee that it does not flatter
  today.

## 1.34.0

The number you tap every morning is finally bigger than your thumb.

### The scale was 21 pixels wide

This app is built around one gesture. You open it, you tap a number between 1
and 10, and the day is on the record. Everything else — the survey, the routine,
the photos, the charts, a year of history — is optional, and the whole product
is arranged so that the one thing that is not optional costs a single tap.

That tap was landing on a target 21 pixels wide.

Not by anybody's decision. `--fhj-tap: 44px` has been in the stylesheet since
the first commit, and the app applied it faithfully — as a `min-height`, and
only as a `min-height`. So the rungs of the daily scale were 52px tall and,
because ten of them share a card inside a shell that is 28rem wide and never
wider, 21px across on a 320px phone and 29px on a 390px one. Tall enough in
exactly one direction. A thumb is round.

**Measured, not guessed.** These numbers came out of a real browser driven at
real phone widths, because they had to: jsdom has no layout engine, so every
test that mounts this app and asks a button how big it is gets a zero back and
passes. The stylesheet said 44 and the suite agreed with it for eleven releases.

### Ten across cannot be tapped, and it is arithmetic

Take the page and card padding off a 320px screen and this control is handed
about 288 pixels. Ten columns of that is 21px. Ten columns of a 390px screen is
29px. There is no phone wide enough to rescue it and there never will be, because
the shell is capped at 28rem on purpose — a journal read at arm's length is not
improved by being 1100 pixels wide.

**Five across, two rows down.** Which is 55px, and which is exactly what the
Quick Log has drawn since the beginning. There were three 1–10 scales in this
app — the Daily Pulse on Today, the shared one in the Detailed Log and the day
sheets, and the Quick Log's — and only one of them could be tapped. Now there is
one shape, and it is the one that was already right.

It still reads as a level. Everything up to the number you chose fills, and
wrapped at five it fills the way a page of text does — left to right, then down
— which is the reading order the eye is already in. A 7 is a full row and two
more. That was legible from across a room before and it is legible now, at two
and a half times the size.

### Everything else it turned out to be hiding

Once the floor is a floor in both directions, the same sweep finds the rest of
it, and the rest of it is not nothing:

- **The Detailed Log's chips** — every trigger, every food, "Gluten / wheat",
  "Ground beef", dozens of them — were 36px tall.
- **Yes/No**, the second most-answered control in the app, was 36px.
- **The − and + beside a number** were 36×36.
- **Every text field** was 42.
- **Chips and segmented controls everywhere** were 42, which the README has been
  describing as a considered choice. It was two pixels short of the standard the
  same repo set, on every filter, meal and metric chip in the product.
- **The back pill over the nav**, the skip link, the small button variant, the
  "hold + to go anywhere" coach mark — 40, 40, 36, 33.

All of them now clear 44 in both directions.

### The ones whose ink has to stay small

A header of 44px circles reads as a toolbar. "Manage" set at 44px is no longer a
quiet link over a section. So for the handful of controls where growing the box
would change what the control *is*, the ink keeps its size and the target grows
underneath it: an invisible box, at least 44px each way, centred on the control
and taking the tap. Layout, rhythm and weight are untouched. Nothing moved on any
screen. The tap lands.

That is `.fhj-tap-floor`, and it is `max(100%, var(--fhj-tap))` rather than a
fixed size, so a control already bigger than the floor keeps its own hit area
instead of being shrunk to fit one.

### Two exemptions, both stated

**A day in the year heatmap** is 6×11 pixels, because a year is 365 days and a
phone is 320 pixels wide. **The arrows on a scrolling chip row** are 32px and
float over the row they scroll. Neither can be 44 without becoming a different
feature, and both have a full-size route to the same place — the heatmap's days
are also reachable from the calendar and from Search, and the chip row swipes.
Everything else in the app is 44.

### Under it

- **`.fhj-scale` / `.fhj-scale-rung`** (Detailed Log, day sheets, and the
  follow-up questions inside the Daily Pulse): `repeat(5, minmax(0, 1fr))`,
  `min-height: var(--fhj-tap)` in place of a fixed `height: 2.25rem`, numerals up
  from 11px to 13px now that there is room to read them.
- **`.fhj-pulse-scale` / `.fhj-pulse-rung`**: five columns, `min-width: 0` so a
  numeral can never push the grid past its card.
- **`.fhj-tap-floor`** and the selectors sharing its `::after` — `.fhj-icon-btn`
  (every 32/36/40px icon button in the app) and `.fhj-chip.fhj-chip-sm`, which
  sits in a row beside a small input and would stretch it by growing.
- **Grown to `var(--fhj-tap)`**: `.fhj-chip`, `.fhj-segment`, `.fhj-seg > button`,
  `.fhj-btn-sm`, `.fhj-thumb-back`, `.fhj-thumb-coach`, `.fhj-skip`, plus the
  Tailwind one-offs — `ChipsInput`, `ToggleInput`, `TextField`, `NumberInput`'s
  steppers, the Quick/Detailed switch, and the six small text buttons that carry
  `fhj-tap-floor` in `App.tsx`.
- **New `tests/tapTargets.test.ts`** (14): the token is 44, the overlay rule is
  the overlay rule, all three scales are five across, the named controls declare
  the floor — and a sweep over the whole stylesheet that fails on *any* new
  interactive rule declaring a `min-height` between 24 and 43px. Source
  assertions on purpose, and the file says why.
- **Tests: 1908 across 74 suites** (was 1894/73).

### One pre-existing failure, fixed on the way past

`tests/experience.test.tsx` asserted that the report's next-period button is
disabled at the current period, having navigated to the current period by
switching Week to Month. It is not: the report opens on the best period it can
find, and a month with fewer than four logged days is not it — so on the 1st,
2nd or 3rd of any month the test opened on *last* month and failed for a reason
that had nothing to do with the screen. It pins the clock now, which is the
second calendar-brittle test in this suite to need it.

## 1.33.0

One box that finds anything, and an import that reads a paragraph.

### A year of a journal you could not open a drawer of

A journal kept for a year is a filing cabinet, and until now this app gave you
no way into it. *When did I last take the antihistamine? What did I eat the week
of the flare? Which days was the itch a 9?* Every one of those questions had the
same answer, which was to scroll History with your thumb and hope.

**Search** is one field over everything: every note you have written, every meal,
dose, bowel entry, ritual, flare, lab result and hour outside, plus the questions
your survey asks and the screens themselves. It answers on the first keystroke —
the index is built once from the journal already in memory, so there is no button
to press and nothing to wait for — and every result opens the thing it found, on
the day it happened. A meal from March opens the Diary *in March*.

It is one tap from Today, one tap from History, in the header of every screen
that has one, and in the fan.

**The query language is five things people already type into search boxes**, and
none of them is in the way — plain words are the overwhelming majority of
searches and always work:

- `"woke at 4"` — that exact phrase
- `-coffee` — leave out anything that mentions it
- `is:meals`, `is:doses`, `is:flares` — one kind only
- `on:yesterday`, `after:2026-08-01`, `last:30d` — a day or a stretch
- `pain>7` — **days where a question you are asked went over a number**

That last one is the one a symptom journal actually needed. `itch>=8 -dairy`
is a real question with a real answer, and it took a spreadsheet export to ask
it before.

Nothing is rejected: a token that looks like a filter and is not one is treated
as a word, so a stray colon never costs you your search. Every filter that *did*
parse is said back to you as a chip, because the commonest failed search is one
with a filter somebody forgot was on — and "no results" cannot tell you that.
A comparison against a question your journal does not ask says so by name rather
than quietly returning nothing.

Every term has to match. `havarti cheese` finds the hamburger; it does not find
every meal containing either word.

The empty screen is not a shrug — it is five searches somebody would actually
run, each one tap from being run, with the operator reference folded behind a
disclosure underneath. And the whole thing is local: an index built in memory
over data already on the phone, thrown away when you close the screen. It is
the exact opposite of the import path, and it sends nothing.

### The import stops needing you to have kept a tidy log

Import was built for the person with a notes file full of dated shorthand. That
person exists. So does the one who never kept one and would describe the last
fortnight in three sentences if asked — and until now the feature quietly was
not for them.

**It reads a paragraph now.** *"Started 10mg amitriptyline last Tuesday, every
night since. Sleep has been about a 4 most nights. Cut dairy on the 12th and the
itch is better — a 3 today, was a 7."* That is a course of a medication, a
rating, a change, and a rating today, and all four come back as rows on the days
they belong to.

**A stretch of days is one row that writes many.** "Every night since Tuesday"
is eight doses, and a journal that files it as one dose on Tuesday disagrees with
the notes it was handed. So it stays **one row in the review** — a fortnight of a
nightly tablet taking fourteen lines would make the list unreadable — marked with
how many days it covers, and writes one record per day when you approve it.
Correcting its first date moves the whole stretch, because the length is what
your notes said and only the position was wrong.

It will never do that to a rating or a bowel movement. "About a 4 most nights"
is *one* answer with a caveat saying so — six invented fours would be six points
your charts then draw.

**It asks, and it answers itself.** Real notes are ambiguous: two things with the
same short name, a course with no stated end. A reader that stopped and asked
would have turned a paste into an interrogation. So it decides, files every row
under the decision, and hands back the question *with the answer it used already
marked*. Ignore it entirely and you still get a complete, honest plan. Change one
and the notes are read again around your answer — which is a second request, so
it asks before it sends, exactly like the first.

**"Already in your journal" now appears before the button, not in the receipt.**
The review runs the same pure function the commit will run, against your real
journal, and marks the rows that would be skipped — with one tap to switch them
all off. Running the same notes twice is what everybody does, because the first
run is a test.

**And what this journal had nowhere to put is named.** A blood pressure reading
with no blood pressure question used to vanish between the notes and the review.
It is listed now, in the words it came from, with what to do about it. A list
that is quietly shorter than the notes it was made from is the one outcome that
makes somebody stop trusting the whole feature.

The rules that were not negotiable are still not negotiable. The model never
writes; `applyImport` is a pure function of the rows you approved and has never
heard of a model. Nothing leaves until a sheet listing the entire payload has
been accepted, every time. Your words are copied, never improved. A guess is
labelled as one.

### Under it

- **New module `src/lib/search.ts`** (typed, pure, no React): `buildIndex` over
  eleven data shapes, `parseQuery` (never fails), `runSearch` (AND semantics,
  absolute filters, field-weighted scoring with a recency nudge too small to
  outrank relevance), `resolveField`, `snippetFor` (excerpts around the hit, not
  from the top of the note), `highlight` (merged spans), `describeSearch`.
- **New component `src/components/SearchScreen.tsx`**, plus `search` as a screen,
  a nav destination, a `?screen=search` deep link, and `DiaryScreen`'s new
  `startDate` so a meal result opens the day it was eaten.
- **`src/lib/import.ts`**: `ImportedItem.span`, `resolveSpan` (capped at
  `MAX_SPAN_DAYS`), `spanLabel`, `shiftItemDate`, `ImportQuestion` +
  `normaliseQuestions`, `ImportAnswer` on `ImportInput`, `ImportPlan.unplaced`,
  and `applyImport` returning `duplicateIds` so the review can dry-run itself.
- **Tests: 1894 across 73 suites** (was 1821/71). New `tests/search.test.ts` (36)
  and `tests/searchUi.test.tsx` (15); `tests/import.test.ts` 33 → 48 and
  `tests/importUi.test.tsx` 13 → 20.

## 1.32.0

The setup asks what you came for, and then tells you when it can answer.

### The question the first run never asked

Everything the setup did up to now established *what* you track, which is the
part an app can guess at. It never once asked *why* — and the why turns out to be
the only fact on the screen worth building anything around.

Two people both pick Eczema. One wants to know what sets it off. One wants to
know whether the cream she started in January is doing anything. One wants twelve
weeks of evidence to put in front of a dermatologist who gets ten minutes. Those
are three different journals — different buttons, different photographs, a
different first suggestion, a different thing to wait for — and they were all
getting the same one.

So there is a new act, second of six: **what do you want to find out?** Five
cards, and the last of them is *nothing in particular — just keep the record*,
which is a real answer and is never sulked at.

Picking one opens underneath itself and answers with **machinery rather than
encouragement**: the comparison the app will actually run on your own days, the
buttons and photo subjects that will arrive suggested two screens from now —
named, so you meet the consequence of your own answer immediately rather than
three screens later — and **the date the first answer can exist at all**.
Nothing on it says "great choice".

**An aim moves the app's opinion. It never moves your hand.** Every question,
every photograph and every button in this journal is still a card you say yes to,
one at a time, exactly as before. What changes is what gets offered first, and
which rows on the question cards carry a small mark reading *your aim* —
because somebody who told the app their question two screens ago and is then left
to scroll past the answer to it has been failed by the app rather than by
themselves. Where a whole group qualifies, the group says so once in a sentence
and the rows are left alone: six identical badges is a pattern, and a pattern is
wallpaper.

### "Keep going and it will be worth it" is not an answer to "when?"

The last screen of the setup made a promise about the future and then declined to
date it. It ends on **three dated rungs** now — your first week, twelve days on
the record, thirty days across a few different weeks — each carrying what becomes
possible there, worded around the question you said you came with.

The dates are arithmetic you could check by hand. The rungs are the same ones
every finding in this app is already graded on; the pace is the cadence you chose
two screens earlier, so choosing *once a week* moves every date on the screen
rather than being quietly ignored. And it says out loud what happens if you miss
some: they move, nothing is lost, and nothing is scolded.

The same arithmetic comes back on **Insights in week one** — the screen where a
new journal correctly has nothing to show. *Nothing stands out yet* is now
followed by how many more check-ins and when, and by the question you started
this to answer, instead of by "keep logging and they'll show up on their own".

### Nobody has to start from nothing

Almost everybody who tracks anything seriously was already tracking it before
they found this app — a notes file, a chat with themselves, a photograph of a
page. The app has been able to read all of that into meals, doses, numbers and
notes *on the dates the notes themselves give* for a while now, and it lived
behind a button in Settings, which is exactly where somebody in their first week
will not look.

So the last card of the first run offers it, once: four lines of real shorthand
beside the rows they become. It is honest about the price in the same breath —
this is the one feature in the app that sends your own writing anywhere, it needs
the optional AI connection, and you approve every proposed row beside the words
it came from before one of them is written. Say yes and the app opens on that
screen rather than on an empty dashboard, with the tour waiting for you at the
dashboard rather than skipped. *Not now* opens the journal exactly as it would
have been.

A journal that starts with one day when it could have started with ninety is the
largest thing this flow can still do for somebody, because days are the one thing
that cannot be acquired later by trying harder.

### Smaller things

- **The suggestion says whose idea it was.** An extra or a photo subject on the
  screen because of your aim now says so — *you said you want to find what sets
  it off* — rather than the pack's generic *suggested for what you track*.
- **The extras are asked in your order.** The thing your own question needs is
  the first one held up, rather than whatever sat at the top of a catalogue
  written years before you arrived.
- **The rail fits six.** Its labels were sized for five segments and ellipsised
  three of six; an indicator nobody can read ahead on is not one.
- **A badge never breaks across two lines.** *MOST PEOPLE KEEP / THIS* was a
  badge that had stopped being one.
- **A weekly-cadence test could not pass on a Monday.** It asserted the state
  "the week has had its check-in and today is untouched", which on the first day
  of a week cannot exist; the clock is pinned now.


## 1.31.0

Stop waiting for the app.

### A flare is a thing that happened, not a stopwatch you forgot to stop

Marking a flare used to be two halves. You pressed **Start** on the bad day and
you were expected to press **Stop** when it was over, and the app carried an "in
progress" state between the two.

That is the wrong shape for the moment it is used in. Marking a flare happens on
the bad day, one-handed, in a hurry — and everything the stopwatch asked for
after that first tap had to happen on some *later* day, when you feel fine and
have stopped thinking about it. So the ends never got pressed. What the app
accumulated instead was a list of flares that apparently never finished, a
permanent red banner on the dashboard, and a *day 46* that meant nothing except
that nobody had been back.

**One tap now marks one flare, on today, complete**, with the time on it. Twice
in an afternoon is two flares, which is the honest answer and the one the old
model could not represent at all. The tile counts them — *2 logged today* — and
Insights leads with *how many this month* rather than with a state.

Everything past that first tap is offered rather than demanded. The receipt
carries **Add details** beside Undo, because the tap is the only moment anybody
is actually thinking about this flare; the flare's own screen takes a name and a
note; and if it turned out to be the start of a bad fortnight rather than a bad
hour, **This one ran on** turns it back into a stretch. A flare somebody
deliberately left running still reads, still shows, and still ends — nothing
already in your journal forgot how to be read.

One number was quietly wrong and is now right: **flare days count days, not
episodes.** Two flares on one afternoon are two flares and one bad day.

### The check-in stopped making you watch it

Answering a question on Today cost about a second and a half before the next one
arrived: a 780ms hold on the confirmation, a 240ms exit, and a 440ms entrance.
That is fine once and intolerable on the twentieth question of a real morning,
which is the only place it was ever actually spent.

The beat is 300ms now and the two tweens either side of it are roughly halved.
The tick still arrives, is still animated, and still says the answer landed — it
simply stops charging you to watch it. **Question to question is about 600ms,
down from about 1,500.**

The **+** opens its fan of destinations at 180ms rather than 240, and the fan
itself arrives in 260ms with an 11ms stagger instead of 420ms with 26. The last
of twelve items used to land the better part of a second after the press — long
enough that people let go and tapped instead, which is the gesture failing.

### Every sheet in the app was 80px shorter than it looked

The app column carried a `z-index`, which made it a stacking context, which is a
ceiling: everything inside it was confined to the layer the column occupied.
A sheet at `z-index: 50` living inside a column at `z-index: 1` sat, in the page,
at 1 — underneath the thumb bar, which is a sibling of the column rather than a
child of it.

So the bottom strip of **every sheet in the app** was painted over by the
navigation bar, and taps in that strip went to the bar rather than to the sheet.
That strip is where every sheet keeps **Save**. One line, and the whole app's
action rows came back.

### Getting off a keypad took two dismissals

A measurement sheet is a list of numbers and then the keypad for the one you
picked. Tapping outside the keypad stepped *back* to the list rather than
leaving, so getting out took two dismissals — and the second one looked like the
first not having worked, which is the most reliable way there is to make
somebody think an app is broken.

Escape, the backdrop and the drag now all mean the same thing they mean
everywhere else: *I am done here*. Going back a step is its own control, at the
head of the sheet, where a back control belongs. The same fix applies to rating a
single symptom.

### The tour could not be read past its first screenful

The stop that lists what is behind the gear is a long card. On a phone it
overflowed, and a wheel or a flick over it was claimed by the smooth-scroll
driver and spent on the dashboard behind the dim — the card stood still, the app
slid away underneath it, and the rest of the list was simply unreachable.

The card now takes the height it actually has, scrolls inside itself, and every
gesture that lands on the tour is answered by the tour. Nothing behind it moves
unless the tour moves it.

### "None of these" now means what it says

In the first run, answering a whole group of questions with **None of these**
left you sitting on the group you had just declined, with the way forward a
second tap away at the foot of the screen. A decision that covers the whole card
ends the card. So does **Ask me all**.

### One offer, at the moment it is worth making

There is exactly one point in the first run where connecting an AI is obviously
in your interest and obviously about the thing you are already thinking about:
the moment you say yes to logging what you eat. A meal log is the one part of
this journal that is genuinely tedious by hand, and the one part a model does
almost perfectly from a photograph.

So that is where it is offered, once, phrased as what it does for you rather
than what it is — and built for somebody who has never typed the word "API".
Google's free key is the only option on the screen. The console opens in its own
tab, and **the moment you come back, the key is lifted off your clipboard,
checked, and saved with nothing pressed at all**. Browsers that will not read a
clipboard unasked get one enormous *paste it for me* button that does the
identical thing, and the text field is still there, third, for the one phone that
refuses both.

*Not now* is a complete answer, it is never raised twice, and refusing it leaves
the journal exactly as it would have been: nothing is switched on without a key
behind it. The same offer sits in the food sheet itself, under the photograph,
for anybody who said no the first time and then met the form.

## 1.30.0

Say it once, and let the shapes say the rest.

### The card stops narrating itself

The pulse card carried four lines of chrome under one question. *One tap and it
moves on* described the control directly above it. *Skip this one* said "this
one" only because *Done for now* sat beside it and the two had to be told apart.
*Back to the question before* spelled out a stack nobody is holding in their
head. And the row of chips underneath was introduced by *Anything else? — all
optional*, which called them optional twice in five words, over hints reading
*what happened?* and *worth seeing again later* — the app prompting itself out
loud.

Underneath all that, the same number was on the screen four times: the count in
the corner, the bar, the ring on the check-in card, and the card's own line
reading *7 of 20 in. 13 to go.*

The words come out and the layout does the work. Back on the left, Skip on the
right, and leaving is the **×** in the corner, which is what × has meant on a
card for forty years. Three controls, four words between them, and the only one
with a label is the one you press on purpose.

The "all done" banner goes too. It announced *All 20 of today's questions are
answered* an inch above a card whose ring had gone to a tick and whose line said
the same thing.

### Rituals were a feature the rest of the app had not been told about

A ritual — the shower and the three minutes after, the morning in its order —
turned out to be missing from three places it should always have been in.

**They never synced.** A ritual built on your phone never reached your tablet, a
lab result filed on your laptop stayed there, and sun sessions and experiments
crossed no wire at all. Deleting any of them was worse than silent: the deletion
was written down correctly and then dropped, so the next sync brought the thing
back. Everything you write now travels — rituals, their daily runs, their weekly
tune-ups, sun, labs, experiments, and the weather behind your days.

A day's attempt at a ritual is now identified by *which ritual, on which day*.
Tick this morning's shower on two devices and it is one morning, not two — which
is what stops a week reading as fourteen days and doubling its own streak.

**Today's check-in did not count them.** A check-in counts what the day asked
for and you set the denominator on, which is exactly what a scheduled ritual is.
Without it, a morning built as a five-step ritual could be left entirely
untouched and the day would still be called fully on the record. Rituals are in
the ring now, with their own run of marks.

**The routine reminder could not see them,** and this got worse the better you
had set the app up. Move your morning into a ritual — the whole reason rituals
exist — and the reminder had no checklist rows left to find, so it could never
call anything finished. It fired every morning, forever, however completely you
had done the thing. It now reads both halves of your day, counts *not today* as
dealt with on either side, and stays quiet on a day that asks for nothing.

### The welcome stops telling you where you are four times

Every numbered screen of first run drew its position twice and printed it twice
more: the rail across the top, a line reading *Step 2 of 5 · group 1 of 4*, a
second bar drawing the inner half again, and — on the first screen — a four-item
list headed *What happens next* whose four items were the rail's four remaining
segments written out as paragraphs.

The bars stay, because a bar is seen rather than read. The words go. What
survives of them is the half no bar can draw — what this screen is about to ask
of you — and it hangs on the rail now, one line, same place every time. The wall
dissolves into those five lines, each delivered on the screen it is actually
about.

Those printed counters were also the only thing telling a screen reader where it
was, since both bars are decorative. The position moved onto the rail itself as
its name, so it is now drawn once *and* announced once, instead of drawn once
and written twice.

### The hero draws its own line, and then gets out of the way

The collage on the first screen hangs off a rail down the left — the same shape
the last screen draws for real, out of your own first entry. That rail was meant
to draw itself downward and never did: the animation was written for a shape it
was not, so it quietly faded in instead. It draws now.

And the first screen leaves rather than being cut away. Pressing **Start my
journal** used to replace a full-bleed collage and display type with a plain
column between one frame and the next — the biggest change of register in the
app's first minute, made as a jump cut. Now the buttons go first, the headline
unsets itself back behind the edges it rose from, and the collage lifts away
last. Under four tenths of a second, and nothing at all if you have asked for
reduced motion.

## 1.29.0

You choose it, one card at a time — and then it shows you around.

Three screens in the middle of first run had more on them than anybody weighs in
a glance: the questions your check-in will ask, what is worth photographing, and
everything else a day holds. Each of them had a list, each list arrived with
something already decided, and each had a guided pass offered *beside* it for
anybody who wanted one.

That was the wrong shape twice over, and this release takes both apart.

### There is no preset any more

The check-in opened on **Quick** — four or five questions already switched on.
Before that it opened on **Balanced**, which was worse. Both are the same
mistake: three unlabelled sizes is a slider with no units, and whichever one the
app lands on is the app deciding what you track. The person most likely to tap
"Thorough" is the person least likely to still be answering it in March, and the
person who taps nothing at all has had a check-in chosen for them by a default.

So Quick, Balanced and Thorough are gone. Nothing arrives switched on but your
daily number — the question this app *is*, and the one thing that cannot be
switched off. Every other question in your journal got there because you tapped
it.

The packs still have an opinion and they still say it, on the row it is about:
**most people keep this**. Then they wait. That is the whole difference between
a suggestion and a decision, and it is the same rule the photographs screen has
followed since 1.28.

### And there is no list beside the pass

A guided pass that is optional is a guided pass the people who need it never
take, because taking it means admitting on screen four that you would like some
help. So the lists are gone and the pass *is* the screen — for all three acts,
not two.

**The questions**, one group at a time. How big the group is and what answering
it feels like — *five questions here — three rated 1–10, two yes / no* — the
control drawn beside every row, *ask me all of them* and *none of these* as
single taps, and the running cost of the whole check-in under your thumb,
answering back every time it changes. The last card is the one thing a pack
cannot supply: *anything it should ask that isn't here?*

**The photographs**, one subject at a time, as before — with the gap closed.
Saying yes to the body map used to hand you back to a screen you had already
left, which meant the one way to say yes to it and never see a body map was to
be walked through the deck: the exact person the pass was there to help. *Which
areas* and *which angles* are cards in the pass now, on the screen straight
after the yes that needs them.

**Everything else a day holds**, which was never walked at all. Five rows with
the app's suggestions ticked, and the row of buttons under your thumb for the
next year was therefore assembled by a default. One card each now, a yes beside
a no, and the dashboard drawn underneath as it fills in — then how often it
should ask, then whether it should nudge, in that order, because the reminder is
about when in the day and the cadence is about whether the day is even one of
the days.

### Nothing to confirm at the end of one

Each pass used to end on a review: your finished check-in, drawn as tomorrow
morning would draw it, over the line *every one of these is here because you
said so*. It was a nice screen and it had to go. A review card after a pass that
asked about every single item is the app asking you to agree with yourself; it
reads as doubt, and the second reading of a list you have just built row by row
is the reading where you stop caring.

The last answer is the answer. The next act starts.

### Today asks one question, in one place

The pulse card asked your daily number at the top and drew the next question as
a second card underneath it. Two questions were therefore on the screen at once
— the one you had just answered, still holding the top of the card with its
confirmation, and the one being asked, in a smaller box below. A card that has
to tell you where to look has already lost the tap.

There is one slot now. Your number is asked in it; the moment you answer, the
answer is said back where you gave it — *8/10 saved for today — a hard day* —
it holds for a beat, and then the whole thing lifts away and the next question
arrives in the same place, at the same size, with the same weight. Nothing moves
down the screen, nothing appears underneath, and the next question is never
something to *notice*: it is simply what the card says now.

The beat is the point. Swapping on the tap itself would make anybody doubt the
tap registered, which is the one thing a journal may never do.

Four rules keep it an offer. It never advances out from under a half-typed
answer — a number or a multi-select waits for **Next**. **Back to the question
before** walks out the way you came, all the way to the number, which is how
*tap it again to clear* is still true five questions later. The slot always
opens on your number when you come back to the app, even on a day you rated at
breakfast, because being shown question four with no sign of what you answered
at breakfast is the card hiding your own day from you. And **Skip this one** and
**Done for now** are still there, still not remembered.

### Then it shows you around

First run ends with a journal that has one day in it and a home screen full of
controls you chose ninety seconds ago and have never seen working. The pulse
card looks like a rating widget rather than a queue. The + looks like one button
rather than three. The row of tiles looks fixed rather than rearrangeable. And
Settings, where every one of those decisions can be taken again, looks like a
gear.

So there is one pass over the finished thing, on the morning it is finished,
once per device and never again. It dims the app and cuts a hole around **one
real control at a time** — the card that asks today's questions, the buttons you
assembled, today's check-in ring, the + button, the + button *held*, History, and
the gear. Nothing in it is a mock-up or a screenshot: what you are being taught
is where your thumb goes, and a picture of a button teaches nobody where a
button is.

It spends a whole stop on the two things nothing else explains. **Holding the +**
fans every screen in the app out from that corner — keep holding and slide, one
gesture, without your hand leaving the bottom of the phone — and the card draws
the movement as well as describing it. And **what is behind the gear** is listed
rather than left to be found in six weeks: your survey, how often it asks,
reminders, appearance, goals, taps and sounds, app lock, sync, the optional AI,
export, import, and the one page that says what can leave this device. There is
a way out on every card, and a way straight into Settings from the last one.

A stop whose control is not on your screen is dropped rather than drawn over
empty space — somebody who kept no extras has no row of buttons, and pointing at
where one would have been is worse than saying nothing.

### Under it

`FirstRun.tsx` loses `DEPTHS`, the lens row, the folded question list, the photo
subject list, the invite cards and both review cards; `walk`, `photoWalk` and a
new `extraWalk` are plain indices rather than "null means not walking", and
`enabled` derives from what somebody tapped rather than from a preset. Custom
questions are kept out of the group deck, so writing one no longer grows the
pass under the index you are standing on.

`DailyPulse` gains one stage: `cursor` (null is the daily number), `landed` for
the beat, and `trail` for the walk back, with `questionOut` / `questionIn` /
`answerLanded` added to `lib/motion.ts`. `NextQuestion` is gone.

New: `lib/tour.ts` (the stops, what is behind the gear, and where a card sits
against a hole) and `components/Tour.tsx` (the spotlight, which is one box with
a 200vmax box-shadow — the dim is outside it by construction, so there is no
mask to keep in step and the light travels between stops). Targets are CSS
selectors, so nothing on the dashboard knows the tour exists; `data-tour` lands
on two nav tabs and the gear. 1743 tests across 69 suites, all green.

## 1.28.0

The setup stops choosing for you.

First run has been eight screens and one path for a while now, and the shape of
it was right. What was wrong was quieter, and it was in the defaults.

Two screens in the middle of that flow arrive with a lot on the table — the
questions your check-in will ask, and the things worth photographing — and both
of them were arriving *already decided*. The check-in opened on **Balanced**:
every question the packs you picked consider everyday, which for eczema is
fourteen of them before you have answered a single one. The photos screen
opened with three or four subjects already ticked, because the app had looked
at your conditions and formed an opinion about what your camera would be
pointed at.

Both are defensible. Both are also the reason people scroll a setup screen
instead of reading it, and a survey you scrolled past is a survey you resent on
the first bad morning.

### It starts short now

Everybody lands on **Quick**: your daily number and a few everyday questions,
about fifteen seconds. Balanced and Thorough are still one tap away and still
say what they are — a line under the presets now spells out what the one you
are standing on actually means, because "Balanced" is a slider with no units.

This is a straight reversal of which mistake to make. Balanced is the better
*journal*; Quick is the better *first week*. Nobody has ever quit a health
journal because the first week asked too little, and adding a question in March
is a thing people do. Deleting twenty in March is not — they just stop opening
the app.

One rule keeps Quick honest: it will not hand you four severity ratings. Four
1–10s all move together, and the question this app exists to answer — *what was
different about the bad weeks?* — has nothing to work with. So where a pack's
own everyday order would give you nothing but ratings, the last slot goes to the
first question answered another way: something you *did*, beside something you
*felt*.

### Nothing gets photographed unless you say so

The photos screen no longer arrives with anything ticked. Every subject on it
ends with a camera pointed at your own skin, your own plate or your own bathroom
shelf, and an app that had already decided which of those it would be asking for
has helped itself to a decision that was never on offer.

It is still allowed an opinion. It just has to say it out loud and then wait: the
suggestions are marked **suggested for what you track**, and the contact sheet
fills in as you answer rather than starting full. Continuing with an empty sheet
is a finished answer, and the button says so.

### And both screens can now walk you through it

This is the part that matters most. Beside each of those lists there is now a
guided pass — optional, leaveable from any card, editing exactly the same state
the list edits.

**The questions**, one group at a time. Each card says how big the group is and
what answering it feels like — *five questions here — three rated 1–10, two yes /
no* — draws the control beside every row, offers *ask me all of them* and *none
of these* as single taps, and keeps the running cost of the whole check-in under
your thumb. It ends on your finished check-in, drawn exactly as tomorrow morning
will draw it, over the line: *every one of these is here because you said so*.

**The photographs**, one subject at a time. What it is, the same frame twice six
weeks apart, what it turns out to be worth later — *the flare you photograph on
the bad night is the one you can still show somebody in March* — whether people
tracking what you track tend to keep it, and then a Yes beside a No. Both
answers move on. A no is recorded as a no, so stepping back through the deck
shows the decision you made rather than a card that looks untouched.

Neither pass hides anything. Leaving one half-way keeps every answer already
given, and the full list is one tap away from every card.

### And it tells you what is coming

Picking what you track now draws the four screens that follow it: your
questions, your photographs, everything else a day holds, your first entry. Two
minutes, and nothing permanent — every one of them exists again in Settings,
with more on the table than first run ever shows you.

A step rail names four words. It does not tell you that the questions arrive
short, that nothing gets photographed unless you ask, or that all of it is
changeable tomorrow. Somebody who knows those three things arrives at the next
screen deciding. Somebody who does not arrives at it bracing.

### Under it

`FirstRun.tsx` gains two guided passes (`walk` over the question sections,
`photoWalk` over the photo subjects, both null when not walking and neither
holding state of its own), `DEPTHS` with the presets' meanings written down,
`shapeOf()` for the group-shape sentence, and a `why` on every photo subject in
the catalogue. `presetKeys("light")` does the non-scale swap. `chosenSubjects`
no longer falls back to the suggestions. 1743 tests across 69 suites, all green;
`tests/firstRun.test.tsx` covers the new default, the swap, both passes, leaving
one from the middle, and that what you chose inside a pass is what your journal
ends up asking.

## 1.27.0

How often it asks.

Every screen in this app rested on one assumption it never said out loud: that
the check-in is daily. The ring counted today. The streak counted consecutive
dates. The queue offered every question in the setup, today. The reminder fired
at eight, today.

For a lot of people that is right, and it is still the default. For a lot of
other people it is the reason their journal has eleven days in it.

Somebody tracking a supplement they want six months of evidence about does not
need to be asked every morning. Asked anyway, they comply for a fortnight, miss
a day, watch a streak counter reset to zero, and stop — and what the app has
just done is tell them they failed at something they were never trying to do.

### Nine answers, and the app means all of them

Settings asks the question plainly: **every day**, **weekdays**, **every other
day**, **three times a week**, **twice a week**, **once a week**, **every two
weeks**, **once a month**, or **only when I open it**. First run asks a shorter
version of the same question, before anybody has been asked anything, so a
person who already knows they want a weekly journal never spends a week finding
out the app assumed otherwise.

The choice then reaches everything. The ring on Today counts what today asked
for. The streak counts *weeks*, so a weekly journaler stops seeing "no streak
yet" forever. The queue of questions is drawn from the same set the ring is
counting. A reminder does not fire on an evening when nothing is owed. An
appointment pack from a weekly journal says *22 of 24 weeks kept* rather than
*31 of 168 days*, because the gaps between are the schedule and a document a
clinician is going to read has to be able to say so.

### The period is the unit, not the day

This is the decision the whole thing rests on, and the one that is easy to get
wrong. The naive version of "once a week" picks a weekday and asks on it: your
check-in is Monday, and missing Monday means missing the week. That is a worse
deal than daily, not a gentler one — it takes the one chance you had and puts
it on the day you were busiest.

So **the week owes one check-in**. Monday, Saturday night, it is the same week
and the same kept promise. Named weekdays still exist for the people who want
Mon/Wed/Fri, but they say where the *nudges* land; they never make a Tuesday
check-in count for nothing.

### The best thing a slower journal does is go quiet

Six days out of seven, a weekly journal that has had its week should look like
a journal with nothing owed — not like a journal being ignored. So the check-in
card says it: **Once a week · This week is in. Next from the 31st.** The pips
go away, the breakdown goes away, the ring shows a dash rather than a zero, and
the door still opens, now called *Open today's check-in* rather than *Start*
one.

Without that, choosing "once a week" buys nothing but the daily guilt on a
longer timer.

### And each question can ask less often than the journal does

The pain score is a daily question. The weight is a weekly one. The tape
measure round the waist is monthly, and asking for it every morning is how a
thirty-question setup becomes a fifteen-question setup nobody fills in.

Any question can now carry its own schedule — weekly, twice a week,
fortnightly, monthly — set from the same row in Edit Setup that controls where
it appears. It then drops out of the check-in for the rest of its period and
comes back when the next one opens.

The rule between the two schedules is one line: **a question is asked when the
journal is asking and its own period has not been answered yet.** Not "on
Mondays" — in *this week*, whichever day the check-in happens on.

A quieter question is emphatically not a disabled one. Before this, the only
way to stop being asked for a monthly measurement every day was to switch the
question off, which also took it out of the charts and the export: you deleted
the answer to stop the question. Now it keeps every answer it has, stays on
every chart and in every export, carries a line in Detailed Log saying when it
is next asked, and can be answered early any day you like.

### Time off, said out loud

Every long-running tracker dies in the same fortnight: the one somebody spent
in hospital, or on a beach, or in a stretch where the journal was the last
thing that mattered. They come back to a broken streak and a wall of gaps, and
it feels like starting over.

The journal can be paused — a week, a fortnight, a month, or until you say.
Nothing is due while it runs, nothing counts as missed, the streak steps over
it rather than resetting, and you can still log anything you like.

### The days a period still has room for

"Any day of the week" is a generous promise right up until Thursday, when you
remember you meant to do it on Monday. History now offers the days the current
period still has room for, as a row of chips under today's card — days that
have already passed with nothing on them, each one tap from that day's log.

Never today, which has the card above it. Never tomorrow, because filling in a
day that has not happened is the one thing a journal must not make easy. Never
more than the nearest seven, because twenty chips is a wall rather than an
offer. And gone entirely the moment the period has what it asked for, which on
a weekly journal is most of the time.

### Nothing here scores anybody

A cadence is a plan somebody made, and the new module's only job is to hold the
app to it — never to hold the person to it. There is no compliance percentage
shown to anyone, no red, no "3 missed". The one figure that counts periods
kept exists so a printed pack can explain its own gaps, and it appears nowhere
else.

Everything already logged is untouched by any of it, in both directions: a
journal that goes weekly keeps its daily history, and one that goes back to
daily keeps its weekly history.

### Under it

New module `src/lib/cadence.ts`, fully typed and pure — the period grid,
`dueNow`, `standing`, `cadenceStreak`, `adherence`, per-question `fieldDue` /
`dueKeys`, the preset lists, and `sanitizeCadence`, which degrades a malformed
cadence toward asking *more* often rather than less. `lib/checkin` takes a
`due` set so the ring's denominator is today's questions rather than the whole
template. Both cadences travel in a backup and a sync, and a daily journal
stores nothing at all — absence is the default, so every existing install
behaves exactly as it did.

Tests: 1727 across 68 suites (was 1655/66), including a new `cadence` suite for
the arithmetic and a `cadenceUi` suite for the promise that the choice actually
reaches the screens.

## 1.26.1

The "Again" row was fixed at the wrong layer.

1.26.0 rebuilt how that row was *drawn* — a class collision was dressing its
cards in a dead wizard header's styles, and fixing it turned a row of lozenges
with the names falling out into a tidy row of cards. It still felt wrong,
because how it looked was never the problem. What was in it was.

### It led with things that were already on the screen

The row ranks by how often something is logged. The things anybody logs most
often are the doses they take every day — so the front of it was always the
same three medications, and the Routine checklist that sits a couple of inches
below on the same screen was already showing every one of them, with a better
control on them: a progress count, an "All" button, and a way to adjust the
dose.

So the first two slots — the only two visible without scrolling sideways — were
a worse copy of what was directly underneath them.

### And it hid the things that were not

Everything the row offered that had *no* other home on Today — the weight, the
sleep, the photo of a spot, the note — was ranked behind that duplication and
pushed off the edge of a horizontal scroller. The only part of the row that
justified its existence was the part nobody could see.

### Both halves are gone

**The routine is no longer among the things it offers at all.** That is
enforced in the ranking rather than left to the screen, because there is no
setup in which it is not true: the Routine card renders on Today whenever there
is a routine, and an item with nothing logged against it never reaches this
ranking in the first place.

**And it is a list now, not a rail.** Five rows at most, every one of them on
screen — no arrows, no fade, no ellipsis, nothing behind an edge. A horizontal
scroller is a good answer to "there is more of this than fits", and once the
duplicates were gone this row had the opposite problem: not much of it, and all
of it worth seeing. Each row carries the kind as a tinted medallion, the name
and the detail on one line, and a `+` — and the whole row is the target.

## 1.26.0

Today's check-in.

The most important thing this app does had the worst name in it. Under the
Daily Pulse, in a dashed box, in the app's quietest colour, was a link that said
**Add more detail** — and on the other side of it was the daily check-in: the
set of questions somebody built around their own body, the thing the entire
journal is made of.

Every word of that was wrong. "More" is a quantity, and what is behind the link
is not a quantity. "Detail" is what you add to a form you have already filled
in. "Add" made it a chore, offered to somebody who had just finished one. And
the box it sat in was drawn like a footnote, which is what people treated it as.

### It has its name back, and a state to go with it

It says **Today's check-in**, and it knows how much of today is in.

A ring, filled as far as the day has got, with the count in the middle. One
small mark for every single thing today asked for — a row you can read from the
top of the screen without reading anything, which is the difference between
"four left" as a fact and as a thing somebody finishes. And a line that says
where you are: *6 of 31 in. 25 to go.*

Every mark is derived from the journal rather than from having been here. Tap
the pulse and it moves. Answer a question in the queue and it moves. Tick a dose
off the routine and it moves. Clear an answer and it moves back down. Nothing on
that card is ever the app claiming progress it cannot show you the entry for.

### What a ring in a health journal is allowed to count

The fraction is **what your own setup asked for**: your questions, and the doses
scheduled for today. A skip counts as answered, because the question a routine
row asks is "did you deal with this", not "did you swallow it".

A photo, a note and a meal are shown beside the ring and never inside it. There
is no honest denominator for them — the right number of notes for a Tuesday is
not one, it is however many were worth writing — and counting meals would let a
day with three in it read as more complete than a day with one, which is a claim
about somebody's eating rather than about their journal.

Finished, it says *All 31 answered. Today is fully on the record.* That is a
statement about the record and not about the person. There is no badge, no
score, and no streak counted at anybody: the satisfaction is meant to come from
the same place it comes from on paper, which is that the page is full.

### And today is at the top of History

History used to begin at yesterday. For a journal that is a strange thing to do
— the day you are actually living is the one you most often want to check on,
and *have I done today yet* was a question the record could not answer at all.

Now it opens with today: the same ring, the same numbers, and the breakdown part
by part — *Questions 6/27*, *Routine 0/4*, *Photo —*, *Note —*, *Meals —* —
with the day's own number said beside the name of the thing it measures. Both
screens read the same module, so they cannot disagree about somebody's own day,
and the card is the way in rather than a report about it: tapping it opens the
check-in it was just describing. Today no longer appears twice, either — the
recent list starts at yesterday, because the same day in two places four inches
apart is how two different answers end up on one screen.

### The "Again" row was being dressed by a screen nobody can reach

The row of one-tap repeats on Today looked broken, and it was, for a reason that
had nothing to do with its own markup.

A wizard header from an older first run had claimed the class name `.fhj-rail`
and then outlived the markup that wanted it. The app's one horizontal scroller
claims the same name, and the dead rules sat *after* it in the stylesheet — so
every card in every rail in the app was quietly being handed a wizard step's
clothes: a pill radius, a transparent background, a step's padding. It is also
what stripped the scroll arrows of the card background that is the only thing
separating them from whatever is underneath.

The dead block is gone, and the row was rebuilt on top of that. Every repeat is
now a card the same width as every other one, with the kind of thing it logs
drawn as a tinted medallion outside the sentence rather than as a glyph in the
middle of it — so a dose and a meal are told apart before either name is read.
A long name ends in an ellipsis inside its own border instead of running out of
it, which is what "Hydrocortisone 1%" used to do. The row says once, quietly,
what a tap on it does, because a tap there writes a row in a medical journal.
And the edge fade is now wider than the arrow that sits in it, so the arrow lands
on something faded rather than on a solid card.

## 1.25.0

Sessions that end themselves.

Starting a sun session is one tap on the way out of a door. Ending one is a
chore, and it is the specific kind of chore this app exists to not charge you:
something you have to remember, on the day you feel worst, about a thing you
have already stopped doing.

Unended sessions are not merely missing data. A session that says four hours
because a phone sat on a kitchen counter poisons every average built on top of
it, silently, forever. So the app takes both halves of the problem.

### It is still running when you come back

The session used to live in the sun screen's own memory, which meant it lived
exactly as long as somebody was looking at it — the wrong lifetime for the one
feature in this app whose entire premise is that you put the phone away and go
outside. Lock the screen, check a message, open Today, close the app for an
hour: forty minutes in a garden was gone.

Now it is written to the device on every tick and owned above every screen.
Leave the screen and Today grows a live row with the clock still counting and
one tap back to it. Close the app entirely and it is picked up on the next
launch, however long that was.

It ends when you end it. That is the whole rule.

### Or it ends when you head in

Your phone can tell, roughly, when it stops seeing open sky. A position fix that
resolves to eight metres under the sky reports sixty or ninety under a roof —
the person has not moved, the *sky* has, and the sky is exactly what a sun
session was measuring.

Switch it on and the session closes itself, **at the moment the fixes changed
rather than whenever the app became sure**. That backdating is the difference
between "we ended your session" and "we think you came in at 3:42". Six minutes
of consistent evidence is required before it will act, so a supermarket aisle on
the way home does not end a walk, and a phone that has simply gone quiet is
never read as a roof.

What it reads is **how accurate its own position is — not where you are**. There
is no latitude or longitude anywhere in the model, at any point in a session, on
disk or in memory, and a test asserts the exact shape of what is stored so that
stays true.

### And it asks, once

A session the app ended is saved immediately and marked as the app's own guess.
The next time you look, one card: *It looked like you headed in, so it was
closed at 3:42 — 47 min outside. Is that about right?*

One tap accepts it. A slider corrects it, and correcting it works the dose and
the vitamin D range out again over the new window rather than relabelling the
old one. Ignoring it forever is a valid answer — the session stays on your
timeline and in your charts, permanently labelled an estimate, which is a fine
thing for a health record to contain and a much better outcome than a nag.

Confirming does not clear the label. Agreeing with a guess does not turn it into
a measurement.

### One that was forgotten closes gracefully

Six hours with nobody watching and the session closes at the last time it could
honestly still have been sunlight: the newest moment with the sun above the
horizon, or the cap, whichever came first. A session begun at 8pm and forgotten
closes at sundown, not at 2am — and says out loud that the time is a guess. One
left running into another day is dropped rather than given an invented end,
because a made-up number in a health record is worse than a missing one.

### Settings → Automations

Every automation in the app, one switch each, and under each one the three lines
that make a switch mean anything: what it **watches**, what it **writes**, and
how you **undo** it. Not one "smart features" toggle — that is not one decision,
and bundling it is how consent stops meaning anything.

An automation that cannot run says why, instead of sitting there switched on and
doing nothing. A phone that refuses the app a position is recorded as an
obstruction rather than as a change of mind, so the live screen goes on saying
the automation is wanted and explains what is stopping it.

Nothing any of them does leaves the device.

### The contract, written down

`docs/AUTOMATION.md` is the full map: the five clauses every automation here
obeys, what ships, what is designed and not built — environment, sleep,
adherence, episodes, relationships, the determinants of health — and, more
usefully, the list of automations that were considered and **rejected**. A
stress score. Inferring meals from where you were. Inferring that a dose was
taken. Reading contacts or calendars. Each with the reason.

The short version of all of it: the app may write without being asked, in
exchange for never being able to hide that it did.

### Also

- Sun sessions carry `endSource`, `estimated` and `confirmed`. Sessions written
  before this release read back as confirmed manual finishes, because that is
  what they were, and never appear in the queue of things to confirm.
- 1,616 tests across 65 suites, up from 1,533 across 62.


## 1.24.0

Rituals.

The routine has always been able to answer *what am I taking, and did I take
it*. It is a flat checklist of things and for pills that is exactly right.

It is wrong for a shower.

A shower is not one tick. It is a shower that is cooler and shorter than you
want it to be, then getting out, then the ninety seconds afterwards where the
moisturiser either goes onto damp skin or doesn't work. That last part is the
one that matters and the one that gets dropped, and ticking "showered" records
the half that was never in doubt and loses the half that was. The same is true
of a morning: the pills, the water, the cream, in that order, because two of
them need food and one needs a wet face.

So there is a second shape now. A **ritual** is an ordered list of steps with
one name on it, and a **run** is one day's attempt at it.

### One tap, every day

The row on Today is the whole feature on a normal day. Tap it and the ritual is
done — all of it, in one write, with an Undo in the toast. Tap it again and it
is undone. There is no form, no confirmation and no step-by-step unless you ask
for one, because a five-step ritual that costs five taps on an ordinary Tuesday
is a ritual that gets abandoned in a fortnight, and a fortnight of data is worth
nothing.

Beside the name: how many steps, which part of the day, the streak if there is
one, and seven dots for the week behind it. The dots are the same seven dots
everywhere they appear, meaning the same seven things — done, part-way, skipped
on purpose, missed, and *never asked for*, which is drawn as a gap rather than a
failure because a weekday-only ritual has not missed a Saturday.

### The player, for the days you want the process

The second control on the row opens it as a list of very large steps — taller
than anything else in the app, because this is a surface people tap standing up,
half awake, with one wet hand. Exactly one step is lit as the next one, and the
light moves as you tick. Steps carry their reason in a few words underneath
("damp skin holds it; dry skin doesn't"), and the ones that are really
instructions with a number in them carry a timer you can start and ignore.

Done steps stay in the list and recede rather than vanishing, so the ritual
keeps teaching itself.

A step can point at something in your routine. Ticking "Vitamin D3" inside
Morning meds writes the dose into your medication history exactly as the routine
checklist would, so there is one surface and two records rather than two places
to write the same fact down.

### Six of them are already written out

Shower & after · Morning meds · Night meds & supplements · Wind-down · Morning
skin · Move a bit. Steps, hints and all. The two medication ones fill themselves
in from the routine you already keep — pick "Morning meds" and every item filed
under Morning is already a step in it, carrying its dose.

### The weekly tune-up, and the reason it has arithmetic behind it

Once a week the app asks how one ritual is going. This is the part that is easy
to build badly, so here is the failure it was built around:

Somebody sets up four rituals on a Sunday afternoon, because Sunday afternoon is
when people set things up. A naive weekly check-in gives all four the same
anniversary. A week later they get four dialogs in a row. The week after that,
four more. By the third Sunday the feature is off.

Five rules make that impossible.

- **Each ritual gets its own weekday.** The first takes today's; the second goes
  as far from it as the week allows; the third takes the widest gap left. Seven
  rituals occupy seven different days before any day is used twice.
- **One a week per ritual**, on or after its own day — and it waits rather than
  being lost if the app isn't opened that day.
- **Never two within two days of each other**, whatever their own days say. Even
  a pathological setup can only surface one tune-up every other day.
- **Never before there is something to say.** A ritual younger than a week, or
  with fewer than three days of history, is not reviewed at all. The first
  tune-up anybody sees has a real week behind it.
- **"Not now" costs two days, not a week.** Dismissing one must not quietly
  switch the feature off.

It also only ever appears on Today, never over the export screen or a report.

### What the tune-up actually does

It opens with the week you had, not with a question: seven dots landing one at a
time, the count, the streak, and one line that does not pretend a hard week was
a good one. Somebody who managed two showers in seven days knows it, and being
congratulated for it is how an app loses their trust.

Then two questions, each answered with one tap — five faces for how it went, and
what got in the way, which is skipped entirely on a week nothing got in the way
of.

Then it pays out. The last card is a short list of **changes to your plan,
written from your own week**, any of which is applied by tapping it:

> 🪶 Make "Moisturise within 3 minutes" optional — *2 of 7 days*
> ✂️ Drop "Any treatment cream last" — *not once this week*
> 🕰️ Move it to bedtime — *you usually finish around 9:55 pm*
> 📆 Stop asking on Wednesday — *not once in four weeks*
> 👌 It's good — leave it

"Leave it" is a real answer and it is listed *first* on a week that went well,
because the most common right answer to "change anything?" is no, and burying
that under three suggestions is an app talking somebody into editing a routine
that was working.

Applying one can never leave a ritual asked for on no day at all — that is a
deletion wearing a schedule change, and nobody chose it.

### A run is a record

The same contract the routine has kept since it shipped. A run carries its own
copy of the name and of how many steps were required at the moment it happened,
so dropping a step tomorrow cannot un-complete a fortnight. A tune-up that trims
one step changes what today asks for and nothing about what last Tuesday says.

An absent run means nothing was said. It is not a missed day. "Not today" is its
own thing, recorded as its own thing.

### Everywhere else

Two new sheets in the spreadsheet: the plan, and one row per ritual per day.
The day sheet has a column the others don't — `step_list` names the steps
actually done rather than counting them, because "showered 18 of 21 days" is a
number anybody could have guessed and "moisturised on 9 of the 18 days I
showered" is the thing that explains a month of skin.

Two new things to chart, both neutral in direction, because there is no healthy
number of showers and colouring a quiet week red would be this app grading
somebody's life.

Rituals are in the fan, in backups, and repaired on every load like every other
collection.

### Also fixed

Restoring a backup silently dropped every sun session, lab result, experiment
and day of weather. They were being written into the file correctly and thrown
away on the way back in. A backup that cannot restore what it saved is not a
backup.

## 1.23.0

One hand.

The app was built phone-first and it showed everywhere except in the *reach*.
A 6.7" phone held in one hand gives a thumb an arc that starts at the bottom
corner nearest the palm and sweeps about two thirds of the way up the far
edge. Everything outside that arc — the back arrow in the top left, the gear
in the top right, the top half of any long screen — is a two-handed
instruction wearing a one-handed interface.

That is a real cost here rather than a stylistic one. This is a journal
somebody opens while holding a coffee, a child, a shopping bag, or a steering
wheel at a red light, and most often on the days they feel worst. A surface
that quietly requires the second hand is a surface that gets skipped, and a
day that gets skipped is a day missing from the chart they eventually take to
an appointment.

### Back finally means something

`screen` was one string, so every "back" in the app was a guess: the header
arrow went to Today from wherever you were. Export → Appointment Pack → back
landed two screens away from what you were reading. History → Sun → back
forgot History had ever happened.

There is now a real navigation stack, with Today as its floor. Back returns
you to the screen you opened a thing *from*, it says so in words — "Back to
History", not a bare arrow — and it is in four places at once: on the bar
under your thumb, in the header where it always was, on either side edge as a
gesture, and on the phone's own back button, which now means what the app's
Back means instead of leaving the app.

### The fan

Hold the **+**, slide, let go. Every destination in the app arcs out from the
corner your thumb is already in — Today, the daily log, History, Insights, the
diary, sun, labs, experiments, your routine, photos, export, settings — and
the one under your thumb lights up as you cross it. Let go and it opens. Let
go without moving and the fan stays open to be tapped, because a menu that
vanishes when you hesitate is a menu you stop trusting.

It is a radial menu because a radial menu asks for a *direction* rather than a
position, which is the one shape of control that survives being used without
looking at it.

Nothing about the arc is a fixed number. Each ring is asked how many items its
own arc length can hold, the fewest rings that can hold everything wins, and
the items are shared out in proportion to what each ring can take — so a 320px
phone gets three close rings and a tablet gets two, capped at a thumb's reach
rather than flung across the page. The top third of the screen, which the fan
deliberately never uses because none of it is reachable, reads back what the
thumb is resting on in the app's display face.

### Swipe back, and pull the screen down to you

Drag in from either side edge and the screen peels off under your thumb,
scaling and dimming as it goes, with a puck at the edge that fills as you
cross the point where letting go would complete it. Let go short and it
springs back. You can tell what is going to happen the whole way, which is the
difference between a gesture and a gamble.

And when something *is* at the top of a long screen — a title, a range
switcher, the gear — pull down on the + and the whole page slides into the
thumb arc. The bar does not move, because the bar is the one thing that must
never slide out from under the hand steering it. Tap anywhere in the gap to
put it back.

### Which hand

Right, unless you say otherwise, in the appearance controls or in the fan
itself. It moves the +, the fan's pivot, the Back pill and the edge the
gesture is tuned for. It is stored per device rather than in the journal —
which hand you hold *this* phone in is a fact about the phone — so it works in
the read-only viewer and before there is a profile to write to.

### The bar

Today · History · **+**, and the three never swap places. An earlier version
of this morphed the left slot into Back on inner screens; it read well in a
screenshot and was wrong in the hand, because the entire value of a
three-button bar to a thumb is that the thumb stops needing to look. Back is a
fourth thing in its own place above them. The + moved from the middle to the
end, on the held side: that corner is where a thumb rests, and it is the point
the fan pivots on — the two used to be a hundred pixels apart, so the slide
that chose an item was a slide relative to a point the thumb was not on.

Tapping the tab you are already on returns to the top of it.

### Everything else, quieter

Screens now arrive from the direction you travelled, so coming back does not
look like going deeper. Sheets arrive on the spring curve rather than an
ease-out and the scrim blurs eight pixels instead of three, which puts the
page *behind* the sheet rather than merely darkening it. The bar is frosted so
the journal keeps moving underneath it. The + breathes once every six and a
half seconds at four percent opacity — enough to say it is live, under the
threshold where a moving thing on a health screen becomes something you have
to ignore. All of it is a no-op under `prefers-reduced-motion`.

One line above the bar says the fan exists, until it has been used once.

### Under it

`src/lib/oneHanded.ts` holds all of it that can be reasoned about without a
browser: the stack, the arc geometry, the ring planner, the gesture
thresholds, which hand, and the system-back wiring.
`src/components/ThumbNav.tsx` is the bar, the fan and the edge gesture.
Tests: 1,341 across 55 suites — 36 new pure tests for the geometry and the
stack, 17 driving the whole thing through the real app.

## 1.22.0

One row that could not be scrolled, one question that was never asked, an hour
of typing nobody was ever going to do — and one promise this app had outgrown.

### The promise, said honestly

"Everything stays on your device" is gone from this app, because with any of
four switches on it was not true.

It was very nearly true, which is the problem: a privacy claim is worth exactly
as much as its worst case, and a claim that holds 95% of the time is worth less
than a shorter one that always does. Sync uploads an encrypted journal. AI
observations send a summary of your numbers. Daily context asks for the
weather. And now importing your own notes sends the notes. All four are off
until somebody turns them on, and all four say what they are sending before
they send it — which is a better promise than the one it replaces, and this
release is where the app starts making it instead.

So the first screen's list of checkable facts now names the four things that
*can* leave rather than claiming nothing does. The privacy card in Settings
already rewrote itself as switches changed; it now has a sentence for AI that
names both things AI can send, and no longer signs off with "everything else
still stays on this device". "Photos are never uploaded" is gone too — it had
been untrue since AI auto-fill shipped, and now reads as what it is: photos
stay here unless you hand one over yourself.

Nothing about the defaults changed. Out of the box the app still makes no
network requests at all after it loads.

### The Again row scrolls

The shortest path in the app was reachable only by people holding a phone.

**Again** is the row under Quick Add: the foods you log over and over, the
doses you take daily, the spot you photograph, the number you record — ranked
against each other so it is your own week in your own order, one tap each. It
was a bare `overflow-x: auto` row with the app's global stylesheet hiding every
scrollbar, and this app runs Lenis on the document scroller. Which means that
on a desktop a vertical wheel over the chips scrolled the *page*, a horizontal
one was swallowed by the smooth-scroll driver before the browser ever saw it,
and a mouse without a tilt wheel had no gesture at all. The chips past the
fourth were visible, cut off at the edge, and unreachable. On a phone it
flicked, which is why it lasted this long.

The metric picker on Insights had solved exactly this a release ago, so its
rail has been lifted out into `components/Rail.tsx` and is now the only
horizontal scroller this app is allowed to have. A vertical wheel over the row
scrolls the row — and stops claiming the gesture the moment the row runs out,
so the end of the chips is not the end of the page. A horizontal one is stopped
before it reaches Lenis, which is what stops the page moving sideways
underneath it. Arrow buttons appear on pointer devices at whichever edge still
has something behind it, and are hidden on touch where they would only cover
two chips. ←/→/Home/End walk the row, and focus always scrolls its own chip
into view. The edge fade is per-edge and conditional now: a row of three chips
that fits is no longer drawn as a row that has been cut.

### The Again row scrolls

The shortest path in the app was reachable only by people holding a phone.

**Again** is the row under Quick Add: the foods you log over and over, the
doses you take daily, the spot you photograph, the number you record — ranked
against each other so it is your own week in your own order, one tap each. It
was a bare `overflow-x: auto` row with the app's global stylesheet hiding every
scrollbar, and this app runs Lenis on the document scroller. Which means that
on a desktop a vertical wheel over the chips scrolled the *page*, a horizontal
one was swallowed by the smooth-scroll driver before the browser ever saw it,
and a mouse without a tilt wheel had no gesture at all. The chips past the
fourth were visible, cut off at the edge, and unreachable. On a phone it
flicked, which is why it lasted this long.

The metric picker on Insights had solved exactly this a release ago, so its
rail has been lifted out into `components/Rail.tsx` and is now the only
horizontal scroller this app is allowed to have. A vertical wheel over the row
scrolls the row — and stops claiming the gesture the moment the row runs out,
so the end of the chips is not the end of the page. A horizontal one is stopped
before it reaches Lenis, which is what stops the page moving sideways
underneath it. Arrow buttons appear on pointer devices at whichever edge still
has something behind it, and are hidden on touch where they would only cover
two chips. ←/→/Home/End walk the row, and focus always scrolls its own chip
into view. The edge fade is per-edge and conditional now: a row of three chips
that fits is no longer drawn as a row that has been cut.

### One tap, then the next most important question

Answering the Daily Pulse used to be the end of the easy path. Everything else
lived behind *Add more detail*, which opens the survey — a screen, a scroll,
forty fields and a Back button — or behind a row of chips. And a chip row is a
*menu*: it shows what could be answered and hands the choosing back. Choosing
is work, and at eleven questions it is most of the work.

So the pulse now hands straight over to a **queue**, and asks the front of it.

One question. The app's own input for it. The tap is the save, the question
leaves the queue, and the next one takes its place — which means the whole
daily review can be done from the first card of the first screen, at the speed
of tapping, without a form ever opening. A progress line says how much is left
(*4 of 12 answered*, with the pulse counted as one of them, because it is one),
so it is a finishable thing rather than an open-ended demand.

What it asks first is decided by three things in order: what your packs are
about, what kind of day you have just said it is, and **what you actually
record**. That last one is new and it is the point — somebody who fills in
their weight every morning and has never once touched "possible triggers"
should be asked for the weight, whatever the template thinks. A habit lifts a
question up to ten places, so a question you answer every day can reach the
front from anywhere and one you have never answered stays exactly where the
pack put it. On a brand-new journal every habit is zero and the order is the
pack's alone.

Two rules keep it an offer rather than a wall. **It never advances out from
under an answer** — a scale, a yes/no and a single choice are finished by the
tap, so those move on by themselves; a number or a multi-select waits for
*Next*, because snatching a field away mid-keystroke is the app racing its
user. **It is always leaveable** — *Skip this one* moves past, *Done for now*
closes the queue for the sitting, and neither is remembered. Tomorrow it asks
again, because a journal that permanently stops asking on the strength of one
impatient tap has quietly started deciding what its owner tracks.

The chips underneath are now only the three things a question cannot be: the
routine still owed, the camera, and the note. The same question in two places
was one place too many.

### Import your own notes

Everybody who tracks anything seriously was already tracking it before they
found this app. It is in a notes file, a chat with themselves, a photo of a
page, and it looks like this:

    8.21 weight 12pm 182
    8.21 food, 2.5 hamburger, havarti cheese
    2acv premeal + 2 pepsin combo 12:30pm
    8.21 4pm bowel movement, small firm sank
    8.21 Trazo 50mg STARTING NEW MED. Day 1

Every one of those lines is a row this app already has a shape for. Typing them
in one at a time, through the right sheet, on the right date, is an hour of
work — which is why nobody does it, and why a journal that could have started
in March starts today with nothing behind it.

**Import notes** takes a paste or a screenshot and reads it into meals, doses,
numbers, bowel entries and notes, **on the dates and times the notes themselves
give**. Shorthand resolves against today; a line with no date of its own
belongs to the line above it; a time is only set when the note actually gives
one. A dose matches something already in your routine where it can, and creates
it where it cannot.

It needs the optional AI, and it is the only feature in the app that does —
reading `2acv premeal + 2 pepsin combo 12:30pm` as two of one thing and two of
another at half past twelve on the 21st is not something parsing rules get to.

Three steps, and the shape of them is the entire safety argument.

**Hand it over**, by whatever is nearest to hand. Paste the text. Ctrl+V a
screenshot straight into the box — on a desktop that is where the notes already
are, one keystroke after the snip, and making somebody save a file first would
put the whole feature's friction back. Drop files anywhere on the screen, image
or `.txt`, and a text file is appended to the box rather than making you open
it and copy it out. Up to four screenshots at a time, sent as **one continuous
document in order**, because a chat with yourself is four screenshots and a
date at the top of the second governs the lines under it in the third.

**See what goes.** This is the one path in this app that sends prose, and it is
not going to be coy about it. Every other outbound path is built to send as
little as possible — the pattern analysis reduces the journal to numbers
precisely so free text never leaves. This one cannot: the words *are* the
input. So nothing goes until a sheet listing the entire payload has been read
and accepted, every single time. It counts the characters, says whether an
image is going, and names the structural things riding along — your question
names, your routine names, today's date. No photos from your journal, no
answers already recorded, no name, nothing about the device.

**Approve what lands.** Every proposed row, grouped by the day it would go on,
next to the exact words it was read from — because a wrong reading is obvious
the instant it sits beside what it claims to be a reading of. A line at the top
says what was found (*1 answer, 1 meal, 1 bowel entry, 1 dose and 1 note, on 2
days*). Each day switches off in one tap and back on in another. Each row's date
is correctable on the row. Only the rows the model was genuinely unsure of are
flagged, because a badge on every row is a badge on nothing — what it assumed
is said in words underneath instead. Then one button writes what is left, with
an Undo in the toast and a link straight to the earliest day it just filled in,
which is the moment the whole thing pays out.

The model never writes. `applyImport` is a pure function of the rows somebody
approved and has never heard of a model, and `normaliseImportPlan` is the
boundary in front of it: an answer to a question this journal does not ask, a
value of the wrong type, a routine id that does not exist, a date in the future
or three years adrift, a caveat that strayed into diagnosis — each is dropped
rather than repaired, because a row whose provenance nobody can explain has no
business in a medical record.

Three more things it is careful about. It **never overwrites** an answer
somebody gave themselves. It **never doubles up** — importing the same notes
twice is what everybody does, because the first run is a test, and a meal, dose
or movement matching one already on that date and time is left alone. And a
routine item invented from a note is created **as-needed, never daily**: a line
saying somebody took something once is not a line saying the checklist should
start chasing them for it every morning.

The prompt's own hardest rule is that it is a transcriber and a filing clerk,
not an editor: copy the person's words, never rewrite, summarise, correct,
tidy or improve them. Their spelling of a medication is their spelling. This is
a record, not a draft.

And it is offered where somebody will actually find it. A journal in its first
fortnight gets the offer **on Today**, under the day — that is the week it is
worth doing, and nobody in their first week goes hunting through menus for a
feature they don't know exists. It retires itself after fourteen logged days
whether or not anybody dismissed it, "Not for me" sends it away for good, and
when AI is off the card says so in its own copy and its button goes to
Settings. An offer that quietly turns into a setup screen is a bait, and this
app does not have any of those.

## 1.21.0

Four things a journal cannot get from asking questions, and one seam that makes
them a single product rather than four features.

### The day around the day

A journal that only holds what somebody typed is missing the half of their life
that happened to them. It was 34°C. The pressure dropped eleven hectopascals
overnight. The pollen was the highest it had been all spring. None of that is
anybody's fault, none of it is worth a daily question, and all of it is exactly
the sort of thing that turns up in a chart six months later and explains a
fortnight nobody could account for.

So, with permission, every day now gets a context record attached: temperature,
humidity, barometric pressure **and its change**, weather, UV index, sunrise and
sunset, daylight duration, air quality, PM2.5 and PM10, and pollen where it is
published. It comes from Open-Meteo, which needs no account and no key.

Three rules shape it, and they are the whole design.

**Ask once, plainly, and mean it.** This is the only switch in the app that
turns on an automatic outbound request. It is off until somebody turns it on,
the settings card says exactly what is sent and what comes back in a list
somebody could check against a network tab, and turning it off stops the
requests on the next render. There is no queue to drain.

**Store the weather, not the person's movements.** Coordinates are rounded to
two decimal places — about a kilometre — *before* anything is written down or
sent, in one function, once, so there is a single place to check. What is kept
per day is a reading of the sky. There is no location history here, and the
export column is called `latitude_coarse` because that is all there ever was.

**Invisible until it is meaningful.** Context is not a weather app bolted onto a
health app. It sits behind a day as a wash whose colour comes from the
temperature and whose *loudness* comes from how far that day sat from this
journal's own middle — so an ordinary day is nearly invisible and a 34°C one is
not, and the same code reads correctly in Reykjavík and in Phoenix. Above the
recent days, a temperature trace: highs, lows, and the day you are looking at.

And when it has something to say, it says it as a count of somebody's own days.
*8 of your 10 hardest days were above 29°C.* Never a coefficient, never below
twenty days of overlap, and never a cause — the vocabulary lives in one module
so the causal-language audit can read every phrase it can produce.

### Sun & Outdoor Light

One tap: **Start sun session**. What opens is drawn from the sun's own
arithmetic rather than from a stock illustration. The curve is the actual solar
elevation at that latitude on that date, sampled every ten minutes; the shaded
band under it is the stretch where there is enough UVB for synthesis to be
plausible; the thicker overlay is the part of it spent outside; the disc is
where the sun is now. Which means it looks flat and bandless in December,
because December *is* flat and bandless — and at 69°N in midwinter it says the
sun does not rise, rather than printing NaN o'clock.

Running alongside: a stopwatch legible from across a garden, live UV index
(a forecast value where there is one, a modelled clear-sky value otherwise, and
the screen says which), the sun's height and bearing, minutes outside, ambient
UV dose in SED, and the estimate.

**Estimated vitamin D — ~1,800–2,600 IU — research-model estimate · not a
measurement.** Personalised on UV over the actual session, latitude, date and
time, skin type, age, exposed body area, clothing, sunscreen, shade and
duration. It is a range because the honest width of this estimate is much
larger than any point value implies, the assumptions behind it are listed in
full one tap away, and it is dressed as an estimate everywhere it appears —
including in the spreadsheet, where the column is called
`vitamin_d_estimated_iu_low` and the one beside it is called
`vitamin_d_estimate_is_a_model_not_a_measurement`. A blood test measures
vitamin D. This does not.

The model plateaus rather than climbing: past roughly one minimal erythemal
dose, skin stops making more and starts breaking down what it has, and an app
whose number keeps rising is quietly telling somebody a longer burn is a bigger
benefit. Beside the estimate runs the burn scale — the only element on the
screen allowed to change colour, because it is the only thing that can go
wrong — and the atmosphere behind the whole screen warms with it.

Also tracked: outdoor light minutes, ambient UV dose, first outdoor light after
waking (a circadian number, deliberately kept away from anything about vitamin
D, because at 8am there is essentially no UVB to claim), the best upcoming
sunlight window, and the next likely vitamin-D-producing window — which
correctly answers "none in the next week" in a British January instead of
inventing one.

### Personal experiments

*Does morning sunlight relate to better sleep? Does humidity line up with my
eczema? Did anything change after I started this cream?* Every one of those is
answerable from data the app already has, and every one of them is ordinarily
answered by scrolling back through six weeks of entries and guessing.

An experiment is a factor, an outcome, a lag and a way of splitting the days in
two. The app builds the smallest one that could answer the question, from a
starter list of real questions in plain words, from its own suggestions, or from
a picker that can put *anything against anything* — a symptom against the
pollen count, a meal against the next morning, a lab value against a season.

The split is chosen from the values the person actually logged, and the one
picked is whichever leaves the two halves closest in size. That is not the
same as the median, and the difference matters: a factor people really track
is rarely a smooth spread — it is nine glasses of water on the days you
remember and two on the days you don't, often eighty of the first and forty of
the second. The median of *that* is nine, so a strict "above the line" test
puts all hundred and twenty days below it and compares them against nothing.
Fifty days with two above the line is also two days of evidence wearing fifty
days' clothing, so the ladder grades on the smaller half. And a factor that
never varies cannot be split at all — the card says so and stays collecting,
rather than reporting a comparison with an empty side.

And nothing is reported until that ladder says so. **Collecting** is a progress
bar and a count — not a result with a caveat on it, because a sentence with a
caveat is still a sentence somebody will remember. Then **Emerging**: *something
may be forming*. Then **Useful**: *on days with 15 min+ time outside, your sleep
quality has averaged 0.9 points higher.* Then **Well established in your
journal**, which needs ninety paired days across three separate months.

Underneath, every paired day is a dot, placed by its own two values and split at
the threshold, with each half's average drawn as the level its dots sit around.
Two clouds at different heights *is* the finding. Overlapping clouds is the null
result — and the app draws it the same way, in the same ink, because it is not
more excited about a positive.

### Evidence, everywhere, on one ladder

One module now decides what "strong" means, so *Useful* on an experiment card
and *Useful* on an insight are the same claim about the same kind of evidence.
Four rungs, counted in paired days, spread across weeks and months — a burst of
forty days from one fortnight is capped at Emerging however clean it looks,
because that is one fortnight of somebody's life.

No confidence percentages. A percentage is a promise about a population, and
this app has a sample size of one and no control group. What it can honestly
say is how many paired days there are, how they are spread, and what is missing
— and **Why am I seeing this?** opens exactly that: usable observations, days
missing one side, the comparison window, how the days were split, consistency,
the lag used, and the limitations, which include the three standing ones that
are true of every finding this app can ever make.

### Labs & measurements

Vitamin D, ferritin, HbA1c, TSH, B12, cholesterol, blood pressure, weight, or
anything at all with a name and a number. Each result carries its test, value,
unit, date and time, **the reference range the laboratory printed**, fasting
status, provider, a note and optionally a photo of the report.

That range is the point. Ranges differ between laboratories, between assays and
between countries, and an app that substitutes its own for the one on the report
is telling somebody their result is abnormal on the strength of a constant in a
file. So the range travels on the record, the catalog's is offered as a prefill
that says whose it is, and a result recorded without one gets **no band, no
colour and no verdict**.

The screen is built around one idea: a new value arrives into its own history.
The segment reaches back from the previous reading to the new one, the delta
counts up beside it — *38 ng/mL, up 14 over 92 days* — and under the line, the
band fills in with what else the journal held during that gap: ☀ time outside
increased, ◍ a supplement started, ▲ a flare, ❈ the season turned, → days
recorded somewhere else. With, in as many words, the line that says this is a
memory aid and not an explanation.

And where the test is 25(OH)D, the measured blood level sits beside the
estimated production from sunlight over the eight weeks before the draw — two
panels, two units, two headings, one solid border and one dashed. Never one
axis.

### They talk to each other

Tap a coincidence on Insights, an experiment's half, "light these days up" under
the dots, a lab period, or a flare, and *those exact days* light up — in
History, which reorders itself to show them, in the temperature trace behind
them, and in the thirty-day sun history. One set of days, one banner naming what
lit them, one Clear, surviving navigation between screens.

Sunlight is experiment data. Weather is context on every day. Labs are timeline
events with the journal drawn underneath them. Flares shade the charts and can
illuminate their own fortnight. Experiments can compare a lab value against the
weather. It is one connected memory rather than five new features.

### And on paper

The appointment pack gains two sections, in the order the conversation runs in:
**Measurements**, with each test's series, the laboratory's own range and
whether the latest reading sits inside it, and **Time outside**, with total
daylight, the average on a day outside, and the estimate printed as an estimate
in its own row with the sentence that keeps it apart from a blood result.
Exports gain three sheets — Measurements, Time outside and Weather — each named
so a spreadsheet opened in two years still says which numbers somebody measured
and which this app modelled.

### The buttons stay where you put them

Quick Add used to sort itself. Tap food four times a day and the Food button
climbed to the front; leave the camera alone for a fortnight and it sank. On
paper that is the app being helpful. In the hand it is the app moving the
furniture, because the entire value of a button on a phone is that after a week
the thumb goes there without the eyes — and a row that quietly rearranges
itself overnight spends that every single time it guesses right. A miss costs a
wrong entry to undo, and it costs somebody the feeling that they know their own
screen.

So the order holds still. Every button is where it was yesterday, on the
dashboard and behind the **+**, which show the same list and now the same
arrangement.

Moving one is a gesture rather than a trip to a settings screen: **hold a
button and drag it.** A third of a second under the finger and it lifts —
heavier shadow, a degree of tilt, one tick from the haptic motor — and from
there the row is something you are rearranging rather than something you are
pressing. The others slide out of the way, a dashed gap follows your thumb, and
letting go drops it in and saves. A tile crossing from the end of one row to
the start of the next travels a real diagonal. The drop is not also a press:
the tap that would otherwise fire underneath it is swallowed.

Three refusals hold the gesture together. A finger that has moved ten pixels
before the hold completes is scrolling the page and gets its gesture back
untouched — the row covers half the screen and a dashboard that eats a swipe is
broken in a way people do not forgive. A hold against a layout that has changed
underneath stays a tap, because a half-drag against stale geometry would move a
button nobody asked to move. And the frame that writes down the new order has
every transition switched off, so the instant the app commits is the one
instant nothing moves.

It is not a pointer-only feature: **Alt with an arrow key** moves whichever
button has focus — left and right by one, up and down by a whole row — the
editor still lists them all with arrows beside them, and every tile carries a
description saying so. Each landing is announced.

Learning still exists for anybody who wants it, as one switch in the editor
rather than as the default. A journal that has been learning for months keeps
the arrangement it has: it is frozen exactly as it stands on the way through
the update, so the first launch after looks identical to the last launch
before, and stays that way.

### Under it

Seven new typed modules, none of which read a clock: `solar` (NOAA solar
position, sunrise/sunset, daylight, clear-sky UV, minimal erythemal dose,
vitamin D synthesis), `sun` (sessions, live accumulation, daily aggregates,
metrics), `context` (consent, coarse location, fetching, parsing, observations),
`labs` (catalog, unit conversion, series, reference ranges, what-else-happened),
`experiments` (pairing, splitting, suggesting), `evidence` (the one ladder), and
`series` (the seam that lets any of them be compared against any other) — plus
`dragOrder`, which holds the whole of the hold-and-drag arithmetic: which slot a
thumb is over (nearest centre, with enough stickiness that a thumb on a boundary
does not make the row flicker), how far every other tile has to travel, and how
a rearranged screen is folded back into a saved list that may hold buttons this
device cannot show — so a rearrangement can never delete a button nobody could
see.

New collections in the journal — `sun`, `labs`, `experiments`, `context` — each
sanitised on every load like everything before them, each carried in backups and
exports, and each validated well enough that the recovery screen can say what
was wrong rather than quietly dropping them.

**256 new tests. 1,311 across 55 suites, all green.**

## 1.20.0

### The first run knows who it is for

The app opened by asking what was wrong with you and never once asked who you
were. Every export, every printed summary and every appointment pack came out
anonymous — a page of ratings a clinician has to be told the owner of — and
every morning the app said "Good morning" to nobody in particular.

So there is a screen between the hero and the questions now, and it is
deliberately not numbered: a step count would turn a welcome into a
registration form, which is the thing this app exists to not be. It asks two
things and refuses to nag about either.

**Your name**, set at headline size, with the consequence quoted back as you
type it: *Every morning, this app will open with "Good morning, Sam."* It
does, from the next screen onward — the greeting on Today, the heading on the
screen where your journal is born, the pack you hand to a doctor.

**Your age**, on a ruler rather than a number pad, with the year you were born
printed under it — because that is what actually gets written down. An age
typed once and stored as a number is a wrong number three years later on the
one document whose entire job is to be handed to a clinician.

Underneath both, the argument for answering, drawn rather than promised: the
header of an appointment pack with your name and age filling into it. And
underneath *that*, a **Skip this — I'd rather not say** button that clears both
and never mentions it again. Nothing here is greyed out until you comply.
Both are editable in Edit Setup, and both are printed on appointment packs,
weekly and monthly summaries, and the Profile sheet of every export.

### You can see the survey you are signing up for

Most people have never designed a survey, and the words for the parts of one
are worse than useless to somebody trying to describe their own body. The
question list used to say "yes / no" in small grey type under each row, which
is a label *about* a control rather than the control.

Every question is now drawn with the answer it will actually take: ten rungs
for a 1–10, a Yes beside a No, a box with a number in it, three lines for a few
words. Nobody has to be told what a yes/no question is once the Yes and the No
are sitting on the row.

Above the list, the same four shapes are a **lens**: *Everything · 1–10 · Yes /
no · Numbers & words*, each with a live count of how many of that kind are
switched on. "Six 1–10s and four yes/nos" is a survey somebody understands; a
list of forty rows is not. Tapping one narrows the list to that kind — which is
how somebody who came here to add three yes/no questions finds the eleven that
already exist — and narrows only what is *shown*, never what is kept.

And **See it as it'll look** prints the whole check-in as it will be answered
tomorrow morning: your questions, in order, with the real controls at the size
you will tap them, and the honest seconds-a-day at the foot. A question of your
own is drawn the same way while you write it, so choosing "Yes / no" for it is
a thing you can see rather than a word you have to trust.

### Photos ask what they are of

Photos used to be one tick in a list of six, and then the app guessed what they
were of: a body map if your pack looked like skin, a single front-on progress
shot if it did not. Both guesses are wrong for most people. Somebody with IBS
wants a picture of the plate. Somebody starting a new cream wants the
ingredient list on the tub. Somebody whose ankle swells wants the ankle. None
of them were ever going to find that behind a switch labelled *Photos*.

So photos are their own act, and the question is *what*: specific body areas
off the tappable map, flare-ups as they happen, progress shots (front, side,
back), meals, products and labels, swelling, wounds and healing, or anything
worth a picture. Each subject becomes a real photo question with its own
baseline, so every shot lines up against the last one **of the same thing** —
and each knows whether to ask for a 1–10 afterwards, which a flare wants and a
plate of food does not.

As you pick, a contact sheet of labelled empty frames assembles underneath —
the same argument the last act makes with an empty timeline: show the shape of
the thing before there is anything in it. Wanting no photos at all is a
first-class answer the screen says out loud, and it is honoured: no camera
button appears on a journal with nothing to point it at.

## 1.19.0

### Quick Add is shaped like your condition

Four buttons — check-in, food, bowel, photo — were the right default for
nobody. Somebody tracking POTS has no use for a bowel tile and would give a
great deal for a heart rate and a glass of water; somebody tracking eczema
wants a camera, a cream and a way to say *this week is bad*; somebody tracking
a gut condition wants the bathroom first and would rather not be asked to
photograph anything.

So there are fourteen buttons now, and which of them you start with comes from
what you said you were tracking. The new ones:

- **Flare** starts a bad stretch today and then reads *End flare · day 6* until
  you end it. The arithmetic — how often, how long, how bad, more than last
  year — was already in the app; it just took four taps through Insights to
  begin one.
- **Symptom** rates one question 1–10 and closes. Itch at 3pm and itch at 11pm
  are different facts, and the honest response to noticing one should not be a
  survey you already answered this morning.
- **Heart rate** takes lying and standing and prints the jump between them,
  with the sentence somebody with POTS would otherwise write in the note field
  every single time. A record of what you measured, not a diagnosis.
- **Water** is one tap and one cup, written straight to today with an Undo in
  the toast. No sheet, because "one more" is not a decision.
- **Trigger** tags what may have set today off, while you still remember. The
  check-in asks this at bedtime, which is exactly when nobody can remember it.
- **Note** and **Measurement** came down from the + sheet, where they had been
  living alone.

A button only ever appears when your own setup has a question behind it: no
water question, no water button. Add one in Edit Setup and it turns up. The
editor now leads with the buttons your conditions reach for, so the first thing
you see there is a suggestion rather than a list of everything.

### The + button shows what you chose

The sheet behind the + had its own fixed list of seven, which meant the app
held two different opinions about what a day can hold: the tiles you arranged,
and this. Somebody who had switched Bowel off still got it here; somebody who
had added Heart rate did not.

One list now, honoured in both places. Everything else the app can still do is
under *Everything else* at the foot of the sheet, and *Edit these buttons* is
next to it — which is what makes curating the row safe rather than lossy.

### First run guides you through the whole thing

The first run got you to a real first entry in thirty seconds and then left
you to discover the rest, with a "set everything up in detail instead" link
beside it for anybody who wanted more. That link was an admission: it said the
fast path was the cheap one and the real setup was somewhere else, and it made
the person who most needed help choose, on screen two, between being rushed and
being buried.

It is one path now, and two screens longer:

**What should it ask you?** Your daily check-in, already set up from the packs
you picked, with the honest cost of it in the largest number on the screen —
*14 questions, about 50 seconds a day* — changing as you switch one on or off.
Quick, Balanced and Thorough are one tap each. Sections fold. The daily number
is locked on, because a journal without one is not one. And *ask me something
of my own* takes a question in your own words, as a 1–10, a yes/no or a number.

**What else should it keep?** Photos — with the body map for the areas you want
lined up over time — meds and creams, meals, flares, the bathroom, weight. Each
one you tick draws itself into the row of one-tap buttons underneath, so the
dashboard assembles in front of you out of your own answers instead of being
filed away to be discovered later. Then a nudge, if you want one, at a time you
choose, written straight into your reminders.

Every screen after the first arrives already answered, so Continue is never
blocked on work and thirty seconds is still thirty seconds. The five checkable
promises about the build — no account, no server, no analytics, export it all,
delete it all — moved onto the hero, one tap under the headline, where somebody
deciding whether to type their symptoms into this can actually read them. The
last screen still ends the way it did: the card you just filled in flies into
place as the first card on a timeline, and now the three beats underneath it
are about what *you* set up.

## 1.18.0

### How it's drawn is your choice

There is more than one honest way to draw a month of ratings, and which one is
useful depends on what you came to find out. A line implies the days between
two entries; steps do not. A 7-day average is the only way to see a direction
through a noisy fortnight, and the only way to miss a single awful day. Four
ratings on one axis is a comparison; four ratings on four axes is four answers.

So they are settings now, under the chart, behind a row that prints the current
answer when it is closed. Shape: line, filled, steps, or bare dots. The 7-day
average: off, dashed behind the daily line, or the only thing drawn. Days you
didn't log: joined up, or left as a gap. Several ratings: one axis, or one chart
each. And the rating axis: the full 1–10, or fitted to the range you actually
scored.

Every option says what it costs rather than what it is — "holds each day's
value until the next one, and claims nothing in between" is the entire
difference between a line and steps. The last one can mislead, so it is the one
the chart itself confesses to: while a fitted axis is on, the caption reads
"axis fitted to 3–9 of 1–10, so differences look bigger than they are". An axis
that starts at 3 turns a calm fortnight into a mountain range, and nobody reads
axis labels.

The choices are saved next to your pins, so the chart opens tomorrow the way you
left it, and one link puts everything back the way it started. Underneath,
"Week by week" gained a second length — the same metric averaged into months —
and every bar now says how many days are behind it, because an average of three
days and an average of thirty look identical on a chart and are not the same
thing.

### Sheets stopped moving the page

Closing any sheet in the app — a food entry, a metric picker, a confirmation —
sent the page to the top and then flew it back down over about a second. It
looked like the app scrolling itself for no reason, and it was: the page is
pinned while a sheet is open, and putting it back afterwards went through
`window.scrollTo`, which is animated twice over here (the stylesheet asks for
smooth scrolling, and Lenis replaces the method with its own eased version).
Restoring the offset is now a jump, through the one route neither of them
intercepts, with Lenis re-measured and handed the same number so it resumes
from where the page actually is rather than from zero.

While a sheet is open the scrollbar's gutter is held open too, so the cards
underneath no longer shuffle 15px sideways as it opens and back as it closes.
On a phone, where the scrollbar is an overlay, the gutter is zero and nothing
changes.

### The trend chart draws what you pinned

Insights let you pin four metrics and then drew one of them. The other three
changed a chip's colour and nothing else, and the comparison they were pinned
for lived in a second card — "Side by side" — three screens further down, under
a heatmap and a distribution. Two cards, one chart's worth of information, and
the one at the top of the screen was the one that answered nothing.

There is now one chart, at the top, and it is the comparison. Ratings share the
single honest 1–10 axis. Anything with its own unit — weight, doses, hours of
sleep, a percentage — gets its own chart underneath at the same width and on
the same dates, with its own axis, and one crosshair crosses all of them at
once. The metric the screen is about still leads: heaviest line, tallest chart,
its 7-day average dashed in behind it, and the flares you marked shaded behind
every chart in the stack.

"Side by side" is gone as a section, because it is now the thing you were
already looking at. A metric with fewer than three days in the window says so
in place of drawing a line out of two points.

### The pickers under "Possible relationships" are the app's own

They were native `<select>` elements. On a phone that is a wheel and defensible;
on a laptop it drops an unstyleable list over a dark card, in the browser's
font, with two dozen metrics in one flat alphabetical run, no units, no
grouping, and unselected rows greyed nearly to the page colour. It was the one
control in the app that looked like it belonged to a different app.

They are now the same sheet every other choice here opens in — grabber,
heading, scrim, drag to dismiss. Ratings are grouped apart from things measured
their own way, each option carries its unit, the current answer is filled and
drawn rather than merely ticked, and past nine options there is a filter field.
Keyboard throughout: arrows move, Enter chooses, Escape closes, and focus comes
back to the trigger you left.

### The first thirty seconds

Somebody installing a health journal is not shopping. Something is wrong, or
they are afraid something might be, and what they want is to believe this will
be worth the effort — and then to put something down. The old first run gave
them a seven-screen wizard whose second screen was a theme picker.

First run is now four acts, and the fourth one is the whole argument.

**One. The promise.** A full-screen hero: *Your health, remembered.* Behind it,
a journal that is already alive — a rating with its itch and sleep beneath it, a
photograph of a spot fourteen days apart, a note about a bad night, a dose
ticked off, a flare that ended, three months of trend with the flare shaded
behind it. Six fragments hanging off one rail, drifting on their own periods.
Between them they name everything this app records, and not one of them
explains anything.

**Two. The only question that cannot be defaulted.** What are you tracking?
Six packs, in the order people arrive with them, and the rest one tap away.
Everything first run used to ask for — which questions, which body spots,
weight, progress photos, a name, a theme — has a sensible default and a screen
in Settings. Asking for them here cost the thing they were meant to protect.

**Three. The first entry, and it is real.** The main number, ten large targets,
asked as a question a person would ask: *How is your skin today?* Tap it, or
slide a thumb across it — the drag walks the number with a tick at every rung.
Once there is a number the card takes its colour, a wash and a hairline in the
temperature of the day. A note is optional and one tap away. The number is not
a demo: it is written to the journal.

**Four. The journal begins.** The card they just filled in physically flies
into place as the first card on a timeline. The rail draws downward past it
into Tomorrow, Thursday and Friday — drawn as the faintest thing on the screen,
because the days not lived yet are the entire product — the streak counts up to
one, and the promise resolves into three beats: how you felt, what happened,
what changed.

That last act is the argument no paragraph makes. A journal is a promise about
the future — keep writing this down and in six months it will tell you
something — and watching your own first entry become the first thing on a
timeline makes that promise in about three seconds.

### The motion is the product, and it is optional

`src/lib/intro.ts` is the choreography: the hero assembling in reading order,
the fragments breathing afterwards, the FLIP that carries a card from one act
into the next, the rail drawing, the bloom, the count. Every function returns
immediately under `prefers-reduced-motion`, every act is composed so that the
still frame *is* the finished layout, and nothing blocks — each helper calls
back even when it does nothing at all. The whole flow was driven end to end
with motion switched off, in both themes, to prove it.

### And the long form is still there

Anybody who would rather build the whole survey before logging anything can:
"Set everything up in detail instead" hands over to the seven-screen wizard,
unchanged. Both paths produce the same journal — the short one turns the
chosen packs' quick questions on and assumes nothing else — so a journal begun
in thirty seconds and one built over seven screens are the same object
afterwards.

## 1.17.0

### One tap is a whole day

A journal that demands a seven-screen survey gets abandoned in a fortnight. A
journal that takes one tap gets a year of data, and a year of one honest number
is worth more than a fortnight of forty.

Today now opens with the **Daily Pulse**: the main number, ten large targets,
and the tap *is* the save. No button, no confirmation, no screen. Tapping the
same number again clears it, which is the gesture every other scale in the app
already uses.

The line under it is derived from the journal on every render, never from the
fact that a tap happened. Until the number is in the entry it says "Nothing
recorded yet", and once it is there it says which end of the scale it is at —
because a 7 means opposite things on "severity" and on "sleep quality", and an
app that says "Saved" because a handler fired is an app that will eventually
lie about somebody's medical history.

### The detail comes after, and only if it is worth asking for

Once the day is rated, three to five optional follow-ups appear, chosen for the
score. A hard day is asked about the other symptoms, what was taken, and what
it looks like — the things a clinician will ask about. A calm day is asked
about sleep and what was different, because those are what might explain it.
Offering "photograph the rash" on a 2 is noise.

Nothing already answered is offered. A deliberate skip still counts as
unanswered — it was a decision, not a value. A photo is only asked for on a bad
day or after a week without one. The note is always last, because it is the one
that needs typing. Each one answers inline, with the app's own input for that
question, so an answer given here and one given in the survey are the same act.

### Two destinations and one verb

Five tabs made the app a filing cabinet. Today, Log, Diary, Insights and
Calendar were three ways of asking "what happened before now" plus two ways of
writing something down, and every visit charged the same tax: work out which
shelf the thing lives on first. That tax is paid most often by the person
feeling worst.

The bar is **Today**, **+**, **History**.

The + is the only control in the app that is a verb, so it is the only one
drawn as a solid. One tap from anywhere opens everything a day can hold —
check-in, food, routine, photo, note, bowel movement, measurement — and lands
on Today, which is the day it adds to. Note and Measurement are new doors onto
things that used to require the whole survey: a note is a sheet with a
textarea, and a measurement goes straight to the keypad, skipping the picker
entirely when a setup has only one number in it.

History is the month, the last fortnight in words with each day's number at the
size it deserves, and the two doors the old tabs led to: Insights and the
Diary. Settings left the bar for the header.

### Setup asks about the illness, not the wallpaper

The second screen of first-run setup used to be a theme picker — asked before
the app had put a single question to somebody about why they had installed it.
A first run that opens with decoration has told you what it thinks it is.

Setup is now: what are you tracking, which number matters most, the questions,
the photo spots, and then the first entry.

**The main number** is new and load-bearing. Every pack ships an opinion about
which of its questions matters most, and for most people it is right — but it
is an opinion, and that number becomes the one-tap question on Today, the hero
on Insights and the first figure a clinician reads in an appointment pack.
Somebody whose eczema is manageable but whose sleep is wrecked can say so on
day one instead of finding out three months later that the app has been
charting the wrong thing about their life.

And setup no longer ends on a summary. It ends with the thing the app is for,
done once — because the difference between an app somebody configured and an
app somebody uses is one tap, and this is the best moment it will ever have to
ask for it.

### A finish that tells the truth

Skipping every question used to end in confetti, a save chime and a streak
count. The app was congratulating somebody for a blank day, and teaching them
that the number on the front of it means nothing.

The celebration is now earned by at least one value, note or photo. In its
place: "Nothing logged yet" — what happened, said plainly, with the way back to
the questions and the main number right there, because one tap is enough to
make it untrue. Record something and the celebration appears the moment it
becomes honest. There is no Undo on that screen, deliberately: nothing was
written, so there is nothing to undo.

Two things underneath it were the same lie one layer down, and both are fixed.
A day used to exist as soon as the survey wrote a null, so skipping everything
put a dot on the calendar, a day on the streak and a row in the export for a
day nobody logged; an entry is now created only when something is recorded. And
Skip used to erase — it wrote a null over every question in the batch,
including ones already answered from Today's pulse or an earlier visit. Skip
means "don't ask me these" now, and leaves answers alone. It is the one kind of
data loss a journal must never do casually.

### Quick Add learns, and Again does everything

Quick Add shipped as a fixed grid in a fixed order, which is right for the
first week and wrong forever after. Somebody logging four meals a day and a
cream twice a day does not need Bowel in the top-left corner every morning.

The tiles sort themselves by frequency decayed by recency — a use counts half
as much after ten days, so two taps yesterday outrank a hundred last spring.
Anything never used keeps the catalogue's order rather than shuffling on every
render. Arranging the tiles by hand switches the learning off, and moving one
*is* that decision: no switch has to be found first.

**Again** is now every kind of repeat rather than only food. The second time
you log a thing is the tap worth saving, and it does not matter whether it is
the porridge you have every morning, the cream you use twice a day, the arm you
photograph on Sundays or the weight you record on Mondays — they compete on one
score, so the row is your own week in your own order. A favourite outranks the
arithmetic, because marking one is an explicit "I will want this again". A
photograph works the other way round on purpose: the longer it has been, the
higher it climbs. Nothing already answered today is offered, nothing that has
never been done is invented, and a journal with no habits yet gets no row.

## 1.16.0

### The appointment pack

A year of logging has one moment it is really for: ten minutes in a room with a
specialist, every few months, opening with "so how have you been?" That question
is the one memory answers worst. It reaches for the last bad week — because that
is what memory does — and the last bad week is not the year.

Everything needed to answer it properly was already in the journal and none of it
was in a form anybody could hand over. Insights is nine sections of scrolling on
a phone. The CSV is a spreadsheet. The weekly report is a week.

So Export now opens with **Prepare an Appointment Pack**, above CSV, Excel and
JSON, because a file for a spreadsheet and a page for a person are not the same
errand and the second one is the one that changes an appointment.

**Pick a window, get a page.** The last 30 days, the last three months, your own
dates — or **since my last appointment**, which is the range everybody actually
wants and the only one the app cannot work out on its own. So it asks, once, in
the place where it matters, and afterwards there is a button on the pack that
marks today as the visit, which is what makes the *next* pack cover exactly the
stretch since this one.

**It prints in the order a consultation runs.**

1. **How it's been** — the average, the change against the same number of days
   immediately before, and the days it rests on.
2. **Best, hardest, usual** — because an average of 5.2 is one number for two
   completely different lives.
3. **Flares** — how many, how many days of them, how long they ran on average,
   the longest, the average severity and the worst it got.
4. **Biggest changes** — the three metrics that moved most.
5. **Routine** — what was taken against what the plan asked for.
6. **Photos** — one before-and-after pair.
7. **Notes** — the days you picked out yourself.
8. **Questions for my appointment** — yours, printed with a rule under each one.

That last section is the one that turns a summary into a document somebody can
use in a room. Questions occur to you at 2am in the middle of a flare and are
gone by the time you are sitting on the paper. They live on the journal now, not
in screen state, so a question written a fortnight before the visit is still
there in the waiting room — and it prints with somewhere to write the answer.

**Four rules govern every figure on it.**

*Nothing is invented.* A section with nothing behind it is left out, and the
reason is shown in the app rather than printed as a zero. "No flares recorded"
and "no flares happened" are different sentences and only the first is knowable.

*A comparison needs both sides.* The previous window is the same number of days
immediately before the range. If either side has fewer than five logged days,
there is no change printed — a "+2.1" built on three days against thirty is a
lie with a decimal point in it.

*Coverage travels with every average.* "5.8" is printed as "5.8 · 22 of 30 days
(73%)". Anybody reading it is entitled to know what it rests on without asking.

*The app does not grade anybody.* Routine adherence is a count of what was
recorded against what the plan asks for, from the day each item was added — the
app keeps no history of schedules, so counting a medication started on Monday as
four weeks of missed doses would be inventing a failure. There is no colour on
it, no target, and no verdict. The reading belongs to the two people in the room.

**Ranking changes fairly.** The three biggest movers are ranked by *relative*
movement, not by the raw number. A step count that fell by 900 and an itch rating
that rose by 1.5 cannot be compared on the size of the number, and sorting on it
would fill every pack with whichever metric happens to have the biggest units.
Both figures are printed; only the ranking is proportional.

**Choosing is the person's job.** The pack never picks which of your notes a
doctor reads, and never picks the photo pair. Both are one tap to choose and
neither happens by itself: an app that selects which sentence about somebody's
illness gets read aloud has quietly started editing their account of it.

**On paper.** Every section can be switched off, and the pack says up front
whether it is about one page or two. The printed page carries its own masthead,
the date it was printed, the pattern caveat and the disclaimer, because it leaves
the app and has to stand up alone. Nothing on it needs a tooltip, a legend, or a
colour to be read — a pack photocopied in a clinic is black and white.

## 1.15.0

### Insights, rebuilt around the questions people actually ask

Insights was a pile. A headline number, a chart, some cards, patterns,
reports, photos, entries. Everything on it was worth having and none of it was
in an order, so "how am I doing" was somewhere in five screens of scrolling and
the reader had to assemble the answer themselves.

It now runs down the questions in the order they get asked:

1. **Over what period?** — a range selector at the very top: 30 days, 3 months,
   12 months, all. It is first because it changes everything below it, and
   everything below it really does re-read the same window. Nothing on the page
   is quietly still showing thirty days.
2. **How am I right now?** — the hero, with the day's number, the streak, and
   the range average underneath it.
3. **How does that compare?** — four figures and no charts among them: average
   with its change against the previous window, days logged out of days in
   range, hard days, calm days. These are the numbers you read *before* you look
   at anything, so they are not inside a chart.
4. **What has it been doing?** — one trend chart, the first pinned metric, over
   the chosen range, with any flare shaded behind it.
5. **How bad were the bad bits?** — flares.
6. **What does a year look like?** — the heatmap, with the whole monthly history
   folded underneath it.
7. **What kind of days are they?** — the spread.
8. **Does anything move with it?** — honest side-by-side charts.
9. **Is anything related?** — the explorer.

One primary chart is visible at a time. Week by week, the years overlaid,
seasonal averages and the scatter each sit behind a labelled expansion control,
so the page reads as nine short answers rather than as fourteen charts.

**Pinned metrics.** Up to four, saved to the journal rather than held in screen
state — the entire point of pinning is that they are still there tomorrow. The
first one is what the hero, the trend chart, the year block and the spread are
all about.

### The spread of days

An average of 5.2 is the same number for somebody who scores 5 every single day
and somebody who alternates 2 and 8, and those are not the same life. The trend
chart cannot tell them apart either — it draws both, and the eye reads the
second as noise around the first.

So: ten columns, one per score, each carrying its own count above it, in the
same colour ramp as the year block. Under them, the four things that count
actually tells you — the typical day, the most common day, the spread in one
word (*steady*, *mixed*, *swinging*), and how many days were hard. "How many
days were actually bad" is a count, not a curve, and no amount of staring at a
line gives it to you.

### Flares

A chronic condition is not a smooth line with a slope. It is long stretches of
"fine, mostly" broken by weeks that reorganise your life, and the second kind is
what you remember, what you book an appointment about, and what every question
you bring to it is really asking.

**Start a flare. End a flare.** That is the whole interface. Nothing is detected
automatically, and that is a decision rather than a gap: a run of 7s is not
always a flare, a flare does not always show up as a run of 7s, and an app that
invents medical events in somebody's history and then reports statistics about
them has done something worse than nothing. You say when it started. The app
does the arithmetic.

The arithmetic is: how long it ran, how much of it you logged, the average, the
middle day, the peak and its date, how many hard days, the fortnight before it,
the fortnight after it, and how many clear days there were since the last one.
Then a year of them — how many, how many flare days, the average length, the
longest — against the same figures for the year before. A flare that crosses New
Year is counted in both years, in the right proportions.

**Each flare has its own screen**, and its chart is not the one on Insights: it
draws a fortnight either side of the flare with the flare shaded, because a
flare drawn from its own first day to its own last day always looks like a
flare, and drawn with the fortnight before it, it looks like what happened.
Under the chart, the things that make it a memory rather than a statistic — what
you wrote, what you photographed, what you were taking, and the day-by-day
record.

### The long view

Folded under the year block: one point per calendar month across the whole
journal, this month against the same month last year, the best month, the
hardest month, the longest unbroken calm stretch, the years overlaid, and
seasonal averages.

This is the section with the most ways to mislead, so it has the most floors. A
month built on fewer than six logged days is not plotted. A same-month
comparison needs both sides solid or it does not appear. Seasonal averages stay
hidden until most months of the year have two years behind them, because
"your Januaries average 7.2" computed from one January is just that January with
a grander name on it. A calm run counts only days logged back to back — a gap
ends it, because not writing anything down is not evidence of a good day.

Where something is hidden, the reason is printed. Somebody who logs irregularly
should learn what the app needs, not conclude the feature is broken.

### Comparisons that don't lie about the axis

The old chart put every selected metric on one pair of axes and, when the units
did not match, printed a note underneath asking the reader to "compare shapes,
not heights". That note was doing work the chart should have done. With severity
on 1–10 and a step count in the thousands, the severity line is flat against the
bottom edge and any relationship between them is invisible. Worse: weight in kg
and severity 1–10 land in the *same* numeric range, so the chart looks perfectly
reasonable and is completely meaningless.

Metrics that genuinely share a scale — the 1–10 ratings — now share one chart
with a fixed 1–10 axis, which is the only honest overlay in this app. Anything
with its own unit gets its own small chart underneath, same width, same dates,
its own axis. One crosshair moves across all of them at once, so the thing an
overlay was *for* — "what was happening on the day that spiked" — still works,
and now works truthfully.

### Possible relationships

Pick something you're tracking and something you suspect. The screen compares
the days both were logged, same-day or with a one-day lag, and reports how often
they moved together.

This is the most dangerous screen in the app, and the danger was never that the
arithmetic might be wrong. It is that somebody managing a condition, looking at
a chart the app drew, reads "dairy 0.42" as "dairy is doing this to me" and
changes what they eat on the strength of eleven days. So the restraint is in the
code rather than in a disclaimer at the bottom:

- **Nothing appears below twelve paired days.** Not greyed out — absent, with a
  line saying how many more days it needs and why.
- **The sample size is printed above the result**, not below it. It is the thing
  that decides whether the result means anything.
- **Spearman's rank correlation, not Pearson's.** These are 1–10 ratings a
  person assigned to their own body; the intervals between them are not equal,
  and rank correlation is the one that doesn't pretend otherwise. Ties are
  averaged, because 1–10 ratings are almost entirely ties.
- **"Strong" is unavailable below thirty paired days**, however large the
  coefficient. A 0.7 on twelve days is not a strong relationship, it is twelve
  days.
- **The default shape is a grouped comparison, not the scatter.** "On the days
  you logged more of this, that averaged 6.8 rather than 5.4" is a sentence
  somebody can act on carefully. A cloud of dots with a coefficient is a
  sentence they will act on confidently, which is worse. The scatter is one tap
  away for anyone who wants it.
- **"Not proof that one causes the other" is on screen at all times**, not
  folded away.

Every phrase the feature can produce lives in one object that the
causal-language audit reads, so there is no second place for a stray "causes" to
hide.

### Underneath

Four new pure modules — `distribution`, `episodes`, `longterm`, `relationships`
— none of which draws anything, all of which are tested without a DOM or a
clock. Direction is load-bearing in all four: a 2 is a good day for a rash and a
poor one for sleep, so no threshold anywhere assumes high is bad.

Episodes are a first-class record: typed model, migration with a sanitiser that
repairs dates the wrong way round, runtime validation, a sync record kind, and a
place in full backups. `MultiMetricChart`, `MetricChart` and `seriesFor` are
gone — all three were fixed at thirty days and are superseded.

## 1.14.0

### Your year, on one screen

The trend chart is thirty days. That is the right window for "is this week
worse than last", and the wrong one for almost everything you actually carry
into an appointment: *was this spring worse than last autumn, how much of the
year did I lose to this, when was the last stretch where I was fine.*

Insights now ends its Trends run with the whole year. Twelve rows, one per
month; thirty-one columns, one per day-of-month; a distinct shade for every
score from 1 to 10, and nothing at all on the days that were never logged. It
sits directly under the 30-day chart and follows the same metric picker, so
zooming out is not a screen you have to go and find.

**Months as rows, not weeks as columns.** The contribution-graph layout puts 53
week columns across the page, which on a phone is five pixels a day —
unreadable, and untappable by a wide margin. Thirty-one day columns is nine,
the largest square a full year can have on this screen, and "each row is a
month" is a key nobody has to be given. Weekday alignment is what it costs, and
weekday questions belong on the Calendar screen, which has full-size targets
and always has.

**Ten shades, not four.** The dashboard's severity ramp buckets 1–10 into four
colours, which is right for a single number you read at a glance and wrong for
365 squares: at four steps a 3 and a 5 are the same square, and telling those
apart is the entire reason to draw a year. The ramp here interpolates the same
four bucket colours into ten, so a red day is still the red the dashboard used
this morning — there are just nine other days it can now be told apart from.
Metrics where high is *good* get the ramp reversed, so a 9 of sleep quality is
never drawn in the colour of a 9 of pain.

**A tap names the day before it opens it.** A nine-pixel square is not a tap
target, and pretending otherwise would mean every mis-hit costs a screen you
have to back out of. Instead the first tap puts the day in a readout under the
grid — "Fri, Aug 7 · 6/10", or "nothing logged this day" — next to a full-width
button that opens it. Tapping the same square again opens it too, so the fast
path is still two taps, and the slow path is one you can correct without
leaving.

**Three states, three treatments.** A day with a score is a filled square; a
day that was logged but has no answer for *this* metric is an outline; a day
with nothing on it is a whisper of the grid. So a sparse year reads as sparse
instead of as a hole in the drawing, and "I stopped logging in March" and "I
logged but skipped this question" are not the same picture.

### Saying it without the colour

Colour is the only channel a heatmap has, so it cannot be the only channel the
section has.

- Every square carries its full date and score as its accessible name.
- The grid is a single tab stop with arrow-key movement — left and right by a
  day, up and down by a month, Home and End to the ends of the year.
- **Read it month by month** opens a real table under the grid: logged days out
  of elapsed days, average, best and hardest, one row per month, with the
  year's best and hardest day named underneath. It says exactly what the grid
  says, in words, and it turns out to be the fastest way to read the monthly
  figures whether or not you can see the colours.

Best and hardest are read through the metric's own direction throughout, so a 2
is the best day of the month for a symptom and the worst one for energy.

## 1.13.0

### The Diary: one page for the whole day

Meals lived on the Food tab. The routine lived on the dashboard and a screen of
its own. That was three places for one question, and the question people
actually ask is one sentence long: *what went in and on me today?*

The Food tab is now the **Diary**, and it holds the day whole — a sticky pager
at the top, the day's two headline numbers under it, the routine, then the
meals. One date drives both systems, so filling in yesterday evening means one
trip: last night's dinner and last night's doses, on the same page, without
changing tabs.

Nothing is behind a tab, a toggle, or a sideways scroller. On a page whose only
job is one day, "is it all there" has to be answerable by looking.

### Making it fit

Putting two systems on one page is only an improvement if the page still fits.
Four changes, each of which stands on its own:

- **Checklist rows are one line.** Name and dose while it is waiting, name and
  the time once it is done — the row answers a different question before and
  after the tap, so it never needs to print both.
- **Empty meals are chips, not cards.** Five empty meal cards spent 300px
  saying nothing five times, on the exact screen you open *before* you have
  eaten. They are now one row of add buttons, with the same labels and the same
  one-tap path into each meal, and they disappear one at a time as the day fills
  in. A meal with food in it is still a card.
- **A filled meal's add button moved into its header**, next to the subtotal —
  a 44px target in place of a full-width row repeated once per meal.
- **A finished slot folds into one line.** "Morning · all 5 done", tap to open.
  The list gets *shorter* as the day goes on instead of staying the same size in
  a different colour.

A nine-item routine and three meals now fit in about one and a half screens, and
about one once the routine is done.

### Two taps that were four

**All 4.** A slot with more than one thing still to take offers to log the lot —
because four morning pills are swallowed in one handful and then confessed to in
four taps. One write, one toast, one Undo that takes all of them back out.

**Add to routine, from the day.** The heading carries **+ Add**, so "I've just
started taking this" no longer means a trip to another screen and back. It is
the moment people actually add things — standing in front of the thing.

### The manage screen does one job again

It had a date pager, a progress card and a full checklist, which was a second
copy of the day one tab away from the first — two lists that could drift out of
step. It is now the plan and only the plan: add, edit, archive, and see
everything you track in one list, with a link back to the Diary to tick things
off.

### Elsewhere

- The dashboard's routine keeps the same one-line rows and the same folding, and
  lost the card that used to box it in — which is where "CeraVe moisturising
  cream" was losing its last two words while fitting perfectly on the Diary.
- The Diary draws its own sticky header, so the shared one no longer stacks a
  second title above it.

Tests: **713 across 29 suites** (was 704/28), with a new suite driving the day
page end to end — the pager writing doses to the day it is showing, All-N and
its single Undo, and the fold never being a dead end.

## 1.12.0

### Your routine: meds, supplements, creams, products

The journal could tell you how bad your skin was on the 4th. It could not tell
you what you had been putting on it. Treatment questions existed — *treatment
used: yes*, *treatment detail: "CeraVe cream"* — but a survey question answers
once a day, and a routine is not once a day: it is two pumps in the morning and
two at night, a supplement with breakfast, a shampoo on the days you wash your
hair, and a steroid cream only when things flare.

So the routine is its own system now, and it is built around exactly one
interaction:

**One tap says "took it". The same tap undoes it.**

No dose picker in the way, no confirmation, no form. Add an item once — a name,
a kind (medication, supplement, cream, product, food or drink), a dose in your
own words, and which parts of the day it belongs to — and it becomes a row on
the dashboard, grouped into Morning / Midday / Evening / Bedtime, with **3 of 5
done** across the top. Anything you only take when you need it sits in a
separate **As needed** row: offered on one tap, never counted as missed, and
showing how many times you have already had it today.

**Doses are free text, deliberately.** "500 mg", "2 pumps", "pea-sized", "1
scoop", "one wash". Those are the things people actually say, and a number field
with a unit dropdown would have made the common case slower to serve a tidiness
nobody asked for.

### Adjusting today without rewriting the plan

The second tap — the small control beside each row — is where everything else
lives: the dose you actually took, the clock time, a note. **Changing today's
dose does not change tomorrow's**, and the sheet says so on screen when the two
differ. Editing the item itself is what changes the plan.

**A skip is recorded as a skip.** A box you never ticked and a dose you decided
against are different facts, and the app refuses to conflate them: an untouched
row means *nothing was said*, and only a skip means *I chose not to*. Both are
visible in the day's count and in the export.

### History is a record, not a view

Every entry keeps its own copy of the name, kind and dose **as they were the day
it was logged**. Rename an item, halve its dose, archive it, delete it outright
— last Tuesday still says exactly what it said. This is the same rule the food
diary already follows, and it is the reason the routine can be edited freely
without anyone having to think about what an edit costs.

### It shows up everywhere the rest of the journal does

- **Today's Logs** carries each dose in the timeline, in the order it happened,
  next to your meals and check-ins.
- **Trends** gains two chartable metrics — *doses taken* and *routine completed
  (%)* — so a new cream and a symptom score can be looked at on one chart. Both
  are drawn as neutral quantities: an adherence number the app colours red would
  be advice, and this app doesn't give any.
- **Export** gains two sheets. **Routine** is one row per dose (name, kind, dose,
  when, taken or skipped, and the plan's usual dose alongside it); **Routine
  items** is the plan itself, which is the sheet you print for an appointment.
  The daily table gains `routine_taken`, `routine_skipped` and `routine_items`
  beside the survey answers.
- **Reminders** gain a routine kind, and stay quiet once the day's checklist has
  been cleared.
- **Sync and backups** carry both the items and the doses, on the same
  tombstoned, last-write-wins terms as everything else.

It is a written record and nothing more. It does not know what interacts with
what, does not check doses, and will not tell you whether something is working —
and the screen says so, in those words.

### Under it

New `src/lib/routine.ts` (items, doses, the checklist, progress, summaries,
sanitisers, metrics) and new `src/lib/metrics.ts`, which is now the one registry
of chartable derived metrics across food, bowel and routine — `tracking.ts` kept
its own metric definitions but no longer owns the register, because `routine.ts`
imports it and the registry has to sit above both.

Tests: **704 across 28 suites** (was 658/26), including a suite that drives the
whole thing through the UI.

## 1.11.0

### The Detailed Log gets the screen it was standing on

It was one card holding every question in the survey. Forty-odd rows, one
continuous rule down the page, and the only structure a heading that scrolled
away three questions in. On a phone that is merely long. On a laptop it was a
448px ribbon of it down the middle of a 1440px screen — three quarters of the
display empty, while "where does Skin end and Diet begin" had no answer on
screen at any moment.

Sections are cards now. Each carries its own sticky heading, its own answered
count (`3/8`), and its own fold, in a grid that becomes two columns at 900px
and three at 1320px. **Below 900px nothing about the phone changes** — the
shell is still 28rem, still centred, and it widens for this one screen and no
other, because every other screen in the app is a list and a 1440px-wide list
is not an improvement.

**The 1–10 scale carries its numerals.** Ten blank tiles work under a thumb
that is already on the one it wants, with the big number to the right reading
back what it landed on. Under a pointer that is somewhere else on a laptop
screen, they are a bar chart with no axis. The rungs also can't be clipped by
a card corner any more, whatever the width.

### "Same as usual?" is no longer a question

Every scale used to open with a banner: *Tap to confirm 3 · same as usual*.
It was meant as a shortcut. It was a sentence placed in front of the user on
every question of every day, and a question you have to answer in order to
dismiss it is not a shortcut — it is one more question.

The memory behind it is untouched and now goes further. The recent answer is
still worked out the same way (a 7-day median for scales, yesterday for
toggles, the last value for numbers) and is still pre-selected — as a dashed
ring on the value itself, accepted by tapping it like any other. What it
means is explained **once per screen** by a small legend, and only while
something on that screen is actually wearing the dashes. The Detailed Log now
shows the marks too; it never used to.

### The number is the control

A weight is 196.1. Entering 196.1 used to cost eleven presses of a `+0.1`
button — or discovering that the borderless number between the two circles
was secretly a text input, which nothing said and which on a phone summoned
the OS keyboard over the field it was editing.

Tapping the number now opens a keypad: the value at reading size, a nudge
row, ten keys, and nothing else. It takes one decimal for a weight and none
for a step count, because the precision comes from the field's own step.
Digits, `.`, Backspace, Enter and the arrow keys all drive it, so it is as
quick with a keyboard as with a thumb.

### First run is addressed to somebody

- **The name is asked first, not last.** At the end it was a label on a
  profile nobody opens. At the start, the next screen can greet them by it
  and the final one can hand them their own setup. Still optional; skipping
  it just means no greeting.
- **Five checkable promises, before anything is typed.** No account, no
  server, no analytics, export whenever, delete permanently. Each is a fact
  about the build that a stranger could go and confirm — which is the only
  kind of trust claim worth printing on a first-run screen. The medical
  disclaimer keeps its own card.
- **Seven anonymous dots became a named rail.** Welcome · Look · Focus ·
  Questions · Photos · Body · Done, with every step you have already seen a
  way back to it.
- **The last screen reads the check-in back.** Not "9 quick questions" — the
  actual first three questions it will ask tomorrow morning, which is the
  last chance to notice it is asking the wrong ones.
- Steps stagger in in reading order, and the step tone climbs the scale, so
  the final screen resolves an octave above the first.

**Fixed: picking a pack enabled none of its questions.** The effect that
syncs the enabled set read `known.current` from inside a `setState` updater —
and an updater does not run during the effect, it runs later during the
re-render, by which time the effect body's own `known.current = keys` had
already executed. Every key therefore looked like one the user had seen and
ruled on, the "preserve their choice" branch won, and the choice it preserved
was the empty set from before any pack existed. Step 3 of setup dead-ended on
a disabled button unless you happened to spot "Track everything".
`tests/onboarding.test.tsx` fails without the fix.

### Sound learns where it is

The instrument gains **positional voices**: the pitch carries *where you are*
rather than *what happened*. A 3 on a scale never sounds like an 8, typing a
weight reads as a little run up the keypad, and a seven-screen setup climbs
an octave from start to finish. One key throughout (F major pentatonic), so
nothing ever clashes with anything else.

Plus the four voices the surfaces were missing: a drawer opening, the same
gesture run backwards for closing, a detent for a menu, and a dry downward
tick for erasing.

## 1.10.0

### One feedback system

Haptics lived in a pattern table in `App.tsx`, sound lived in its own
instrument, motion lived in GSAP, and visual response lived in a scattering
of `:active` rules. Four systems, no shared vocabulary, and no way at all to
say "that failed" — the app had eleven sounds for things going right and
none for anything going wrong.

They are one door now (`src/lib/feedback.ts`). A call site names what the
person did and this decides how that reads on the device in their hand:

```js
feedback("save")                  // haptic + sound
feedback("error", { el: button }) // …and the button shakes
```

- **Haptics feel native where the hardware is.** On a phone with a Taptic
  Engine, choosing an option is a selection tick, saving is a success
  notification, and deleting is a heavy impact — the same three sensations
  every other app on the phone uses, driven through Capacitor. Elsewhere it
  falls back to the scaled `navigator.vibrate` patterns it always used,
  because duration is the only lever the web gives you. The strength setting
  now shifts impact *weight* natively rather than being ignored.
- **Sound gained the two voices it was missing.** A failure that is
  unmistakably not the save sound and is also not an alarm — a descending
  whole tone on the same wooden instrument, because being scolded by your
  journal for a failed sync retry is a reason to close it. And a sync note
  quiet enough to fire when the user did not cause it.
- **A third channel that needs no hardware.** Sound needs a speaker and
  haptics need a motor; a 260ms scale pulse on the element you touched needs
  neither, and reaches the people the other two never did. Failures shake
  laterally instead — the one gesture that has meant "no" since physical
  dialogs.
- **Every channel degrades on its own.** Sound off, haptics off, reduced
  motion, no motor, no audio device, a browser that throws when asked to
  vibrate: each subtracts exactly one channel and leaves the rest working.
  None of them can take a save down.

### Sync across devices, if you want it

Off by default. **Local Only is still the product** — no account, nothing
uploaded, every privacy claim intact — and this is an option most people will
never take.

Take it and one thing happens: log a meal on your phone, open your laptop,
and it's there. Edit it there and the change comes back. Settings says
*Local only* or *Synced*, and turning it on is four screens — what this does,
a code emailed to you, a passphrase, done. No password to invent. The words
*database*, *bucket* and *token* appear nowhere a normal user can see them.

**Local saves never wait for the network.** The journal reaches disk on the
same debounce it always used; the engine finds out afterwards. No signal, an
expired session, a server that's down, a lid closed mid-push — none of it can
reach the save path.

The problems that actually make sync hard, and what each one cost:

- **Two devices both logging Tuesday.** A day's identity is its *date*, not
  the random id each device minted for it. One Tuesday, always.
- **Two devices editing the same Tuesday.** Entries merge answer by answer. A
  phone that recorded pain at breakfast and a laptop that recorded sleep at
  midnight are not in conflict, and last-write-wins would silently throw one
  of them away.
- **Deletions coming back.** They travel as tombstones kept in the journal
  itself, so they survive a reload, an export and a restore. Undo lifts the
  tombstone with the row.
- **A pull skipping a row.** The cursor rides a server-assigned sequence, not
  a timestamp — two writes in the same millisecond can't slip through.
- **A request that may or may not have arrived.** Pushes are idempotent, so
  retrying is always safe, which is what lets the engine retry freely.
- **A device back from a week offline.** The conflict rule is enforced in SQL
  as well as on the client, so a stale write is dropped by the server.
- **Both sides already having a journal.** The first pass is a union. Every
  day from both devices survives and neither side is overwritten — the setup
  screen tells you how many came from where.
- **Photos being enormous.** A separate opt-in, so entries can sync without a
  year of daily photos on a metered connection.

### What the encryption claims, and what it refuses to

Records are sealed on the device with AES-256-GCM under a PBKDF2-SHA256 key
(600,000 iterations) derived from a passphrase that is never transmitted. The
ciphertext is bound to the row it belongs to, so it can't be moved between
records without failing to decrypt. The derived key is stored
non-extractable, so the passphrase is never written down anywhere and the key
can't be read back out as bytes by any code, including this app's. The server
holds dates and unreadable blocks.

What is *not* claimed, in the app or the README: not zero-knowledge (the app
is delivered over the web, and whoever controls the host controls the code
that handles your passphrase — said plainly, on the screen where you choose
it), not HIPAA, not "medical grade", and not protection against someone
holding your unlocked phone.

The Privacy card now changes with the app rather than describing an app you
might not be running: turn sync on and the "no account" and "no server" lines
are replaced rather than left standing.

### Tests

143 new ones. The merge rules and the projection are pure and tested
exhaustively; the crypto is tested through its negative cases (wrong
passphrase, moved ciphertext, tampered bytes) more than its happy path; and
the engine is driven end to end against a complete in-memory implementation
of the same contract Supabase implements — offline, reconnecting,
half-pushed, wrong passphrase, two devices racing the same day, sign-out,
restart, purge. Two real bugs surfaced that way and were fixed before
shipping: a pull page being mistaken for a snapshot (which would have
re-uploaded the whole journal after every incremental pull), and an engine
that answered "yes, done" to a caller when it had merely deferred.

## 1.9.0

### The first screen is for logging

The dashboard was 4.7 screens tall and led with a statistic that is blank
until you have logged — so the thing the app is *for*, Quick Add, sat about
600px down, underneath a large empty box. It is two screens now:

- **Today** is the logging surface: the date, Quick Add, one-tap repeats,
  today's timeline, and a one-line glance at how the day is going. It fits on
  one phone screen.
- **Insights** is everything the app has worked out: the headline number, the
  30-day chart, weekly bars, week-over-week cards, Possible Patterns, reports,
  photo progress and recent entries.

Insights takes the tab **Export** was holding, which had it backwards —
exporting happens a few times a year, before an appointment, and trends are
what you open the app to look at. Export now lives at the foot of Insights and
in Settings.

### Again: one tap to re-log

Your food library already knew what you eat over and over; it only paid out
*inside* the picker, three taps deep. The same rows are on the first screen
now. Tap one and the meal is logged at the current time, under whichever
category the clock implies, with an Undo in the toast. A food shows up after
being logged **once** — waiting for a second log before offering the one-tap
repeat had it exactly backwards.

### Sheets are sheets

Flush to the bottom edge, with a grabber that drags to dismiss and an action
row pinned to the bottom so **Save is always under the thumb** instead of
waiting at the end of a scroll. Sized in `dvh` rather than `vh`, because on
iOS Safari `vh` is the viewport *without* the URL bar — which is how a web
form ends up hiding its own Save button.

They get out of the keyboard's way on both engines:
`interactive-widget=resizes-content` for Chromium, a `visualViewport`
listener for iOS Safari, both feeding one CSS variable that lifts the sheet
and the toast above the keys.

One action, not two: the header's × already dismisses, as do Escape, a tap
outside and a drag on the heading. The action bar is a single full-width
button that names the outcome — "Log it", or "Save changes" when editing.

### Logging is optimistic, and reversible

Sheets close on the tap and the row is on the timeline before the next frame.
The receipt arrives as a toast carrying an **Undo**, which beats a
confirmation step because it charges only the people who actually made a
mistake rather than everyone. Deleting a log keeps its photo until the Undo
has expired — an Undo that brought a meal back without its photo would be a
worse lie than no Undo at all.

Undo covers what is reversible without loss. Clearing photos and restoring a
backup over a journal keep their confirmations, because there is nothing to
undo them with.

### Progressive disclosure, with the answers on the outside

Long forms fold everything the everyday path doesn't need into rows that
**state what is inside them** — "Medium · Brown", not "More options" — so
folding a section away hides the controls and never the information.

The bowel sheet went from roughly 1,500px of scrolling to one screen. Bristol
type is an ordered scale (1 is hard, 7 is liquid), so it is drawn as one row
of seven targets with the selected type named underneath, rather than seven
stacked paragraphs taking 390px to answer one question. Every type is still
individually reachable and still carries its name.

The camera keeps the top of the bowel sheet **only when AI is connected**,
where one photo answers four questions. With AI off — the shipped default —
it answers nothing, and leading with it pushed the one control most people
opened the sheet for below the fold to make room for a feature they had
switched off.

The food picker leads with search and the list. Time and meal are still
there, one tap down, and still re-file whatever gets tapped. Search no longer
autofocuses on a phone: raising the keyboard over the list the sheet exists
to show is the opposite of fast.

### Less furniture above the first question

Quick Log opened with about 280px of chrome: a header saying "Daily Log", a
date pager saying "Today" directly underneath, a full-height mode switch and a
dashed photo shortcut. The pager moved into the header — the nav already names
the screen — and the photo shortcut moved to the long form, the only mode with
no camera step of its own. Quick Add's Photo tile now opens the camera
session directly, which is what "Progress shot" always implied.

### Motion, and targets

- **Overlays no longer inherit the entrance stagger.** Sheets render as
  children of the screen that opened them, so a dialog opened by a tap was
  getting a 240ms delay and a 12px rise — the scrim arrived a quarter of a
  second after the sheet on it had already slid up.
- **Every interactive element on every screen was audited.** Nothing was
  missing an accessible name; plenty were too small. Chips and segmented
  controls 38→42px, calendar days and the month pager to 44, the sheet's
  Close button 32→40, header back and day-pager buttons 36→40, and a section
  heading that is itself a control now gets a control's target.
- Deletes moved out of the sheet action bar. A 36px red square wedged against
  Save was under the tap minimum, unlabelled, and one slip from the button
  most likely to be aimed at.

### Fixes

- The shared header rendered an **empty `<h1>`** on the Food and Fitbit-import
  screens — neither had an entry in the title map.
- The food diary's "Set daily targets" sat beside a 4xl digit it never shared
  a baseline with; it is its own row now.
- Empty meal rows in the diary were a card each — 425px to say nothing five
  times. One tappable row each.
- The glance card printed an em dash for a metric it had no number for, right
  beside the calorie count: "Overall skin severity — 420 kcal". Stats with no
  number are simply not shown.

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
