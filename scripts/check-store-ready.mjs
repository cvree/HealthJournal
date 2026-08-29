/* Preflight for an App Store submission.

   Every check here corresponds to something that either gets the binary
   rejected by App Store Connect's automated pass, or gets it rejected by a
   human who clicked a link that didn't work. They are cheap to run and
   expensive to discover after an upload, which is the whole argument for the
   file existing.

   Run `npm run check:store` before you archive. */

import { readFileSync, existsSync } from "node:fs";

const problems = [];
const notes = [];
const fail = (m) => problems.push(m);
const ok = (m) => notes.push(m);

const read = (p) => (existsSync(p) ? readFileSync(p, "utf8") : null);

/* ---- 1. Placeholders in the two URLs Apple requires ------------------- */
const PLACEHOLDERS = ["PUBLISHER_NAME", "CONTACT_EMAIL", "EFFECTIVE_DATE"];
for (const page of ["public/privacy.html", "public/support.html"]) {
  const html = read(page);
  if (!html) { fail(`${page} is missing. App Store Connect requires both a privacy policy URL and a support URL.`); continue; }
  const left = PLACEHOLDERS.filter((t) => html.includes(t));
  if (left.length) fail(`${page} still contains ${left.join(", ")} — fill these in and delete the yellow box.`);
  else if (html.includes("Before you publish")) fail(`${page} still shows the "Before you publish" box. Delete it.`);
  else ok(`${page} has no placeholders left`);
}

/* ---- 2. Camera usage description ------------------------------------- */
const infoPlist = read("ios/App/App/Info.plist");
if (!infoPlist?.includes("NSCameraUsageDescription")) {
  fail("ios/App/App/Info.plist has no NSCameraUsageDescription. src/App.tsx calls getUserMedia; iOS terminates the app without it.");
} else ok("NSCameraUsageDescription present");

/* ---- 3. Privacy manifest, and actually in the bundle ------------------ */
const manifest = read("ios/App/App/PrivacyInfo.xcprivacy");
const pbx = read("ios/App/App.xcodeproj/project.pbxproj") ?? "";
if (!manifest) {
  fail("ios/App/App/PrivacyInfo.xcprivacy is missing. Required since May 2024 — uploads come back as ITMS-91053.");
} else if (!manifest.includes("NSPrivacyAccessedAPICategoryUserDefaults")) {
  fail("PrivacyInfo.xcprivacy does not declare the UserDefaults reason. WidgetBridgePlugin.swift uses UserDefaults.");
} else if (!pbx.includes("PrivacyInfo.xcprivacy in Resources")) {
  fail("PrivacyInfo.xcprivacy exists but is not in the Resources build phase, so it will not ship inside the .app.");
} else ok("privacy manifest present and wired into the Resources phase");

/* ---- 4. Versions ------------------------------------------------------ */
const pkgVersion = JSON.parse(read("package.json")).version;
if (!pbx.includes(`MARKETING_VERSION = ${pkgVersion};`)) {
  fail(`Xcode MARKETING_VERSION does not match package.json (${pkgVersion}). Run: npm run version:ios`);
} else ok(`MARKETING_VERSION matches package.json (${pkgVersion})`);

/* ---- 5. Deployment target -------------------------------------------- */
const targets = [...pbx.matchAll(/IPHONEOS_DEPLOYMENT_TARGET = ([\d.]+);/g)].map((m) => parseFloat(m[1]));
if (targets.some((t) => t < 14.3)) {
  fail(`IPHONEOS_DEPLOYMENT_TARGET is ${Math.min(...targets)}. getUserMedia inside WKWebView needs 14.3+, so the camera fails silently below it.`);
} else ok(`deployment target ${Math.min(...targets)} supports the in-app camera`);

/* ---- 6. App icon: 1024x1024, no alpha --------------------------------- */
const ICON = "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png";
if (!existsSync(ICON)) fail(`${ICON} is missing.`);
else {
  const d = readFileSync(ICON);
  const w = d.readUInt32BE(16), h = d.readUInt32BE(20), colorType = d[25];
  if (w !== 1024 || h !== 1024) fail(`App icon is ${w}x${h}; Apple requires exactly 1024x1024.`);
  else if (colorType === 4 || colorType === 6) fail("App icon has an alpha channel. Apple rejects transparency in the marketing icon.");
  else ok("app icon is 1024x1024 with no alpha channel");
}

/* ---- 7. No API key ever committed ------------------------------------- */
/* The AI module's first design rule is that grepping this repo finds no
   key-shaped string. Worth proving rather than trusting, since a leaked key in
   a public repo is a bill as well as a bug. */
const keyish = /\b(sk-[A-Za-z0-9]{20,}|AIza[A-Za-z0-9_-]{30,})\b/;
const suspects = ["src/lib/ai.ts", "src/lib/aiProviders.ts", "capacitor.config.ts", "public/privacy.html", "public/support.html"];
const leaked = suspects.filter((f) => keyish.test(read(f) ?? ""));
if (leaked.length) fail(`Possible API key committed in: ${leaked.join(", ")}`);
else ok("no key-shaped strings in the usual places");

/* ---- report ----------------------------------------------------------- */
for (const n of notes) console.log(`  ok   ${n}`);
if (problems.length) {
  console.error(`\n${problems.length} thing${problems.length === 1 ? "" : "s"} to fix before submitting:\n`);
  for (const p of problems) console.error(`  ✗  ${p}`);
  console.error("");
  process.exit(1);
}
console.log("\nReady to archive.");
