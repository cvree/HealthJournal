# Family Health Journal

A private, mobile-first, single-person health tracking journal. Daily 1–10 surveys, trends, calendar, photo progress, weekly/monthly reports, and clean CSV / XLSX / JSON exports — all stored **on your device**. No account, no server, and — with fonts self-hosted — **zero network requests at all** once the app is loaded. Installable as a PWA and fully offline-capable.

> This app is a personal tracking tool and is not medical advice. It does not diagnose, treat, cure, or prevent any condition. Insights are worded as "possible patterns" only — never causes.

## Run it locally

```bash
npm install
npm run dev
```

Open the printed URL (usually `http://localhost:5173`). For the best feel, open browser dev tools and use a mobile viewport (~390px) — the app is designed phone-first.

First run shows the onboarding wizard. To skip straight to a fully populated app, choose **"Load example data"** (the Connor setup: Eczema/Skin pack + a few Carnivore/Diet questions, skin areas neck/scalp/left hand/right hand, ~34 days of history — enough to exercise the dashboard, charts, calendar, insights, reports, and exports).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server with hot reload |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | TypeScript check (new code in `src/lib` + `src/components`) |
| `npm run test` | Vitest: pure-function suite + full-app render smoke tests (jsdom) |
| `npm run check` | typecheck + test + build, in that order |

## Where data lives

- **In this repo/site**: IndexedDB in your browser (`src/lib/storage.ts` polyfills the Claude artifact `window.storage` API). Photos are stored as blobs there too, so they survive reloads.
- **Inside a Claude.ai artifact**: the real `window.storage` is detected and used unchanged — the same `App.tsx` runs in both places.
- Backups: Export screen → JSON backup (optionally including photos) can be restored on any device.

Clearing site data in the browser erases the journal. Export a JSON backup first.

### Optional PIN lock

Off by default — the app opens straight to your journal, one open profile, same as always. If this device is ever shared, turn on a 4-digit PIN in **Settings → App lock**. It re-locks whenever the app is backgrounded, and only a salted SHA-256 hash is stored (`src/lib/lock.ts`), in its own storage key that's never included in an exported backup. Forgetting the PIN never locks you out of your data: "Forgot your PIN?" removes the lock (not the journal) after a confirmation.

## Project layout

```
health-journal/
├── index.html              # entry point
├── package.json
├── vite.config.ts
├── src/
│   ├── main.tsx            # installs storage polyfill, mounts App
│   ├── App.tsx             # the whole app (migrated single-file artifact)
│   ├── components/
│   │   └── VantaBackdrop.tsx  # optional ambient background (lazy-loaded)
│   ├── lib/
│   │   ├── storage.ts      # IndexedDB window.storage polyfill
│   │   └── motion.ts       # Lenis smooth scroll + GSAP transitions
│   └── styles/index.css    # Tailwind v4 + Fraunces font
├── public/                 # favicon, static assets
├── exports/                # drop your exported CSV/XLSX/JSON here (gitignored)
├── docs/                   # APP_STATE.md handoff + product plan
└── tests/pure.test.ts      # Vitest suite over the pure-function core
```

`App.tsx` is intentionally still one file (the artifact heritage) with `// @ts-nocheck`, but the data model now lives in `src/types/models.ts` and is enforced at runtime by `src/lib/validate.ts` (checked against live demo data in tests). `src/lib/exports.ts` is the first fully-typed module extracted from it (CSV/wide-table generation, parity-tested against the in-app wrappers); `src/lib/questions.ts` sanitizes custom questions inside the template merge; `src/lib/answers.ts` provides type-safe answer read/write helpers; corrupted local data routes to a recovery screen (download-before-reset) instead of a silent wipe. It exports `__internals` — the pure functions (report builder, photo pair picker, migrations, smart defaults, backup validation) that the tests exercise. Splitting it into typed modules is the next structural step; see roadmap.

## Motion & polish

- **Lenis** smooths wheel scrolling (touch stays native so mobile logging is never hijacked).
- **GSAP** drives screen transitions and the Quick Log finish moment; report cards stagger in.
- **Vanta** ambient backdrop is **off by default** — enable it in Settings → "Ambient backdrop". It lazy-loads three.js only when turned on and never runs under `prefers-reduced-motion`.
- Every animation, sound, and haptic respects `prefers-reduced-motion` and the in-app toggles (Settings → Taps & sounds).

## Read-only web viewer

The build ships a second page: **`/viewer.html`** — a read-only viewer for journal backups. Open it, drop in a `.json` backup (data-only or full-with-photos), and browse the dashboard, calendar, reports, photo comparisons, and exports without the ability to edit anything. Everything stays in the browser tab: the viewer uses isolated in-memory storage, never touches a journal stored in that browser, and discards the file when the tab closes. Use it to review your journal on a desktop, or hand a backup file to a partner or clinician along with the viewer link. The Log tab, Settings, and Edit Setup are removed; a "Read-only" badge is always visible; CSV/XLSX export from the opened backup still works.

## Install on your phone (PWA)

The production build ships a web app manifest and service worker (`vite-plugin-pwa`). Deploy `dist/` anywhere over HTTPS, open it on your phone, and use "Add to Home Screen" — the journal then launches full-screen and works fully offline. Icons live in `public/pwa-*.png`.

## Native iOS app + Home Screen widget

`ios/` contains a Capacitor-wrapped native project plus starter WidgetKit source (`ios/HealthJournalWidget/`) for a real Home Screen widget showing today's streak and key metric — data reaches it via an on-device App Group, no network involved. Finishing it requires a Mac + Xcode; see **[docs/WIDGET_SETUP.md](docs/WIDGET_SETUP.md)** for the full walkthrough.

## Push to GitHub

```bash
git init
git add .
git commit -m "Family Health Journal — initial project"
git branch -M main
git remote add origin git@github.com:<you>/health-journal.git
git push -u origin main
```

To deploy the static build anywhere (GitHub Pages, Netlify, Vercel): `npm run build`, then serve `dist/`. Everything is client-side.

## Roadmap

See `docs/PRODUCT_PLAN.md`. P8 hardening is largely complete: render smoke tests, self-hosted fonts, PWA/offline, error boundary, memoized template computation, gallery pagination. Remaining: incremental typing of `App.tsx` and a manual accessibility pass on real devices.
