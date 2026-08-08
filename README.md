# Health Journal

A private daily health journal that lives on your device.

You build a check-in around your own situation — skin, gut, migraine, POTS, fatigue, a diet
experiment, whatever you're actually tracking — answer it in about a minute a day, and watch
the trends come out over weeks. When you have an appointment, you print a summary and take it
with you.

There is no account, no server, and no tracking. Out of the box, after the app has loaded once
it makes **no network requests at all** — it installs to a phone's Home Screen and works
completely offline. The one exception is opt-in: if you add your own Google Gemini API key in
Settings, the AI observations feature will send a minimal summary of your logged numbers to
Google *when you ask it to*, and shows you exactly what it's about to send first. It ships off,
and everything else keeps working whether you turn it on or not.

> **Not medical advice.** This is a personal tracking tool. It does not diagnose, treat, cure, or
> prevent any condition. It surfaces *possible patterns* in your own logs and never claims a cause.
> For medical concerns, symptoms, medication changes, restrictive diets, fainting, allergic
> reactions, abnormal labs, or major health changes, consult a qualified healthcare professional.

---

## What it does

**Build your own survey.** Start from a question pack — Eczema/Skin, Carnivore/Diet, POTS,
IBS, Migraine, Allergy/MCAS, Fatigue/Long COVID, Autoimmune, Thyroid, Joint Pain, General
Wellness, Wearable — mix several, switch individual questions off, add your own, and reorder
them. Each question has independent visibility across five surfaces: quick log, detailed log,
dashboard, charts, export.

**Log in about a minute.** Quick Log batches four questions per screen with big tap targets,
smart defaults pre-filled from your own 7-day median, and auto-advance. Detailed Log is the
long form when you want it. Any past day stays editable from the calendar.

**See what's happening.** Dashboard with today's key metric, streak, 7/30-day averages,
week-over-week comparisons, a 30-day trend chart comparing up to four metrics at once, weekly
bars, and cautiously-worded "possible pattern" cards that need at least six paired days before
they'll say anything. Every chartable metric is reachable in the trend picker — it scrolls, it
says so, and it works from a keyboard.

**Dark and light.** Dark by default, with a light theme that's a proper design rather than an
inversion, and a "match system" option. The choice is remembered on the device and applied
before the first paint, so a cold start never flashes white. Both themes are contrast-audited:
`tests/theme.test.ts` fails the build if a token pair drops below WCAG AA.

**AI observations (optional, off by default).** Bring your own Google Gemini API key and the
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

**Weekly and monthly reports.** Swipe to choose which card types you want, then browse any
period with arrows or a horizontal swipe. Save up to 24 reports to history, share one as an
image, or **print it** — the printed version is a clean, self-contained document with its own
masthead and disclaimer, meant to be handed to a clinician.

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
   on your device that restores everything, photos included. The dashboard nudges you when your
   journal has drifted too long since the last one.
2. **Install to the Home Screen.** Installed apps are exempt from the idle-eviction rules that
   clear ordinary sites.
3. **Let the app ask for persistent storage.** It requests this automatically; Settings shows
   whether the browser granted it, with a manual button if not.

Clearing site data by hand still erases everything. Export a backup first.

### Optional AI observations, and your API key

Off by default, and everything else works identically whether it's on or off. Turning it on in
**Settings → AI observations** needs a Google Gemini API key you create yourself at
[Google AI Studio](https://aistudio.google.com/) — the app ships with none, hard-codes none, and
reads none from the environment.

What actually leaves the device, only after you confirm a preview that spells it out:

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
someone holding your unlocked device wouldn't also have. Revoking the key at Google is what
actually stops it working.

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
│   ├── components/             # Vanta backdrop, lock, recovery, viewer landing,
│   │                           #   metric picker
│   ├── lib/
│   │   ├── theme.ts            # design tokens, dark/light, contrast helpers
│   │   ├── ai.ts               # optional Gemini analysis (key, payload, parsing)
│   │   ├── storage.ts          # IndexedDB window.storage polyfill
│   │   ├── exports.ts          # typed CSV / wide-table generation
│   │   ├── questions.ts        # custom-question sanitising
│   │   ├── answers.ts          # type-safe answer read/write
│   │   ├── validate.ts         # runtime validation + causal-language audit
│   │   ├── lock.ts             # PIN hashing
│   │   ├── reminders.ts        # check-in times, .ics, notifications
│   │   ├── durability.ts       # persistent storage, backup freshness
│   │   ├── deeplink.ts         # ?screen= allowlist for Home Screen shortcuts
│   │   ├── motion.ts           # Lenis + GSAP
│   │   └── widgetBridge.ts     # iOS widget App Group bridge
│   ├── types/models.ts         # the data contract
│   └── styles/index.css
├── public/                     # icons, og-image.png, robots.txt
├── ios/                        # Capacitor wrapper + WidgetKit starter
├── docs/                       # APP_STATE, product plan, widget setup
└── tests/                      # 167 tests across 12 suites
```

Colours are not written into components. `src/lib/theme.ts` owns two palettes and a live token
object that `App.tsx` reads as `C.something` at render time; a theme switch mutates it in place
and mirrors every token onto `:root` as a `--fhj-*` custom property, so the stylesheet and the
markup stay in sync from one source. `src/styles/index.css` holds the shared component classes
(buttons, chips, cards, segmented controls, switches, sheets) so screens compose rather than
restating padding and hover behaviour inline.

`App.tsx` is deliberately still one file (its artifact heritage) under `// @ts-nocheck`, but the
data model lives in `src/types/models.ts` and is enforced at runtime by `src/lib/validate.ts`,
checked against live demo data in the tests. Modules are being lifted out of it one at a time —
`exports.ts` was first, and everything added since (`reminders`, `durability`, `deeplink`) is
fully typed from the start. Corrupted local data routes to a recovery screen that offers a
download before any reset, never a silent wipe.

## Motion and polish

- **Lenis** smooths wheel scrolling; touch stays native so mobile logging is never hijacked.
- **GSAP** drives screen transitions, the Quick Log finish moment, report card reveals, and the
  swipe-deck fling physics.
- **Vanta** ambient backdrop is off by default; enabling it lazy-loads three.js and it never
  runs under `prefers-reduced-motion`.
- Every animation, sound, and haptic respects `prefers-reduced-motion` and the in-app toggles.
- Keyboard users get a skip link, a `main` landmark, visible focus rings, and `aria-current` on
  the active tab. `prefers-contrast: more` darkens text and card borders.
- The 30-day trend metric picker is a single tab stop with roving focus: ←/→/Home/End move
  between metrics, the selection is always scrolled into view, edge fades and arrows show that
  more exist, and a vertical wheel scrolls it horizontally on a desktop.
- Both themes are contrast-audited in CI (`tests/theme.test.ts`), and the severity ramp picks
  its own label colour by luminance so a swatch is never white-on-pale.

## Native iOS app + Home Screen widget

`ios/` holds a Capacitor-wrapped native project plus starter WidgetKit source
(`ios/HealthJournalWidget/`) for a real Home Screen widget showing today's streak and key
metric — data reaches it via an on-device App Group, no network involved. Finishing it needs a
Mac and Xcode; see **[docs/WIDGET_SETUP.md](docs/WIDGET_SETUP.md)**.

## Licence

No licence has been declared yet — that's the repository owner's call. Until one is added, the
default applies: all rights reserved.
