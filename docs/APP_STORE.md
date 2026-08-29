# The submission itself

Everything App Store Connect will ask for, answered, plus the listing copy ready
to paste. [SHIPPING.md](./SHIPPING.md) covers the decisions behind it —
distribution path, the entity question, the legal picture. This file is the
mechanical part.

Run `npm run check:store` before every archive. It fails on the things that get
a binary bounced automatically.

---

## Before you archive

```bash
npm run version:ios     # MARKETING_VERSION from package.json, build number from commit count
npm run check           # typecheck, tests, web build
npm run check:store     # submission preflight
npx cap sync ios        # copy dist/ into the native project, install pods
```

Then in Xcode: select the `App` scheme → *Product → Archive* → *Distribute App*.

`npm run check:store` will fail until you have replaced `PUBLISHER_NAME`,
`CONTACT_EMAIL` and `EFFECTIVE_DATE` in `public/privacy.html` and
`public/support.html`, and deleted the yellow box at the top of each. Those two
pages must be live at a public URL before you submit — App Store Connect
requires both a privacy policy URL and a support URL, and a reviewer will click
them.

> A support alias is a better idea than a personal address on a public page.
> Whatever you use here is going to be scraped.

---

## What was fixed to make this submittable

Four things in the repo would have stopped or delayed a submission. All four are
now done — recorded here so a future reader knows why the code looks like this.

| Problem | Consequence | Fix |
|---|---|---|
| No `NSCameraUsageDescription` | iOS terminates the app on camera access; review rejects the binary | Added to `ios/App/App/Info.plist` |
| No `PrivacyInfo.xcprivacy` | Automated rejection notice ITMS-91053 — the app target uses `UserDefaults` in `WidgetBridgePlugin.swift` | Added and wired into the Resources build phase |
| `IPHONEOS_DEPLOYMENT_TARGET = 14.0` | `getUserMedia` in `WKWebView` needs 14.3, so the camera failed silently on the bottom of the supported range | Raised to 15.0 (project and Podfile) |
| `MARKETING_VERSION = 1.0` vs `1.27.0` in `package.json` | Two versions drifting apart; build numbers that don't increase get uploads refused | `npm run version:ios` derives both |

Capacitor's own pods ship their privacy manifests, so only the app target needed
one. **When you add the widget target** (see [WIDGET_SETUP.md](./WIDGET_SETUP.md)),
it reads `UserDefaults` too and needs its own copy of `PrivacyInfo.xcprivacy` —
copy the app's and add it to the widget's Resources phase.

---

## The App Privacy questionnaire

The one worth slowing down for. It produces the nutrition label on your listing,
it is a binding disclosure, and it must agree with
`ios/App/App/PrivacyInfo.xcprivacy`. Answer it for the app **with every optional
switch turned on**, because that is the version some users will run.

**Do you or your third-party partners collect data from this app?** → **Yes.**

Counter-intuitive, since the default install collects nothing. But "collect"
covers optional features, and under-declaring is the mistake that costs you a
rejection or worse. Two types:

**Contact Info → Email Address**
- Collected: yes — only when the user enables sync
- Linked to identity: yes
- Used for tracking: no
- Purpose: App Functionality

**Health & Fitness → Health**
- Collected: yes — when sync is on (as ciphertext you cannot read) or when the
  user runs the optional AI analysis with their own key
- Linked to identity: yes
- Used for tracking: no
- Purpose: App Functionality

**Everything else: not collected.** No identifiers, no usage data, no
diagnostics, no location, no contacts, no purchases, no search or browsing
history, no sensitive info beyond health.

**Tracking: none.** No ATT prompt is needed, and no advertising identifier is
touched.

When it asks about third parties, the AI providers (Google AI Studio,
OpenRouter, or a user-configured OpenAI-compatible endpoint) receive health data
*only* under a key the user supplied themselves. Disclose it.

---

## Export compliance

You will be asked on every upload, and the answer is not "no". The app performs
real cryptography: AES-256-GCM with PBKDF2-SHA256 key derivation, in
`src/lib/sync/crypto.ts`.

These are standard, published algorithms used to protect the user's own data,
which is the classic shape of an exemption — but the exemption is a
determination you make, not one you may assume, and it can carry a
self-classification report and an annual filing. Read Apple's export compliance
page and the underlying rules once, decide deliberately, and write the answer
down. Do not blanket-answer "no encryption" to make the dialog go away; that
answer is false for this app.

Once you have decided, you can stop being asked on every upload by adding
`ITSAppUsesNonExemptEncryption` to `Info.plist` with the value your
determination supports. It is deliberately not set for you here.

---

## Age rating

Expect **Infrequent/Mild Medical or Treatment Information**. Everything else is
None. Do not aim the listing at children — the app is not designed for under-13s
and the privacy policy says so.

---

## Review notes

Paste into *App Review Information → Notes*. Health apps get rejected constantly
because a reviewer hit something that looked like a wall.

```
No account is required. The app opens straight into a working journal with
no sign-in, and every core feature works offline with no server.

Two features are optional and OFF by default. You do not need to enable
either one to review the app:

1. Cross-device sync. Requires an account. Records are encrypted on-device
   (AES-256-GCM, key derived from a user-chosen passphrase) before upload,
   so the server holds only ciphertext.

2. AI pattern analysis. Requires the user's own API key for a provider they
   choose. It ships with no key and makes no network request until one is
   entered. Only daily numeric answers and field labels are sent — never
   notes, photos, or names — and the app displays exactly what will be sent
   before sending it.

The app may offer to set a PIN during onboarding. It is optional and can be
skipped; if you set one and want to start over, deleting and reinstalling
gives a clean state.

The camera is used only when the reviewer taps a photo shot inside a journal
entry. Photos remain on device.

This app does not diagnose, treat, or give medical advice, and it declines to
do so by design — AI output is filtered for diagnostic language before it is
shown. Disclaimers appear during onboarding, on the analysis screen, and on
every generated report.
```

---

## Listing copy

Swap in your chosen name (see [SHIPPING.md](./SHIPPING.md) for the shortlist).
Character limits are Apple's and are enforced.

**App name** (30 max) — must be a globally unique string. Note that the *base
word* need not be unique: three different apps ship as "Marginalia: …". A
distinctive word plus a differentiating subtitle is the reliable pattern.

```
Bellwether: Symptom Journal
```

**Subtitle** (30 max)

```
The early sign, written down
```

A deliberate trade: the subtitle is indexed for search, so the keyword-stuffed
version ("Private symptom & flare diary") would rank marginally better. The
brand line is worth more than the margin, and the keywords field below does that
job without costing the line that makes someone remember the app.

**Promotional text** (170 max — editable without a new build)

```
Log your day in under a minute. See what tends to happen together. Bring a clear
report to your next appointment. No account, and nothing leaves your phone
unless you say so.
```

**Description** (4000 max)

```
A symptom journal that stays on your phone.

Bellwether is for anyone tracking something over months rather than days —
a condition being worked out, a treatment being adjusted, a pattern nobody has
named yet. It is built on one idea: you will not remember what week three
looked like, so write it down while it is happening.

PRIVATE BY DEFAULT
No account. No sign-up. No analytics, no advertising, no trackers, and nothing
sold to anyone. Your journal is stored on your device. It goes somewhere else
only if you switch on a feature that sends it, and there are exactly two of
those.

A MINUTE A DAY
Answer a short check-in built from the things you actually care about. Add a
note, a meal, a symptom, a measurement, or a photo. The app adjusts how often it
asks rather than nagging you daily forever.

SEE WHAT GOES WITH WHAT
Charts across weeks and months. A year at a glance. Episodes lined up against
what surrounded them. The app shows what tends to occur together and is careful
to say that together is not because — it will not name a condition or suggest a
treatment, by design.

BRING SOMETHING TO YOUR APPOINTMENT
Turn any stretch of your journal into a clear summary of what you actually
recorded. Ten minutes with a doctor goes further when you are not reconstructing
three months from memory.

OPTIONAL, AND OFF UNTIL YOU SAY SO
• Encrypted sync across your devices. Records are encrypted on your phone with a
  passphrase only you know, before anything is uploaded. The server holds
  ciphertext it cannot read.
• AI-assisted observations, using an API key you bring yourself. It sends only
  daily numbers for the window you chose — never your notes or photos — and
  shows you exactly what it is about to send.

Bellwether is a personal tracking tool. It is not medical advice, and it
does not diagnose, treat, cure, or prevent any condition. For medical concerns,
consult a qualified healthcare professional.
```

**Keywords** (100 characters total, comma-separated, no spaces after commas —
do not repeat words already in your name or subtitle)

```
diary,log,chronic,illness,flare,tracker,wellness,pattern,offline,notes,private,health,trigger
```

**Category:** Primary *Health & Fitness*, secondary *Medical* — or leave the
secondary blank. *Medical* draws closer scrutiny under guideline 1.4.1 for no
extra reach.

---

## Screenshots

Required: **6.9"** (1320 × 2868) or **6.7"** (1290 × 2796). Apple scales these
down for smaller devices, so one set is enough. iPad screenshots only if you
ship iPad support.

Take them on the Simulator with a journal that has a few weeks of realistic data
in it — an empty app photographs badly, and a first screenshot showing an empty
state is a lost install. Suggested five, in order:

1. Today's check-in — what using it actually feels like
2. The year heatmap — the payoff for logging
3. Possible patterns — the reason to keep going
4. The appointment report — the concrete use
5. The privacy card in Settings — the differentiator

`Cmd+S` in Simulator saves a correctly-sized PNG. No alpha channel, no rounded
corners, no device frames.

---

## The rest of the form

- **Support URL** — your deployed `support.html`
- **Privacy policy URL** — your deployed `privacy.html`
- **Marketing URL** — optional; leave blank rather than pointing at a repo
- **Copyright** — `2026 PUBLISHER_NAME`
- **Contact** — the address a reviewer can actually reach you at within a day
- **Content rights** — you own or have licensed everything; there is no
  third-party content in this app
- **Pricing** — free, no in-app purchases. Adding IAP later brings guideline
  3.1.1 into scope
- **Availability** — if you include the EU, you must supply verified trader
  contact details, which are published on the listing. See SHIPPING.md §2

---

## After the first submission

Two things become permanent once a build is accepted: the **bundle ID**
(`com.cvree.bellwether`) and the **SKU**. The display name can change later;
those cannot. If an LLC is likely, settle it before the first upload rather
than after.
