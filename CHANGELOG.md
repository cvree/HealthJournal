# Changelog

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
