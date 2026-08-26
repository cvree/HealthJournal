# Automation

*What the app is allowed to work out for itself, what it is not, and why the
line is drawn where it is.*

---

## The problem this is solving

Chronic illness tracking fails for one boring reason: it is work, and it is work
that lands hardest on the days you can least afford it. The day you most need a
record is the day you have the least capacity to make one. Every feature in this
journal has been shaped around that, and automation is the sharpest version of
it — the difference between "start a sun session" (one tap, easy) and "remember
to end the sun session" (a chore you will fail, on the day you feel worst,
forever).

But automation in a health record is genuinely dangerous, in a way it is not in
a to-do app. The value of eighteen months of data is that somebody can look at a
bad fortnight and **trust what it says**. An automation that guesses wrong does
not lose a data point — it inserts a plausible fiction into the middle of the
evidence, and six months later there is no way to tell which rows were guesses.

So the whole design is one trade: the app may write without being asked, in
exchange for never being able to hide that it did.

---

## The contract

Every automation in this app satisfies all five clauses. The list is enforced by
`src/lib/automation.ts`, which is where each one has to declare what it watches,
what it writes and how a person undoes it.

**1. It only concludes things the device actually observed.**
Not "you probably ate lunch around one". The app does not know that. "Your
phone's position fixes got four times less accurate and stayed that way for six
minutes" is an observation. What it implies is stated as an implication, in the
words of a guess.

**2. Whatever it writes is labelled as its own, permanently.**
A session the app ended carries `estimated: true` for life. Confirming it sets
`confirmed: true` and *does not clear `estimated`* — a person agreeing with a
guess does not turn the guess into a measurement. Every surface that draws a
session reads both flags.

**3. It asks once, and ignoring it is a valid answer forever.**
One card, one tap to accept, a slider to correct, and no second appearance in a
louder voice. A session that is never confirmed stays on the timeline, in the
charts and in the exports, permanently labelled as an estimate — which is a fine
thing for a health record to contain and a much better outcome than a nag.

**4. It is switchable individually, in a list that names what it watches.**
Not one "smart features" toggle. Settings → Automations shows every one with
three lines under it: **Watches**, **Writes**, **Undo**.

**5. It never sends anything anywhere.**
Every automation runs on the device against data the device already has. The
only outbound request in this app remains the daily weather one, under its own
separate consent. No automation may add to it, ever.

---

## What ships now

### Sun sessions end themselves

**The signal.** A phone's position fix carries a reported accuracy in metres,
and that number is an excellent indoor detector. Outdoors with a view of the sky
GNSS resolves to five or fifteen metres; step inside and the satellites go
behind a roof, the platform falls back to wi-fi and cell trilateration, and the
same API starts reporting sixty, ninety, two hundred. The person has not moved.
The **sky** has moved — and the sky is exactly what a sun session is measuring.

That coincidence is why this is honest here and would not be honest in a step
counter. The app is not inferring a location. It is inferring whether there is a
roof between this phone and the sun.

**What is kept.** `src/lib/presence.ts` handles timestamps, accuracy in metres
and (where a device has the sensor) lux. **There is no latitude or longitude in
that module at all** — not in the state, not in the samples, not in what is
written to disk. `presenceWatch.ts` is the single boundary where a platform
`Position` is touched, and it reads three fields and drops the object. A test in
`tests/presence.test.ts` asserts the stored state's exact key set, so a
coordinate threaded through "just for convenience" fails the build.

**Why it is not a threshold.** One bad fix is a bus, a bridge, a tree, a phone
changing pockets. A reading only moves a *run*; a run only becomes an answer
after it has held for six minutes. And when it does, **the time reported is the
start of the run**, not the moment the app became sure — because the person went
inside when the fixes got worse, not five minutes later. That backdating is the
entire difference between "we ended your session" and "we think you came in at
3:42, is that right?".

**Silence is not evidence.** A phone that has stopped reporting is in a bag, on
a dead battery, or has had permission revoked. That is `unknown`, never
`indoor`. Treating silence as a roof is how an automation ends a two-hour hike
at minute eleven.

**A refusal is not a change of mind.** If the platform denies position, the
session carries `autoEndBlocked` — a separate flag from `autoEnd`. The person's
decision stands and the live screen explains what is stopping it, rather than
silently showing nothing and appearing to have been declined by the person who
just asked for it.

### Sessions you can come back to

A session used to live in the screen's React state, which meant it lived exactly
as long as somebody was looking at it — the wrong lifetime for the one feature
whose premise is that you put the phone away and go outside. It is now mirrored
to device-local storage on every tick and owned above the router, so:

- Leaving the screen does not end it. Today shows a live row with a running
  clock and one tap back to it.
- Closing the app does not end it. It is picked up on the next launch, however
  long that was.
- **It ends when you end it.** That is the rule.

A running session is never written to the journal, and never syncs — a session
running on a phone is not running on a laptop, and the sync engine has no
vocabulary for "in progress here, not there".

### A forgotten one closes itself and asks

Six hours with nobody watching, and the session is closed at the last time it
could still honestly have been a session in the sun: the newest sample with the
sun above the horizon, or the cap, whichever came first. A session begun at 8pm
and left running overnight closes at sundown, not at 2am.

Written as `auto-cap`, confidence 0.15, with the detail line saying in plain
words that **the time is a guess**. One left running into a different day is
dropped rather than given an invented end — a made-up number in a health record
is worse than a missing one.

### Offering to start (`sun-auto-start`, off by default)

The mirror image: while the sun screen is open and the phone starts seeing open
sky, offer a session backdated to when you went out. It **offers**; it never
starts one. Creating a record nobody asked for is a different and worse kind of
rude than ending one they did.

Its honest limit: a web app is not granted a background position watch, so this
only fires with the app open. A true background version belongs in the Capacitor
wrapper (`ios/`), where the OS can deliver significant-location changes.

---

## Designed, not built

The rest of the map. Each is written the way the shipped ones are: the signal
first, then what the app would be entitled to claim from it. Several are
deliberately marked as things this app should probably **not** do, because the
most useful part of a document like this is the list of automations that were
considered and rejected.

### Environment — the strongest case, and mostly already there

Daily context already attaches temperature, pressure, humidity, UV, air quality
and pollen to every day, automatically, under its own consent. It is the app's
oldest automation and the model for the rest: the person does nothing, the
environment is recorded, and the app declines to say what any of it caused.

Worth adding:

- **Pressure-drop flags.** An 11 hPa overnight fall is a real, observable event
  and a common trigger report. The app can mark the day. It cannot say it caused
  anything, and `lib/relationships` already enforces the sample floors that stop
  a coincidence being read as a mechanism.
- **First frost, first heat, season turn.** Cheap from data already stored, and
  the kind of thing that explains a fortnight nobody could account for.
- **Indoor/outdoor time as its own metric.** `presence.ts` already produces it
  during a session; generalising it would give a daylight-exposure figure with
  no logging at all. Needs the background watch, so: Capacitor.
- **Air quality crossings.** A day where AQI crossed from fair to poor is an
  event; a day where it sat at 41 is not.

### Sleep, movement, heart — only through a real integration

HealthKit/Health Connect are the honest route. A phone cannot infer sleep
credibly from a browser, and an app that guesses at sleep and files the guess
next to a symptom rating has made its own data useless. The `ios/` wrapper is
where this belongs, and the record would carry a `source` the way a lab result
does.

### Medication and routine adherence

Already one tap. Automatable further only via a connected device (a smart cap, a
Bluetooth inhaler). **The app must never infer a dose was taken.** A false
positive here is a patient-safety problem, not a data-quality one — and the
person reading the adherence chart may be a clinician.

### Stress — where inference gets genuinely dangerous

The temptation is enormous and the ground is bad. What is observable is
heart-rate variability (via an integration), sleep disruption, and typing or
interaction patterns. What is *not* observable is stress. The gap between "your
resting heart rate is elevated" and "you are stressed" is where an app starts
telling somebody how they feel, which is both wrong and, for people already
fighting to have their symptoms believed, actively harmful.

The defensible version: surface the **observation** — "resting heart rate has
been higher than your baseline for four days" — as an environmental fact, in the
same non-causal voice as the weather, and let the person say what it was. Never
a "stress score".

### Relationships and social contact

The single most under-recorded determinant of health, and the one the app has
the least honest access to. Contact frequency, call logs and calendar density
are technically readable on some platforms and this app should not read any of
them: the privacy cost is enormous, the inference is weak, and a journal that
quietly knows who you saw is a different product with a different threat model.

The right shape is a **question, not a sensor**: an optional daily or weekly
one-tap field — time with people, felt supported, felt alone — sitting in the
custom-question system that already exists, chartable against everything else
through `lib/relationships`. Automation's contribution here is not detection but
*not asking twice*: the pulse queue in `lib/pulse.ts` already knows how to stop
asking a question that is always answered the same way.

### Determinants of health more broadly

Housing, money, work, food security, care access. All of them shape a chronic
illness more than most of what this app measures, and none of them are sensor
data. The automation that helps here is **removing friction from recording
them**, not inferring them: a monthly rather than daily cadence, plain language,
skippable, and never scored. A journal that computes a "social determinants
index" has invented a number about somebody's poverty and put it next to their
symptom ratings.

### Episodes and flares

Plausible and worth doing: the app can already see a run of days above somebody's
own threshold, and `lib/episodes.ts` has the model. Offering "this looks like it
might be a flare — start one from Tuesday?" is a proposal with a backdated start,
exactly like the sun session. Same rules: it offers, it backdates to the
evidence, it labels the start as estimated.

### Photo and note capture

Timestamp and orientation are already carried by the file. The one genuinely
useful automation is **filing to the right day** — a photo taken at 11:40pm
belongs to that day, not to tomorrow, which is the same local-date rule
`localDate()` enforces everywhere else.

---

## Rejected, and why

- **A stress score.** See above. The app does not get to tell somebody how they
  feel.
- **Inferring meals from location or time of day.** "You were near a restaurant
  at 1pm" is surveillance producing a guess, and the guess lands in a food log
  that somebody may show a dietitian.
- **Inferring that a dose was taken.** Safety.
- **Reading contacts, calendars or call logs.** Enormous privacy cost, weak
  inference, wrong threat model for a journal.
- **Any automation that writes silently.** Every one of them writes a labelled,
  reversible record with a question attached, or it does not ship.
- **A single "smart features" switch.** It is not one decision, and bundling it
  into one is how consent stops meaning anything.

---

## Where the code is

| File | What it holds |
| --- | --- |
| `src/lib/automation.ts` | The registry, the contract, the per-automation switches |
| `src/lib/presence.ts` | Indoor/outdoor inference. Pure. Holds no coordinates |
| `src/lib/presenceWatch.ts` | The only file that touches a platform `Position` |
| `src/lib/sun.ts` | Auto-end decisions, persistence, resume, revision |
| `tests/presence.test.ts` | Hysteresis, backdating, staleness, the no-coordinates guarantee |
| `tests/autoEnd.test.ts` | Decisions, records, corrections, old journals, blocked platforms |
| `tests/automationUi.test.tsx` | The whole thing driven through the real app |
