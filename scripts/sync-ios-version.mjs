/* Keeps the iOS version numbers honest, because App Store Connect is strict
   about exactly the thing that is easiest to get wrong by hand.

   Two numbers, two different rules:

   MARKETING_VERSION is what a user sees ("1.27.0"). It comes from
   package.json, so the repo has one version and not two that drift apart —
   which they already had, sitting at 1.0 in Xcode while package.json had moved
   to 1.27.0.

   CURRENT_PROJECT_VERSION is the build number, and its only real requirement is
   that it strictly increases for every binary you upload under one marketing
   version. A hand-incremented counter fails that rule the first time you
   archive twice in an evening and forget. The commit count cannot: it is
   monotonic, it is derived rather than remembered, and it never resets.

   Run `npm run version:ios` before an archive. It is idempotent. */

import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const PBX = "ios/App/App.xcodeproj/project.pbxproj";

const marketing = JSON.parse(readFileSync("package.json", "utf8")).version;
const build = execSync("git rev-list --count HEAD", { encoding: "utf8" }).trim();

if (!/^\d+(\.\d+){0,2}$/.test(marketing)) {
  console.error(`package.json version "${marketing}" is not an Apple-shaped version (1 to 3 dot-separated integers).`);
  process.exit(1);
}

const before = readFileSync(PBX, "utf8");
const after = before
  .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${marketing};`)
  .replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${build};`);

/* Neither key existing at all is a broken project, not a no-op — say so rather
   than reporting success on a file that was never going to build. */
for (const key of ["MARKETING_VERSION", "CURRENT_PROJECT_VERSION"]) {
  if (!after.includes(`${key} = `)) {
    console.error(`${PBX} has no ${key}. The Xcode project is not in the state this script expects.`);
    process.exit(1);
  }
}

if (after === before) {
  console.log(`iOS version already ${marketing} (${build}) — nothing to do.`);
} else {
  writeFileSync(PBX, after);
  console.log(`iOS version set to ${marketing} (build ${build}).`);
}
