# Shipping this to real iPhones

Everything between "it builds in the Simulator" and "my sister has it on her
phone." Answered in the order the questions actually bite:

1. [Who do you want to reach?](#1-pick-a-distribution-path) — decides how much of the rest applies
2. [LLC or not?](#2-the-entity-question) — decides *when* you enrol with Apple
3. [What this repo needed](#3-what-this-repo-needed) — the blockers, and which are now fixed
4. [The submission itself](#4-the-submission)
5. [What "legally covered" means](#5-the-legal-picture) for an app like this one
6. [If "Health Journal" is taken](#6-if-health-journal-is-taken) — five alternatives

The mechanical half of step 4 — the listing copy, the App Privacy answers, the
review notes, ready to paste — lives in **[APP_STORE.md](./APP_STORE.md)**.

> None of this is legal advice. The entity and liability sections are a map of
> the questions, not answers to them.

> None of this is legal advice. The entity and liability sections are a map of
> the questions, not answers to them.

---

## 1. Pick a distribution path

"Family and friends" and "an actual App Store app" are different amounts of
work, and only one of them needs most of this document.

| Path | Reach | Costs | Review | Expires | Effort |
|---|---|---|---|---|---|
| **PWA (Add to Home Screen)** | Anyone with a link | Nothing | None | Never | Already done |
| **TestFlight, internal** | 100 people you add as App Store Connect users | $99/yr | None | Build dies at 90 days | A weekend |
| **TestFlight, external** | 10,000 people via a public link | $99/yr | Beta App Review, once per version, usually a day | Build dies at 90 days | A weekend |
| **Unlisted app** | Anyone with the direct link; unsearchable | $99/yr | Full App Review + a request form to Apple | Never | Everything in §4 |
| **Public App Store** | Everyone | $99/yr | Full App Review | Never | Everything in §4, plus a name nobody else has taken |

### The honest recommendation

**For family and friends specifically: TestFlight external.** You send one
link, they install one app, nobody needs to be added to anything, and you
never expose your legal name on a public listing. The 90-day build expiry
sounds worse than it is — you push a new build when you have new work, which
for this repo is roughly weekly, and each upload resets the clock for
everyone.

**Before you spend $99, though:** the PWA already works. `vite-plugin-pwa` is
configured, the Pages workflow deploys it, and Safari's Add to Home Screen
gets your family a real icon on their home screen today, offline, for nothing.
What it does *not* get them is the lock-screen widget (`ios/HealthJournalWidget`
is a native target — Safari cannot run it) and it leaves the journal on
Safari's storage terms rather than an app's. For a journal people are meant to
keep for years, that second one is the real argument for going native.

Do both. Ship the PWA link this afternoon, start the Developer Program
enrolment in parallel, move people over when TestFlight is live.

---

## 2. The entity question

### Does an LLC have to come first?

**For TestFlight only: no.** Enrol as an individual. It is same-day, costs
$99, and no public listing carries your name.

**For a public App Store listing: form it first, and here is the specific
reason.** Apple offers two enrolment types:

- **Individual** — your own legal name is displayed publicly as the app's
  seller and developer. Not a setting. There is no way to show a trade name.
- **Organization** — the entity's name is displayed. Requires the LLC to
  exist, plus a [D-U-N-S number](https://developer.apple.com/support/D-U-N-S/)
  (free from Dun & Bradstreet, usually under a week) whose registered name and
  address match your filing exactly.

Switching individual → organization later is not a settings change. It means a
second Apple Developer account and an app transfer between teams. Doable, and
people do it, but it is a distinctly worse afternoon than deciding up front.

There is a second, newer reason. Under the EU's Digital Services Act, anyone
distributing on EU storefronts must supply verified **trader** contact details —
name, street address, phone, email — and Apple publishes them on the listing.
No trader details, no EU availability. As an individual that is your home
address on a public web page. An LLC with a registered agent gives you an
address that is not where you sleep.

### What an LLC does and does not do

**Does:** separates business liability from your personal assets for claims
arising *after* formation. Puts a name that isn't yours on the listing. Makes
the D-U-N-S/trader/tax paperwork coherent.

**Does not:** protect you from your own negligent acts — "I formed an LLC" is
not a defence to "you personally wrote software that harmed me." Does not
substitute for disclaimers or insurance. Does not survive if you commingle
funds and ignore the formalities.

**Rough costs:** state filing $50–$500 depending on state, registered agent
$100–150/yr, and watch for franchise tax (California's $800/yr minimum is the
one that surprises people). D-U-N-S is free.

If you go public and want actual protection rather than a shield-shaped object,
the pairing is LLC **plus** tech E&O insurance. The LLC alone is half of it.

### "If I just call it a beta or prototype, am I covered?"

No, on two separate counts.

**With Apple, it is a rejection reason, not a shelter.** App Review Guideline
2.2 is explicit that demos, betas, and trial versions do not belong on the App
Store and that TestFlight is where they go. Labelling a public submission
"beta" makes it *more* likely to be rejected, not less likely to be scrutinised.

**Legally, a maturity label is not a disclaimer.** "Beta" does not limit
liability, does not create a warranty exclusion, and does not change the
regulatory read on what the software does — that turns on intended use and the
claims you make, not on how finished you say it is. A court asks what you told
people the app was for; a version label is not an answer to that question.

What actually does the work, in descending order of how much it does:

1. **Not making claims you can't support.** Your strongest asset here is that
   the app already refuses to diagnose, and refuses it in code (`src/lib/ai.ts`
   scrubs diagnostic language out of model output on the way back in; there are
   tests for it). Keep that. It is worth more than any paragraph of terms.
2. **A real limitation-of-liability and disclaimer-of-warranties clause.**
   Apple's [standard EULA](https://www.apple.com/legal/internet-services/itunes/dev/stdeula/)
   is the free, sane default and already contains both — you can simply not
   supply a custom one and it applies.
3. **The disclaimers already in the UI** (`src/App.tsx:211`, and the footer
   text at `FirstRun.tsx:1100`). Keep them where a user actually reads them.
4. **The word "beta."** Approximately nothing.

TestFlight *is* genuinely lower risk than a public listing, but for practical
reasons rather than legal ones: a closed group of people who know you, who
accepted Apple's beta terms, who are not going to sue you.

---

## 3. What this repo needed

Found while reading the project. **All of the mechanical ones are now fixed** —
kept here because the reasons matter, and because `npm run check:store` will
re-fail on any of them if they regress.

### Fixed: the camera had no usage description

`src/App.tsx:2264` calls `getUserMedia` for the in-app camera. iOS kills any
app that touches the camera without `NSCameraUsageDescription` in `Info.plist`,
and App Review rejects the binary before that. Added — check the wording still
matches what the feature does before you submit, because review reads it.

The file picker path (`src/App.tsx:1218`) does *not* need a photo-library key —
`WKWebView` routes `<input type="file">` through the out-of-process picker,
which grants access per-file without a permission prompt.

### Fixed: there was no privacy manifest

The one that would have bounced the upload without a human ever looking at it.
Since May 2024 Apple requires a `PrivacyInfo.xcprivacy` in any target that uses
a "required reason" API, and `WidgetBridgePlugin.swift` reads and writes
`UserDefaults` in the shared App Group. Missing, that upload returns
**ITMS-91053**.

Added at `ios/App/App/PrivacyInfo.xcprivacy`, declaring the `UserDefaults`
reason (CA92.1) and the two data types the app can transmit when its optional
features are on. Wiring it into the Xcode project mattered as much as writing
it: a manifest that is not in the Resources build phase never enters the
bundle, and fails exactly as if it did not exist.

Capacitor ships manifests for its own pods, so only the app target needed one.
**The widget target will need its own** when you create it in Xcode — it reads
`UserDefaults` too.

### Fixed: the deployment target was too low for your own camera

`IPHONEOS_DEPLOYMENT_TARGET = 14.0`, but `getUserMedia` inside `WKWebView` only
works from **iOS 14.3** — so on 14.0–14.2 the camera silently failed. Raised to
15.0 in both the project and the Podfile.

### Fixed: version numbers had drifted

`MARKETING_VERSION` sat at `1.0` while `package.json` had reached `1.27.0`, and
the build number was a hand-maintained `1`. Since every upload needs a build
number strictly greater than the last, a remembered counter fails the first
evening you archive twice.

`npm run version:ios` now derives both: the marketing version from
`package.json`, and the build number from the commit count, which is monotonic
and cannot be forgotten.

### Still yours to decide: the app name

"Health Journal" is generic enough that App Store Connect will very likely
refuse to reserve it. **[Five alternatives are in §6](#6-if-health-journal-is-taken)**,
three of them checked against the store.

The bundle ID (`com.cvree.healthjournal`) is separate and never shown to users —
but it is permanent once submitted, so if the LLC is happening, use its domain
now.

### Fixed: the App Privacy answers in `docs/WIDGET_SETUP.md` were out of date

That doc said the privacy questionnaire was "straightforward here — no data
collection, no tracking, no network calls." True once. Not true after optional
sync and the BYO-key AI analysis landed, and the wrong answer to give on a form
Apple treats as a binding disclosure. Corrected, and pointed at the worked
answers in [APP_STORE.md](./APP_STORE.md).

### Fixed: there was no privacy policy and no support page

App Store Connect will not let you submit without **both** a privacy policy URL
and a support URL. Both now exist as `public/privacy.html` and
`public/support.html`, deploy with the existing Pages workflow, and are written
from the code rather than from a template — the sync section describes what
`supabase/schema.sql` actually stores, and the AI section describes what
`buildAnalysisInput` actually sends.

They also carry a Washington My Health My Data-shaped consumer health data
section, which is the state law most likely to reach an app like this one.

One subtlety worth knowing: the PWA service worker was configured to fall back
to the app shell for any navigation, which would have served the *journal* to a
reviewer clicking your privacy URL. Both pages are now in the fallback denylist.
The existing `viewer.html` entry had the same bug in a quieter form — it was
anchored on `/`, which stops matching under a Pages sub-path deploy — so all
three are now anchored on the filename.

Each page has three placeholders (`PUBLISHER_NAME`, `CONTACT_EMAIL`,
`EFFECTIVE_DATE`) and a yellow box telling you to fill them in.
`npm run check:store` fails while any of them survive.

### Still yours to decide: the licence

The README notes the licence is undeclared, which means default copyright — all
rights reserved — on a public repo. That is a perfectly reasonable position for
a product you intend to sell or control. It is worth holding *deliberately*
rather than by omission, because the repo is public and the current answer is
the one a reader assumes rather than the one you chose.

---

## 4. The submission

> The paste-ready half of this — listing copy, the App Privacy questionnaire
> answered field by field, export compliance, review notes, screenshot specs —
> is in **[APP_STORE.md](./APP_STORE.md)**. What follows is the order to do
> things in.

### Before the Mac

1. **Enrol.** [developer.apple.com/programs](https://developer.apple.com/programs/) —
   $99/yr, renews annually, must be 18+. If enrolling as an organization,
   get the D-U-N-S number first (§2).
2. **Sign the agreements** in App Store Connect. Free apps need the Free Apps
   agreement only — no banking details, no tax forms.
3. **Write the privacy policy** and get it live at a stable URL. It must
   describe, specifically: local-first storage as the default; that sync is
   opt-in, encrypted client-side, and involves Supabase holding an email plus
   ciphertext; that AI analysis is opt-in, uses the user's own API key, and
   sends daily numeric answers to a provider they chose. The schema comment in
   `supabase/schema.sql` is already an honest description of what the server
   sees — it is most of a first draft.

### On the Mac

`docs/WIDGET_SETUP.md` covers the Xcode mechanics: setting your Team, the App
Groups capability on both targets, and building the widget. Do that first, then:

4. **Register the bundle ID and App Group** in the Developer portal so the
   provisioning profiles Xcode generates are real ones.
5. **Set versions.** `MARKETING_VERSION` to something meaningful, and bump
   `CURRENT_PROJECT_VERSION` on every single upload.
6. **Confirm the icon.** `AppIcon-512@2x.png` at 1024×1024 is the single-size
   asset modern Xcode wants — it is present and correct. It must have no alpha
   channel and no rounded corners.
7. **Archive** → Product → Archive → Distribute App → App Store Connect.

### In App Store Connect

8. **Create the app record** against the bundle ID.
9. **The App Privacy questionnaire.** The important one. Answer it as the app
   behaves when a user turns everything on, not as it behaves by default:
   - Health & Fitness data — collected, linked to identity only if sync is on,
     not used for tracking.
   - Contact info (email) — only under sync, for app functionality.
   - Declare the third-party AI providers as recipients when the user enables
     that feature.
   - Not used for tracking, no data broker, no advertising — all true here, and
     all worth saying plainly.
10. **Age rating.** Expect "Infrequent/Mild Medical or Treatment Information."
    Do not aim the listing at under-13s unless you want COPPA in your life.
11. **Export compliance.** You use real encryption (AES-256-GCM via WebCrypto
    in `src/lib/sync/crypto.ts`), so do not blanket-answer "no." Standard
    algorithms protecting the user's own data generally fall under an
    exemption, but the questionnaire — and whether you owe an annual
    self-classification report — is worth ten minutes of reading rather than a
    guess.
12. **Review notes.** Tell the reviewer there is no account, that the PIN lock
    is user-set and skippable, and how to reach the features that look
    server-backed. Health apps get rejected constantly because a reviewer hit a
    login wall and had no credentials.
13. **Screenshots** for the required iPhone sizes, description, keywords,
    support URL.
14. **Submit.** First review is typically a day or two.

### Guidelines that specifically apply to this app

- **1.4.1** — medical apps must be accurate and must not provide inaccurate
  readings or treatment. Your existing disclaimers are the response to this.
- **2.2** — betas belong on TestFlight, not the App Store (see §2).
- **5.1.1 / 5.1.2** — privacy policy required; sharing with third parties needs
  consent. The AI feature's explicit "here is what is about to be sent" summary
  is exactly the right shape; make sure it stays in front of the first send.
- **5.1.3** — health data may not be used for advertising, marketing, or data
  mining. Trivially satisfied, and worth never breaking.

---

## 5. The legal picture

Where the actual exposure is, for a personal health-logging app that gives no
advice.

**FDA.** Software that helps someone maintain a healthy lifestyle, or that
merely stores, transfers, and displays their own records, sits outside device
regulation — the 21st Century Cures Act carved both out explicitly. This app is
squarely in that space. The one path *out* of it runs through the AI feature:
software that names a condition or suggests a treatment starts to look like
clinical decision support, which is regulated. The ban on diagnostic language
in `src/lib/ai.ts` is not just good taste — it is the thing keeping the app on
the right side of that line. Treat those tests as load-bearing.

**HIPAA.** Does not apply. You are not a covered entity or a business
associate; HIPAA governs providers, plans, clearinghouses and their vendors,
not an app someone downloads. `supabase/schema.sql` already says this. Keep
saying it, and never imply otherwise in marketing — a false HIPAA claim is its
own problem.

**The FTC is the realistic one.** Section 5 covers deceptive statements, and
for a privacy-forward app the risk is not doing something bad — it is
*promising* something you later break. Your README and store listing will say
things like "nothing leaves unless you switch it on." That has to stay
literally true through every future feature, including analytics you might be
tempted to add. Separately, the FTC's Health Breach Notification Rule now
explicitly reaches health apps: an unauthorised disclosure of identifiable
health data triggers notification duties. Local-first storage plus
client-side encryption means there is very little there to disclose, which is
the best possible answer to that rule.

**State law.** Washington's My Health My Data Act is the one with teeth — broad
definition of consumer health data, a consent regime, a requirement for a
separate consumer-health-data privacy policy, and a private right of action,
which is rare and means individuals can sue. It reaches entities doing business
in Washington regardless of size. Your defensible position is that you collect
almost nothing: the journal lives on the user's device, and the server holds
opaque ciphertext. That is a genuinely strong posture — but if you ever add a
feature where you hold readable health data, get advice before shipping it.
Most of the comprehensive state privacy laws have 100k-consumer thresholds you
will not approach.

**Terms.** Apple's standard EULA applies automatically if you don't supply your
own, and it disclaims warranties and limits liability. For a free app shared
with people you know, that plus the in-app disclaimers is a proportionate
answer. Write custom terms when you start charging money.

### The short version

- Family and friends on TestFlight: **no LLC, no custom terms.** Enrol as an
  individual, keep the disclaimers, ship this month.
- Public listing: **form the LLC first**, enrol as an organization, keep Apple's
  EULA, and price out E&O insurance.
- Either way, "beta" protects you from nothing. The refusal to diagnose does.

---

## 6. If "Health Journal" is taken

It almost certainly is. But the constraint is narrower than it looks: Apple
requires the **exact 30-character name string** to be unique, not the words in
it. Three unrelated apps currently ship as "Marginalia: …", and several as
"Daymark: …". So the pattern that reliably works is a distinctive base word plus
a differentiating subtitle — you are not hunting for an unclaimed word in the
English language.

That said, the journalling category is genuinely picked over. Searching the
store for the obvious candidates turned up **Daybook**, **Cairn Journal**,
**Longhand**, **Marginalia**, **Commonplace** and **Daymark** all taken, several
by apps in this exact category. Cairn Journal in particular is a 2025
health-and-mood journal — close enough that it is worth avoiding on more than
trademark grounds.

Five that survived, roughly in the order I would try them:

**1. Throughline** — *no App Store listing found in this category.*
The line that runs through everything and makes separate episodes one story.
It is what the app is literally for: not "here are your numbers" but "here is
what connects them." Sayable, spellable, one word, and it means something the
moment you hear it. Store name: `Throughline: Health Journal`.

**2. Bellwether** — *no App Store listing found in this category.*
The bell-wearing sheep that leads the flock; in ordinary use, the early sign
that tells you what is coming. That is exactly the job of a symptom log — you
track the small thing in week one so you recognise it in week nine. Slightly
harder to spell than Throughline. Store name: `Bellwether: Symptom Journal`.

**3. Ledgerline** — *not found; almost certainly clear.*
In musical notation, the short line you draw to hold a note that has fallen
outside the staff — the mark that gives an out-of-range thing somewhere to sit.
Quiet, unusual, and very unlikely to collide with anything. The metaphor needs a
beat to land, which is a real cost. Store name: `Ledgerline: Health Journal`.

**4. Sundial** — *common word; expect neighbours, so lean on the subtitle.*
The only one that reaches for something already in the product: this app tracks
light and the solar arc, which none of its competitors do. A sundial is also the
oldest instrument for noticing that today is not quite like yesterday. Warmest
and most approachable of the five. Store name: `Sundial: Daily Health Journal`.

**5. Palimpsest** — *no App Store listing found at all.*
A manuscript scraped clean and written over, where the earlier text still shows
through. It is the most accurate description of a long health record I can think
of, and it is unquestionably free. It is also hard to spell, hard to say out
loud, and hopeless in search — a name to choose with your eyes open, for its
beauty rather than its reach.

Runners-up if none of those survive contact: **Tideline**, **Lodestar**,
**Almanac**.

### Before you commit to one

- **These are availability guesses, not clearance.** I searched the App Store;
  I did not search a trademark register. The real tests are a USPTO/TESS search
  for your class and actually reserving the name in App Store Connect, which is
  free and is the only answer that binds.
- **Reserve it early.** The name is held as soon as you create the app record,
  long before you have a build to upload.
- **Then change it in four places:** `capacitor.config.ts` (`appName`),
  `ios/App/App/Info.plist` (`CFBundleDisplayName`), the PWA manifest in
  `vite.config.ts`, and the two static pages. The bundle ID does not have to
  match and should not be churned.
