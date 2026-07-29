# iOS app + Home Screen widget — setup guide

This repo now contains everything that *can* be generated without Xcode: a
Capacitor-wrapped native iOS project (`ios/`), a bridge plugin that pushes a
tiny data snapshot into a shared App Group, and starter Swift source for a
WidgetKit Home Screen widget (`ios/HealthJournalWidget/`). Finishing it
requires a **Mac with Xcode** — widget extension targets, code signing, and
on-device builds can't be scripted from outside Xcode.

You do **not** need any of this to install the app on your phone today — see
"Install on your phone (PWA)" in the main README. This guide is for a real
native Home Screen widget that shows your streak and today's key metric.

## What's already here

| Path | What it is |
|---|---|
| `capacitor.config.ts` | Capacitor config — `appId: com.cvree.healthjournal`, `webDir: dist` |
| `ios/App/App.xcworkspace` | The generated Xcode project — open **this**, not `.xcodeproj` |
| `ios/App/App/WidgetBridgePlugin.swift` | Native plugin: writes a JSON snapshot to the shared App Group so the widget can read it |
| `ios/App/App/App.entitlements` | App Group entitlement template for the main app target |
| `ios/HealthJournalWidget/` | Starter source for the widget extension target you'll create in Xcode (`HealthJournalWidget.swift`, `HealthJournalWidgetBundle.swift`, `Info.plist`, entitlements) |
| `src/lib/widgetBridge.ts` | JS side: `syncWidgetSnapshot()` (called from `App.tsx` on every save) and `onWidgetDeepLink()` (routes a widget tap to today's Quick Log) |

The data flow: **web app saves an entry → `App.tsx`'s effect computes
{streak, todayLogged, keyMetric, trend} → `WidgetBridge.saveSnapshot()` (native
plugin) → written to `UserDefaults(suiteName: "group.com.cvree.healthjournal")`
→ widget's `TimelineProvider` reads it on each refresh.** Nothing here talks
to a network — the whole loop is on-device, matching the rest of the app.

## Steps

1. **Prerequisites**: a Mac, [Xcode](https://apps.apple.com/app/xcode/id497799835) (free), and an Apple ID. A free Apple ID lets you build and run on your own device for 7 days at a time (Xcode re-signs on every rebuild, so this is fine for personal use — just reopen Xcode and hit Run again after a week). An Apple Developer Program membership ($99/yr) removes that limit and is required for TestFlight/App Store distribution.

2. **Install CocoaPods and sync** (on your Mac, in the repo root):
   ```bash
   sudo gem install cocoapods   # if you don't already have it
   npm install
   npm run build
   npx cap sync ios
   ```
   `cap sync` copies the latest `dist/` build into `ios/App/App/public` and installs the native pods. Re-run it after any web-side change you want reflected in the native app.

3. **Open the workspace**: `open ios/App/App.xcworkspace` (must be the `.xcworkspace`, not `.xcodeproj` — CocoaPods needs the workspace).

4. **Set your Team**: select the `App` target → *Signing & Capabilities* → pick your Apple ID under *Team*. Change the Bundle Identifier if `com.cvree.healthjournal` is already taken (keep it in sync with `capacitor.config.ts`'s `appId` if you do).

5. **Add the App Groups capability to the App target**: *Signing & Capabilities* → **+ Capability** → *App Groups* → **+** → create `group.com.cvree.healthjournal` (must match exactly what's already in `App.entitlements` and the widget's entitlements file). Xcode will wire this into the target automatically.

6. **Add `WidgetBridgePlugin.swift` to the App target**: it's already in `ios/App/App/` on disk, but Xcode needs it added to the project — right-click the `App` group in the Project Navigator → *Add Files to "App"…* → select `WidgetBridgePlugin.swift` → make sure **Target: App** is checked.

7. **Create the widget extension target**: *File → New → Target… → Widget Extension*. Name it `HealthJournalWidget`, uncheck "Include Configuration Intent" (this widget is static, not user-configurable). Xcode generates default template files — **delete** its generated `.swift` files and, same as step 6, *Add Files to "HealthJournalWidget"…* the three files from `ios/HealthJournalWidget/` (`HealthJournalWidgetBundle.swift`, `HealthJournalWidget.swift`) with **Target: HealthJournalWidget** checked. You can leave Xcode's own generated `Info.plist`/entitlements or swap in the ones from that folder — they're equivalent.

8. **Add App Groups to the widget target too**: select the `HealthJournalWidget` target → *Signing & Capabilities* → **+ Capability** → *App Groups* → check the same `group.com.cvree.healthjournal` you created in step 5 (don't create a second one).

9. **Build & run**: pick the `App` scheme, select your iPhone (or a simulator — widgets work in the Simulator too), hit Run. Then long-press the Home Screen → **+** → search "Health Journal" → add the widget.

10. **Verify the loop**: log an entry in the app, background it, and the widget should update within a few seconds (the JS side calls `WidgetCenter.reloadAllTimelines()` on every save, so it doesn't wait for WidgetKit's own refresh budget). Tapping the widget should open the app straight to today's Quick Log.

## If you change what the widget shows

Edit three places together, since the snapshot shape is duplicated across the JS/Swift boundary (no shared schema — deliberately kept simple):
- `src/App.tsx` — the `syncWidgetSnapshot(...)` call (what gets computed and sent)
- `src/lib/widgetBridge.ts` — the `WidgetSnapshot` TypeScript interface
- `ios/HealthJournalWidget/HealthJournalWidget.swift` — the `JournalSnapshot` Swift struct and the view

## Publishing to the App Store (optional)

Only needed if you want it installable without a Mac/Xcode nearby, or want to share it. Requires the paid Developer Program. Rough shape: App Store Connect → create app record (bundle ID from step 4) → Xcode *Product → Archive* → Distribute App → App Store Connect → fill in the listing (screenshots, description) and the App Privacy questionnaire (straightforward here — no data collection, no tracking, no network calls) → submit for review.
