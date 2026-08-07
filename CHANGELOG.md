# Changelog

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
