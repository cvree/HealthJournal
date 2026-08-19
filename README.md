# Health Journal

A private daily health journal that lives on your device.

You build a check-in around your own situation — skin, gut, migraine, POTS, fatigue, a diet
experiment, whatever you're actually tracking — answer it in about a minute a day, and watch
the trends come out over weeks. When you have an appointment, you print a summary and take it
with you.

There is no account, no server, and no tracking. Out of the box, after the app has loaded once
it makes **no network requests at all** — it installs to a phone's Home Screen and works
completely offline.

Two things can change that, both opt-in, both off until you turn them on, and both leaving
everything else working exactly as it does now:

- **AI observations.** Add your own Google Gemini API key in Settings and it sends a minimal
  summary of your logged numbers *when you ask it to*, showing you exactly what first.
- **Sync across devices.** Turn it on and your journal follows you from phone to laptop —
  encrypted on your device before it's uploaded, with a passphrase that never leaves it. Local
  saves still never wait for the network. [How it works, and what it doesn't
  claim.](#optional-sync-across-devices)

> **Not medical advice.** This is a personal tracking tool. It does not diagnose, treat, cure, or
> prevent any condition. It surfaces *possible patterns* in your own logs and never claims a cause.
> For medical concerns, symptoms, medication changes, restrictive diets, fainting, allergic
> reactions, abnormal labs, or major health changes, consult a qualified healthcare professional.

---

## What it does

**Reminders, plural.** A check-in belongs at the end of the day; meals belong at meal times,
because the point of tracking food is logging it while you eat. Add as many named times as suit
your day, export them all as one calendar file, and the ones whose job is already done stay quiet.

**The first thirty seconds.** First run is four acts, not a wizard. A full-screen hero — *Your
health, remembered.* — over a journal that is already alive: a rating, a photograph fourteen days
apart, a note about a bad night, a dose ticked off, a flare that ended, three months of trend with
the flare shaded behind it. Then the only question that cannot be defaulted (*what are you
tracking?*), then your first real entry — ten large targets you can tap or slide a thumb across,
with the card taking the colour of the day as soon as there is a number.

Then the part that is the point: **the card you just filled in flies into place as the first card
on a timeline**, the rail draws downward past it into the days you have not lived yet, and the
streak counts to one. A journal is a promise about the future, and watching your own first entry
become the first thing on a timeline makes that promise in about three seconds.

Everything else first run used to ask for — which questions, which body spots, weight, progress
photos, a name, a theme — has a sensible default and a screen in Settings. The long form is still
one tap away for anybody who would rather build the whole survey first, and both paths produce the
same journal. The main number you pick is what Today asks for every day, what the streak counts,
and the first figure in an appointment pack; it is changeable whenever you like.

**Build your own survey.** Start from a question pack — Eczema/Skin, Carnivore/Diet, POTS,
IBS, Migraine, Allergy/MCAS, Fatigue/Long COVID, Autoimmune, Thyroid, Joint Pain, General
Wellness, Wearable — mix several, switch individual questions off, add your own, and reorder
them. Each question has independent visibility across five surfaces: quick log, detailed log,
dashboard, charts, export. The editor groups them into collapsible sections per pack, with a
filter across the top — sixty questions in one flat list was unusable.

**Log in about a minute.** Quick Log batches four questions per screen with big tap targets and
auto-advance. Your recent answer for each question — a 7-day median for scales, yesterday for
toggles, the last value for numbers — is marked with a dashed ring on the value itself, so
accepting it is one tap and ignoring it costs nothing. It is never a banner asking whether today
was the same as usual, and it is never filled in for you.

**The long form is a form, not a scroll.** Detailed Log lays its sections out as cards — each
with its own sticky heading, answered count, and fold — one column on a phone, two from 900px,
three from 1320px. It is the only screen in the app that widens on a desktop, because it is the
only one that is a form rather than a list. Any past day stays editable from the calendar.

**Numbers are typed, not clicked eleven times.** Tapping a weight opens a keypad — the value at
reading size, a nudge row, ten keys. It takes one decimal for a weight and none for a step count,
and digits, Backspace, Enter and the arrow keys all drive it from a physical keyboard.

**The Diary — one page for the whole day.** Meals and the routine share a screen, over one date,
because "what did I have" and "did I take the morning lot" are asked in the same breath. A sticky
day pager moves both, so filling in yesterday evening — the food *and* the doses — never means
changing tabs. At the top, the day's two headline numbers: what you ate, and how much of the
routine you have answered. Everything is on the page at once; nothing is behind a tab, a toggle
or a sideways scroller.

**Food.** A calorie ring, macro bars, and the day grouped
into Breakfast / Lunch / Dinner / Snack / Drink with per-meal subtotals. Log a meal with the
category, time, description, serving, weight or quantity, notes, and a photo. Calories and macros
can be typed, or estimated by AI if you've set that up — from a photo, from your description, or
from both. Every estimated value is labelled **AI Estimated**, is editable, and is never stored in
the same field as a number you entered. Estimates read "about 520 kcal", because that is what
they are.

**And it gets faster the more you use it.** MyFitnessPal is quick because you never type a food
twice — that's two million foods on a server, which an app with no server and no account cannot
have. So this does the half that actually does the work: people eat the same thirty or forty
things on repeat, so **your library builds itself out of your own logs**. Search it, or pick from
Recent / Frequent / Favourites, and re-logging is one tap — with a serving stepper for anything
that isn't exactly one portion, quick-add calories for when you can't be bothered, and
copy-yesterday for the days that repeat. Set daily targets if you want them; leave them blank and
the diary just shows what you ate. Fixing a food's figures once fixes them everywhere after.

**Your routine — meds, supplements, creams, products.** The things you take and use every day,
as a checklist that answers in one tap. Add an item with a name, a kind (medication, supplement,
cream, product, food or drink), a dose in your own words — *500 mg*, *2 pumps*, *pea-sized*, *1
scoop* — and the parts of the day it belongs to. It then sits on the Diary and on the dashboard,
grouped into Morning / Midday / Evening / Bedtime, and **ticking it off is one tap, with no form
in the way**. The same tap unticks it. Anything you only take when you need it lives in a separate
**As needed** row, offered but never counted as missed.

Two things keep a long routine short. A slot with more than one thing left to take offers
**All 4** — one tap for the handful you swallow in one go, one Undo behind all of it. And a slot
you have finished **folds into a single line**, so a nine-item routine is four rows by bedtime
and the day still fits on one screen. Opening it again is one tap; nothing is ever hidden that
you cannot get back.

Adjusting is one more tap: today's dose can differ from the usual one without editing the plan,
and a dose you deliberately decided against is recorded as a **skip** — which is a different fact
from a box you simply never ticked, and the app never conflates them. Every entry keeps its own
copy of the name, kind and dose as they were the day you logged it, so renaming an item, changing
its dose, or deleting it outright never rewrites what a past day says happened. Doses taken and
"routine completed" can be charted next to your symptoms, and both the per-dose log and the plan
behind it come out in the export.

It is a written record and nothing more. It does not know what interacts with what, does not
check doses, and will not tell you whether something is working.

**Bowel movements.** A quick log with Bristol type, amount, colour, consistency, urgency,
straining, discomfort, notes, and an optional photo. If you ask it to, AI can suggest the
observable attributes from a photo — Bristol type, colour, consistency, form, and nothing else.
It will not tell you what anything means, and the photo stays on your device unless you
explicitly choose that analysis.

**One tap is a whole day.** Today opens with the **Daily Pulse**: your main number, ten large
targets, and the tap *is* the save — no button, no confirmation, no screen. The line under it is
read back out of the journal rather than asserted, so it says "Nothing recorded yet" until the
number is actually there, and it says which end of the scale the number is at. Tapping the same
number again clears it. For most people on most days this is the entire interaction, and a year
of one honest number beats a fortnight of forty.

**Detail comes after, never in front.** Once the day is rated, three to five optional follow-ups
appear, chosen for the score: a hard day is asked about the other symptoms, what you took and
what it looks like; a calm day is asked about sleep and what was different. Nothing already
answered is offered, a photo is only asked for on a bad day or after a week without one, and the
note is last because it is the one that needs typing. Each answers inline with the app's own
input for that question. "Add more detail" keeps the full check-in one tap away.

**Two destinations and one verb.** The navigation is **Today**, a **+**, and **History**. The +
is one tap from anywhere and opens everything a day can hold — check-in, food, routine, photo,
note, bowel movement, measurement — landing on Today, which is the day it adds to. History is
the month, the last fortnight in words, and the two doors out of it: Insights and the Diary.
Settings lives in the header, because a preference is not a destination.

**Open it, log it, close it.** **Quick Add** sits under the pulse and *learns*: the tiles sort
themselves by what you actually tap, frequency decayed by recency, and arranging them by hand
switches that off for good. **Again** is the row under it, and it is the shortest path in the
app — your most-logged foods, the doses you take daily, the spot you photograph, the number you
record, one tap each, ranked together so it is your own week in your own order. **Today's Logs**
is one timeline carrying check-ins, meals, bowel movements, doses and photos in the order they
happened.

Logging is optimistic and reversible. Sheets close on the tap, the row is on the timeline
before the next frame, and the receipt arrives as a toast with an **Undo** in it — which beats a
confirmation step, because it charges only the people who actually made a mistake. Deleting a
log keeps its photo until the Undo has expired, so an Undo never brings a meal back without it.

**See what's happening.** **Insights** is the second tab, and it runs down the questions in the
order people ask them: *over what period* (a range selector at the very top — 30 days, 3 months,
12 months, all — which everything below it genuinely re-reads), *how am I right now* (the hero),
*how does that compare* (four figures and no charts among them), *what has it been doing* (one
trend chart), *how bad were the bad bits* (flares), *what does a year look like* (the heatmap),
*what kind of days are they* (the spread), and *is anything related* (the explorer). Week by
week, the years overlaid, seasonal averages and the scatter each sit behind a labelled expansion
control. Pin up to four metrics and they're still there tomorrow — the first one is what the
whole screen is about, and every one of them is drawn in the trend chart. Food and bowel logs join as derived daily metrics (calories, macros, movement count,
average Bristol type, urgency, straining, discomfort).

**The spread of days.** An average of 5.2 is the same number for someone who scores 5 every day
and someone who alternates 2 and 8, and those are not the same life. Ten columns, one per score,
each carrying its own count, in the year block's colour ramp — then the typical day, the most
common day, the spread in one word (*steady*, *mixed*, *swinging*), and how many days were hard.
"How many days were actually bad" is a count, not a curve.

**Flares, marked by you.** A chronic condition is not a smooth line with a slope; it is long
stretches of "fine, mostly" broken by weeks that reorganise your life. Start a flare, end a
flare — that is the whole interface, and **nothing is detected automatically**, which is a
decision rather than a gap: a run of 7s is not always a flare, and an app that invents medical
events in your history and then reports statistics about them has done something worse than
nothing. The app does the arithmetic: length, coverage, average, median, peak and its date, hard
days, the fortnight before, the fortnight after, and the clear days since the last one — then a
year of them against the year before, with a flare crossing New Year counted in both. Each flare
has its own screen, and its chart draws a fortnight either side, because a flare drawn from its
own first day to its own last day always looks like a flare, and drawn with the fortnight before
it, it looks like what happened.

**The long view**, folded under the year block: a point per calendar month across the whole
journal, this month against the same month last year, best and hardest month, the longest
unbroken calm run, the years overlaid, and seasonal averages. This is the section with the most
ways to mislead, so it has the most floors — a thin month is not plotted, a comparison needs both
sides solid, seasons stay hidden until most months have two years behind them, and a calm run
counts only days logged back to back. Where something is hidden, the reason is printed.

**The trend chart is the comparison.** Metrics that genuinely share a scale — the 1–10 ratings
— share one chart with a fixed 1–10 axis. Anything with its own unit gets its own chart
underneath: same width, same dates, its own axis, one crosshair moving across all of them at
once. The metric the screen is about leads — heaviest line, tallest chart, its 7-day average
dashed in behind it — and the flares you marked are shaded behind every chart in the stack. The
old chart put severity and step count on one pair of axes and printed a note asking the reader
to "compare shapes, not heights"; worse, weight in kg and severity 1–10 land in the same numeric
range, so that chart looked perfectly reasonable and was meaningless. The version before this
one had the opposite fault: a picker that let you pin four metrics above a chart that drew one,
with the comparison exiled to a second card further down the screen. Pinning is now visible
where you pin.

**How it's drawn is your choice, and every choice says what it costs.** Under the chart, "How
it's drawn" — closed, it prints the current answer; open, it is five decisions. *Shape*: a line,
a filled line, steps, or bare dots — and the difference is stated, because steps hold each day's
value until the next one and claim nothing in between, while a line runs straight through days
you never logged. *7-day average*: off, dashed behind the daily line, or the only thing drawn —
smoother, and a single terrible day disappears into it. *Days you didn't log*: joined up, or left
as a gap. *Several ratings*: together on one axis where heights are comparable, or one chart each
when four lines become spaghetti. *Rating axis*: the full 1–10, or fitted to the range you
actually scored — and while that one is on, the chart prints "axis fitted to 3–9 of 1–10, so
differences look bigger than they are", because an axis that starts at 3 flatters a flat
fortnight into a mountain range and nobody reads axis labels. The choices are saved with your
pins, so the chart opens tomorrow the way you left it. Underneath, the same metric averaged into
weeks or into months, with the number of days behind each bar on touch.

**Possible relationships.** Pick something you're tracking and something you suspect; the screen
compares the days both were logged, same-day or with a one-day lag. The two pickers are the
app's own control rather than a native `<select>` — the list runs to two dozen metrics, so it
opens in the same sheet everything else in the app opens in, with ratings grouped apart from
things measured their own way, each option saying what it is measured in, and a filter field
once the list stops being scannable at a glance. This is the most dangerous
screen in the app, and the danger was never bad arithmetic — it is reading "dairy 0.42" as "dairy
is doing this to me" and changing what you eat on the strength of eleven days. So the restraint
is in the code: nothing appears below twelve paired days (absent, not greyed out, with a line
saying how many more it needs); the sample size is printed *above* the result; it is Spearman's
rank correlation with ties averaged, not Pearson's, because these are ratings a person assigned
to their own body and the intervals between them are not equal; "strong" is unavailable below
thirty pairs however large the coefficient; the default shape is a grouped comparison rather than
a scatter, because "on the days you logged more of this, that averaged 6.8 rather than 5.4" is a
sentence you can act on carefully and a cloud of dots with a coefficient is one you will act on
confidently; and "not proof that one causes the other" is on screen at all times.

**Your year, on one screen.** Under the 30-day chart sits the whole last twelve months of the
selected 1–10 metric: one row per month, one square per day, a distinct shade for every score
from 1 to 10, and nothing at all on the days you didn't log. It is months-as-rows rather than the
usual weeks-as-columns for a plain reason — a phone gives a card about 330px, which is 5px per
day laid out by week and 9px laid out by day-of-month. Squares that small are not a tap target,
so a tap *names* the day in a readout under the grid, next to the button that opens it: landing
on the 14th when you meant the 15th is something you can see rather than a screen you have to
back out of. The grid is one tab stop with arrow-key movement, every square says its date and
score out loud, and a month-by-month table underneath states the same figures in words for
anyone who can't use colour.

**Designed, not just built.** *Soft Clinical* — soft graphite in the dark, warm off-white in
the light, muted blue with sage, lavender and clay accents, generous spacing and quiet depth —
with a deliberate hint of neobrutalism: borders a notch above a hairline, hard offset shadows,
chunky buttons that press down into them, and section titles you can find at a glance. Calm, not
loud.

**Built for one thumb.** Sheets rise from the bottom edge and stay welded to it, so their action
row is the closest thing on screen to the thumb rather than the furthest. They are sized in
`dvh` — `vh` on iOS Safari means the viewport *without* the URL bar, which is how a web form
ends up hiding its own Save button — and they get out of the keyboard's way on both engines:
Chromium via `interactive-widget=resizes-content`, iOS Safari via a `visualViewport` listener,
both feeding one CSS variable. A sheet dismisses on Escape, on a tap outside, and on a downward
drag of its heading.

Long forms use progressive disclosure, and the closed rows state their own answers — "Medium ·
Brown", not "More options" — so folding a section away hides the controls and never the
information. Everything the everyday path doesn't need is one tap down: the bowel sheet went
from about 1,500px of scrolling to a single screen, and Bristol type is drawn as the ordered
scale it actually is rather than seven stacked paragraphs.

**Dark, light and Night Light.** Dark by default, with a light theme that's a proper design
rather than an inversion, and a "match system" option. The choice is remembered on the device and
applied before the first paint, so a cold start never flashes white. **Night Light** takes the
blue out of every colour the app paints — a transform of the pixels, not a warm sheet laid over
the top — and pulls the accent into the amber band with them.

**A colour of your own.** A horizontal hue slider re-tints buttons, charts, focus rings and the
backdrop. The accent is *solved* rather than picked: the app walks lightness until the pair
actually measures at WCAG AA, so every one of the 360 positions clears the same bar the shipped
blue did. `tests/theme.test.ts` checks the whole wheel in both themes with Night Light on and
off, and fails the build if any token pair drops below AA. The semantic colours — the severity
ramp, and the hues that tell a food card from a bowel card — deliberately don't move with it.

**Backdrops that appear.** Fog or Aurora, in CSS: no WebGL, no canvas, no device test, nothing to
feature-detect. Chosen on the first launch alongside the colour and theme, so the rest of setup
runs wearing the choice.

**AI (optional, off by default).** One integration, five uses: possible patterns, food from
text, food from a photo, food from both, and bowel-photo attributes. Every one of them shows you
exactly what is about to be sent and waits for you to confirm — nothing is sent on save, in the
background, or on a retry without asking again. With AI switched off there is no analysis button
anywhere and the app makes no network request at all.

Bring your own Google Gemini API key and the
Possible Patterns section gains a second, clearly-labelled source: longitudinal observations a
median split doesn't look for — symptoms that recur together, changes after certain days,
sleep/mood relationships, timing patterns, drifts from your own baseline. Every finding carries
its evidence, an in-plain-words strength, a date range, and a "why this was suggested"
disclosure, and can be dismissed. Nothing runs automatically, nothing is sent without a preview
you confirm, and only numeric answers go — never notes, photos, or your name. Locally
calculated patterns stay exactly as they were and keep working with no key at all.

**Photo progress.** In-app camera with a self-timer, per-body-area tracking, thumbnails, an
A/B comparison slider, and baseline pinning. Photos are blobs in local storage — they never
upload.

**A finish that tells the truth.** Skipping every question in a check-in used to end in
confetti and a streak count — the app congratulating somebody for a blank day. The celebration
is now earned by an actual value, note or photo; without one you get "Nothing logged yet", the
way back, and the main number right there, because one tap is enough to make it untrue. A day
with nothing in it is not written to the journal at all, so it never appears on the calendar, in
a streak, or in an export. And Skip no longer erases: it means "don't ask me these", not "delete
what I already answered".

**Weekly and monthly reports.** Swipe to choose which card types you want, then browse any
period with arrows or a horizontal swipe. Save up to 24 reports to history, share one as an
image, or **print it** — the printed version is a clean, self-contained document with its own
masthead and disclaimer, meant to be handed to a clinician.

**The appointment pack.** Ten minutes with a specialist every few months is what all of this is
for, and the question that opens it — *"so how have you been?"* — is the one memory answers
worst: it reaches for the last bad week, because that is what memory does. So the first thing on
the Export screen, above the three file formats, is **Prepare an Appointment Pack**. Choose a
window — the last 30 days, three months, your own dates, or **since my last appointment** — and
one tap produces one or two printed pages in the order a consultation actually runs: the average
and which way it moved against the same number of days before it, how many days it rests on, your
best, hardest and most common day, how many flares there were and how long they ran and how bad
they got, the three metrics that moved the most, what you took against what the plan asked for, a
before-and-after photo pair, the notes you picked out yourself, and — last, because it is the part
that belongs to you rather than to the app — **your own questions, printed with a rule under each
one so there is somewhere to write the answer down.**

Every section can be switched off, every average carries the coverage behind it, and a figure with
nothing behind it is left out with its reason shown in the app rather than printed as a zero.
Nothing is chosen for you: which notes a doctor reads, and which photos, are decisions the app
declines to make on your behalf.

**Get your data out.** CSV, multi-sheet Excel, and JSON — with date-range filters — plus a full
JSON backup including photos that restores on any device.

**Daily reminder.** Pick a check-in time and download a repeating calendar file, so your phone
reminds you even with the app closed. Browser notifications are offered too, with an honest
note that they only fire while the app is running.

**Extras.** Optional 4-digit app lock. Wearable import from a Google Fit / Fitbit Takeout
export. A read-only web viewer for opening a backup on a desktop. An iOS Home Screen widget
(needs a Mac to finish building).

---

## Try it

```bash
npm install
npm run dev
```

Open the printed URL (usually `http://localhost:5173`) and use a mobile viewport (~390px) —
the app is designed phone-first.

First run shows the onboarding wizard. To jump straight into a fully populated app, pick
**"Just exploring? Load example data"** — an Eczema/Skin + Carnivore setup with ~34 days of
history, enough to exercise the dashboard, charts, calendar, patterns, reports, and exports.

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | TypeScript over `src/lib`, `src/components`, `src/types` |
| `npm run test` | Vitest: pure-function suites + full-app jsdom render tests |
| `npm run check` | typecheck + test + build, in that order — what CI runs |

---

## Deploying it

Everything is client-side, so "deploying" means serving a folder of static files.

**GitHub Pages** is wired up. The `pages.yml` workflow builds and publishes on every push to
`main`, and reads the real Pages base path, so a project site at `user.github.io/HealthJournal/`
works without editing anything.

It needs **one manual switch, once**: go to **Settings → Pages** and set **Source** to
**GitHub Actions**. Creating a Pages site requires admin rights that the workflow's built-in
token does not have, so the deploy fails with *"Resource not accessible by integration"* until a
human does this. After that, every push deploys on its own — re-run the failed job or push
anything to `main` to publish the first time.

**Anywhere else** (Netlify, Vercel, Cloudflare Pages, your own server):

```bash
npm run build          # -> dist/
BASE_PATH=/sub/path/ npm run build   # if it won't sit at the domain root
SITE_URL=https://example.com npm run build   # absolute URLs in link previews
```

Then serve `dist/`. Serve it over HTTPS if you want the PWA install prompt and offline mode.

Two workflows guard the repo: `ci.yml` runs `npm run check` on every push and PR, and
`ios-build.yml` compiles the native iOS wrapper on a macOS runner.

---

## Install it on a phone

Open the deployed site on your phone and choose **Add to Home Screen**. It then launches
full-screen, works offline, and gets Home Screen shortcuts straight into today's log or this
week's report.

Installing is also the most reliable way to keep your journal: browsers evict storage for
sites you haven't visited, and iOS Safari does so after about a week. See below.

---

## Where your data lives, and how to not lose it

Your journal is written to this browser's IndexedDB (`src/lib/storage.ts`, which also polyfills
the Claude artifact `window.storage` API so the same `App.tsx` runs in both places). Photos are
blobs in the same store. Nothing is uploaded, because there is nothing to upload it to.

The flip side is that **nobody can recover it for you**. Three things protect you, in order of
how much they help:

1. **Save a backup file.** Settings → Backup & storage → *Full backup*. It's an ordinary `.json`
   on your device that restores everything, photos included. Insights nudges you when your
   journal has drifted too long since the last one.
2. **Install to the Home Screen.** Installed apps are exempt from the idle-eviction rules that
   clear ordinary sites.
3. **Let the app ask for persistent storage.** It requests this automatically; Settings shows
   whether the browser granted it, with a manual button if not.

Clearing site data by hand still erases everything. Export a backup first.

### Optional sync across devices

**Off by default. Local Only is the product; this is an option.** No account is needed, nothing
is uploaded, and every word above stays true unless you turn this on yourself.

Turned on, it does one thing: log something on your phone, open the app on your computer, and
it's already there. Edit it there and the change comes back. Settings shows two words — *Local
only* or *Synced* — and the setup is four screens: what this does, a code emailed to you, a
passphrase, done. There is no password to invent, and the words *database*, *bucket* and *token*
appear nowhere a normal user can see them.

**Local saves never wait for the network.** The journal is written to disk on the same debounce
it always used, and the sync engine finds out afterwards. No signal, expired session, server
down, laptop lid closed mid-push — none of it can reach the save path.

What that costs to build, and what it buys:

| Problem | How it's solved |
| --- | --- |
| Two devices both log Tuesday | A day's sync identity is its **date**, not the random local id each device minted. One Tuesday, always. |
| Two devices edit the same day | Entries merge **answer by answer**. A phone recording pain at breakfast and a laptop recording sleep at midnight are not in conflict, and last-write-wins would throw one away. |
| A deletion gets undone by the other device | Deletions are **tombstones** in the journal itself, so they survive a reload and travel like any other change. Undo lifts the tombstone too. |
| A pull silently skips a row | The cursor rides a **server sequence**, not a timestamp. Two rows written in the same millisecond can't slip through the gap. |
| A request that may or may not have arrived | Pushes are **idempotent** — the server keeps the newer of two versions — so retrying is always safe. |
| A device that's been offline for a week | The conflict rule is enforced **in SQL**, not only on the client, so a stale write is dropped by the server. |
| Both sides already have a journal | The first pass is a **union**. Every day from both devices survives; neither side is overwritten. |
| Photos are enormous | **Separate opt-in.** Sync your entries without paying for a year of daily photos on a metered connection. |

#### What the encryption does and doesn't claim

Every record's contents are sealed on your device with **AES-256-GCM**, under a key derived by
**PBKDF2-SHA256 at 600,000 iterations** (OWASP's current figure) from a passphrase that is never
transmitted. The ciphertext is bound to the row it belongs to, so it can't be moved between
records without failing to decrypt. The server holds a kind, an id, a timestamp, a device id, a
deleted flag — and blocks it cannot read. The derived key is stored **non-extractable** in
IndexedDB, so the passphrase is never written down anywhere and the key can't be read back out
as bytes by any code, including this app's.

What is deliberately **not** claimed, in the app or here:

- **Not zero-knowledge.** The app is delivered over the web. Whoever controls the host controls
  the code that handles your passphrase. That's true of every browser-delivered encrypted app,
  and saying so is more useful than a badge implying otherwise.
- **Not HIPAA, not "medical grade".** No compliance posture is claimed anywhere in this project.
- **Not protection against someone holding your unlocked phone.** The local journal is plaintext
  on the device — that's what makes it instant and offline-first.

Losing the passphrase means the synced copy can't be read again. The copy on your device is
unaffected, and a downloaded backup still survives everything.

#### Pointing it at a server

This repository ships no server and no credentials, because a shared one would mean strangers'
health journals landing in an account nobody owns. Sync becomes available when a Supabase project
is configured, in either of two ways:

1. **For a deployment.** Set the repository secrets `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY`; the Pages workflow passes them to the build.
2. **For one device.** Settings → Sync across devices → *Use your own sync server*, and paste the
   two values.

Either way: create a project, open its SQL editor, and run [`supabase/schema.sql`](supabase/schema.sql)
— it creates the tables, the row-level security policies, the conflict rule, the realtime
publication, and the private photo bucket, and it's safe to re-run.

The **anon key is meant to be public**: it identifies the project and authorises nothing on its
own, because every table is restricted to the signed-in owner. The **service-role key bypasses
all of that** and must never be added to this repository, the build, or a browser.

With neither source set, `syncConfig()` returns null, Settings says so in one plain sentence, and
the app is exactly the local-first journal it has always been.

### Optional AI observations, and your API key

Off by default, and everything else works identically whether it's on or off.

Setup is a **five-step guided walkthrough** launched by one button on Insights — you never
have to work out what to do next, and you never leave the screen you started on:

1. **What it does**, and exactly what would and wouldn't leave the device.
2. **Choose a provider** (below). Gemini is preselected as the shortest path.
3. **Get a key** — opens that provider's console in a new tab, with the things to click on that
   page written out, because "create an API key" is where most people stop.
4. **Paste it** — verified the moment it's pasted. Continue stays disabled until it checks out
   (with an explicit override so a flaky connection isn't a dead end).
5. **Review and run** — the exact payload, then the analysis, landing straight on the results.

**Settings → AI observations** manages it afterwards (test, replace, remove); replacing runs the
same guided flow rather than a second, subtly different form.

#### Which providers, and why not ChatGPT

This app has no backend, so every request goes straight from your browser to the provider. That
makes browser CORS support a hard requirement, not a preference:

| Provider | Free tier | Notes |
|---|---|---|
| **Google Gemini** | Yes, no card | The default. Keys start `AQ.` (older ones `AIza`); both work. |
| **OpenRouter** | Free models, no card | OpenAI-compatible; one key reaches many makers' models. |
| **Anything OpenAI-compatible** | Depends | Groq, Mistral, or a model on your own machine — you supply the endpoint. |

**OpenAI (ChatGPT) is not on that list**, and the app says so in the picker rather than letting
you find out the hard way: their API sends no CORS headers, so calling it from a web page is
impossible without a server to relay through — which is the one thing this app refuses to have.
OpenRouter can reach OpenAI's models on your behalf if you want them.

#### No model ID is load-bearing

The first version hard-coded `gemini-2.5-flash`. Google retired it for newly-created keys months
ahead of the published shutdown date, and every new user got a 404 from a build that had worked
the week before. So models are never assumed:

- **Setup asks your key what it can reach** (`GET /models`) and scores the results — newer over
  older, small and fast over frontier, free over paid, stable over preview. One round trip
  proves the endpoint is reachable, the browser is allowed to call it, the key is accepted, *and*
  something usable sits behind it.
- **A model that disappears repairs itself.** If a request comes back "no longer available", the
  app re-resolves from the live list, retries once, and remembers the new choice. Exactly one
  retry — a broken provider shouldn't become a loop.

#### What leaves the device

Only after you confirm a preview that spells it out:

- the labels of the metrics you track, and
- one row per logged day of **numeric answers** in the window, with days numbered from the start
  of the window rather than dated.

What never leaves: written notes, photos, your name, anything identifying, any entry outside the
window, and any question you've excluded from charts. `tests/ai.test.ts` asserts each of those.

The key is stored under its own storage key, outside the journal object, so it cannot end up in
an export or a backup — the same arrangement as the PIN record. You can add, replace, test, and
remove it, and choose between remembering it on the device and holding it only for the session.
Settings states the limitation plainly rather than implying a vault: **a locally stored key is
not encrypted and cannot be**, because a local-first app has no secret to encrypt it with that
someone holding your unlocked device wouldn't also have. Revoking the key at your provider is
what actually stops it working.

Findings are phrased as observations, never conclusions, and output that ignores that
instruction is softened on the way in (`scrubCausalLanguage`) rather than rendered as-is.
AI-generated cards are visually distinct from the locally calculated ones at a glance.

### Optional PIN lock

Off by default — the app opens straight to your journal. If the device is ever shared, turn on
a 4-digit PIN in **Settings → App lock**. It re-locks whenever the app is backgrounded, and only
a salted SHA-256 hash is stored (`src/lib/lock.ts`), in its own key that is never included in a
backup. Forgetting the PIN never locks you out: "Forgot your PIN?" removes the lock, not the
journal.

---

## Read-only backup viewer

The build ships a second page, **`/viewer.html`**. Drop a `.json` backup on it and browse the
dashboard, calendar, reports, photo comparisons, and exports with no ability to edit. It uses
isolated in-memory storage, never touches a journal already in that browser, and discards the
file when the tab closes. Useful for reviewing your journal on a desktop, or for handing a
backup to a partner or clinician along with the viewer link.

---

## Project layout

```
health-journal/
├── index.html / viewer.html    # two entry points
├── vite.config.ts              # base-path-aware build, PWA, chunking
├── src/
│   ├── main.tsx                # storage polyfill, mounts App
│   ├── App.tsx                 # the app (migrated single-file artifact)
│   ├── components/             # ambient backdrop, appearance panel, lock,
│   │                           #   recovery, viewer landing, metric picker,
│   │                           #   field select (the app's own dropdown),
│   │                           #   chart view controls (how it's drawn),
│   │                           #   year heatmap, score distribution, episode
│   │                           #   timeline, the trend/comparison chart,
│   │                           #   relationships explorer, long-term view,
│   │                           #   appointment pack (the printed page),
│   │                           #   first run (the four acts)
│   ├── lib/
│   │   ├── theme.ts            # design tokens, dark/light/night, hue derivation,
│   │   │                       #   contrast solving
│   │   ├── ai.ts               # optional AI analysis (credential, payload, parsing)
│   │   ├── aiProviders.ts      # provider catalogue, model discovery + scoring
│   │   ├── storage.ts          # IndexedDB window.storage polyfill
│   │   ├── tracking.ts         # food + bowel logs, food library, goals, daily metrics
│   │   ├── routine.ts          # meds/supplements/creams/products: items, doses, checklist
│   │   ├── metrics.ts          # the one registry of chartable derived metrics
│   │   ├── heatmap.ts          # the 12-month year grid, summaries and colour ramp
│   │   ├── distribution.ts     # days per score, the three middles, hard/calm counts
│   │   ├── episodes.ts         # the flare model + every number one can be asked for
│   │   ├── appointmentPack.ts  # the printable summary: figures, floors, what it refuses
│   │   ├── intro.ts            # the first-run choreography (hero, FLIP, timeline draw)
│   │   ├── pulse.ts            # the one-tap day, and which details to offer next
│   │   ├── quickActions.ts     # learned ordering + one-tap repeats, scored
│   │   ├── longterm.ts         # monthly averages, year-over-year, seasons, floors
│   │   ├── relationships.ts    # Spearman with ties, lag, coverage, sample floors
│   │   ├── exports.ts          # typed CSV / wide-table generation
│   │   ├── questions.ts        # custom-question sanitising
│   │   ├── answers.ts          # type-safe answer read/write
│   │   ├── validate.ts         # runtime validation + causal-language audit
│   │   ├── lock.ts             # PIN hashing
│   │   ├── reminders.ts        # check-in times, .ics, notifications
│   │   ├── durability.ts       # persistent storage, backup freshness
│   │   ├── deeplink.ts         # ?screen= allowlist for Home Screen shortcuts
│   │   ├── chartView.ts        # how the trend chart is drawn (pure, saved)
│   │   ├── motion.ts           # Lenis + GSAP, and the scroll lock behind sheets
│   │   ├── sound.ts            # the synthesised instrument
│   │   ├── feedback.ts         # one door: haptics + sound + motion + visual
│   │   ├── sync/               # optional cross-device sync
│   │   │   ├── types.ts        #   the record contract
│   │   │   ├── merge.ts        #   conflict resolution (pure)
│   │   │   ├── project.ts      #   journal <-> records (pure)
│   │   │   ├── crypto.ts       #   PBKDF2 + AES-GCM sealing
│   │   │   ├── keyStore.ts     #   non-extractable key in IndexedDB
│   │   │   ├── backend.ts      #   the server contract + an in-memory one
│   │   │   ├── supabase.ts     #   the only file that knows what Supabase is
│   │   │   ├── config.ts       #   where the server address comes from
│   │   │   └── engine.ts       #   pull, merge, apply, push, retry
│   │   └── widgetBridge.ts     # iOS widget App Group bridge
│   ├── types/models.ts         # the data contract
│   └── styles/index.css
├── supabase/schema.sql         # sync tables, RLS policies, conflict rule
├── public/                     # icons, og-image.png, robots.txt
├── ios/                        # Capacitor wrapper + WidgetKit starter
├── docs/                       # APP_STATE, product plan, widget setup
└── tests/                      # 967 tests across 44 suites
```

Colours are not written into components. `src/lib/theme.ts` owns two palettes and a live token
object that `App.tsx` reads as `C.something` at render time; a theme switch mutates it in place
and mirrors every token onto `:root` as a `--fhj-*` custom property, so the stylesheet and the
markup stay in sync from one source. `src/styles/index.css` holds the shared component classes
(buttons, chips, cards, segmented controls, switches, sheets, Quick Add tiles, timeline rows,
AI badges, empty states, skeletons) so screens compose rather than restating padding and hover
behaviour inline. The tactile treatment lives in two tokens — `--fhj-bw` and `--fhj-shadow-pop`
— plus one `.fhj-pop` class, which is why it can be turned up or down in one place.

`App.tsx` is deliberately still one file (its artifact heritage) under `// @ts-nocheck`, but the
data model lives in `src/types/models.ts` and is enforced at runtime by `src/lib/validate.ts`,
checked against live demo data in the tests. Modules are being lifted out of it one at a time —
`exports.ts` was first, and everything added since (`reminders`, `durability`, `deeplink`) is
fully typed from the start. Corrupted local data routes to a recovery screen that offers a
download before any reset, never a silent wipe.

## Motion and polish

- **Lenis** smooths wheel scrolling; touch stays native so mobile logging is never hijacked.
- **GSAP** drives screen transitions, the Quick Log finish moment, report card reveals, the
  setup wizard's per-step stagger, and the swipe-deck fling physics.
- **The ambient backdrop is CSS** — three blurred layers on the compositor, tinted live from
  `--fhj-hue`. Under `prefers-reduced-motion` it holds still rather than disappearing.
- **One feedback layer** (`src/lib/feedback.ts`). A call site names what the person did —
  `feedback("save")`, `feedback("error", { el })` — and four channels answer: haptics, sound,
  motion, and a visual acknowledgement on the element itself. On a phone with a Taptic Engine it
  drives real impact weights and notification patterns through Capacitor; everywhere else it
  falls back to scaled `navigator.vibrate` patterns; on a laptop with neither it still pulses the
  button, which is the one channel every user has.
- **Some sounds carry a position, not an event.** A rung on a 1–10 scale, a step in the setup
  wizard, and a digit on the keypad each pick their pitch from where they land in the series
  (`place("scale", 7, 10)`), so a 3 never sounds like an 8, typing a weight reads as a run, and
  the last setup screen resolves an octave above the first. One key throughout — F major
  pentatonic — so no two sounds in the app can clash.
- Every animation, sound, and haptic respects `prefers-reduced-motion` and the in-app toggles.
  Each channel degrades **independently**: sound off, haptics off, reduced motion, no motor, no
  audio device — each subtracts one and leaves the others working, and none of them can take a
  save down with it.
- Keyboard users get a skip link, a `main` landmark, visible focus rings, and `aria-current` on
  the active tab. `prefers-contrast: more` darkens text and card borders.
- The 30-day trend metric picker is a single tab stop with roving focus: ←/→/Home/End move
  between metrics, the selection is always scrolled into view, edge fades and arrows show that
  more exist, and a vertical wheel scrolls it horizontally on a desktop.
- Both themes are contrast-audited in CI (`tests/theme.test.ts`), and the severity ramp picks
  its own label colour by luminance so a swatch is never white-on-pale.
- Charts draw themselves in once and then hold still; under `prefers-reduced-motion` recharts
  renders the final frame directly.
- A confirmation sheet opening over a form makes that form `inert`, so its own buttons leave the
  tab order and the accessibility tree while the dialog asking about them is up.
- Overlays are exempt from the dashboard's entrance stagger. Sheets render as children of the
  screen that opened them, so they used to inherit its 240ms delay — the scrim arrived a quarter
  of a second after the sheet sitting on it had already slid up. Motion has to make the app feel
  faster, and that was the one place it did the opposite, on the most pressed path in the app.
- Undo is offered for anything reversible without loss — saving a log, deleting one, re-logging a
  favourite. It is deliberately *not* offered for the irreversible ones (clearing photos,
  restoring a backup over a journal), which keep their confirmation, because there is nothing to
  undo them with.
- Every interactive element on every screen was audited for target size and accessible name.
  Chips and segmented controls are 42px, calendar days and the sheet's Close button 44, and a
  section heading that is itself a control gets a control's target rather than a heading's line
  box.
- The toast lives above the nav bar rather than at the top of the screen, for the same reason the
  sheet actions moved: the Undo inside it has to be reachable by the thumb that caused it. It
  never takes focus — it reports something that already happened.

**On react-bits and Vanta.** [react-bits](https://github.com/DavidHDev/react-bits) was evaluated
and deliberately not adopted: it is a copy-in component gallery whose register — spotlight
cards, animated gradients, decrypting text — is louder than this product wants, and the handful
of interactions worth having (tactile press, card expansion, timeline reveal) are a dozen lines
of CSS each with no dependency and no bundle cost.

Vanta was adopted, and then removed in 1.7.0 for the same reason react-bits was never adopted.
It cost ~613KB of three.js, it needed a live WebGL context — so a driver blocklist, iOS Lockdown
Mode, or a context lost to a tab sleep left it silently blank — and it declined to start at all
on any device reporting fewer than 4 cores or under 4GB of RAM, which is a normal phone. The
feature was therefore absent for most of the people it shipped to, and no test noticed, because
no test asserted that anything appeared. What replaced it is three blurred `<span>`s and a
handful of keyframes, which is what the effect was always worth.

## Native iOS app + Home Screen widget

`ios/` holds a Capacitor-wrapped native project plus starter WidgetKit source
(`ios/HealthJournalWidget/`) for a real Home Screen widget showing today's streak and key
metric — data reaches it via an on-device App Group, no network involved. Finishing it needs a
Mac and Xcode; see **[docs/WIDGET_SETUP.md](docs/WIDGET_SETUP.md)**.

## Licence

No licence has been declared yet — that's the repository owner's call. Until one is added, the
default applies: all rights reserved.
