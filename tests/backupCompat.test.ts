/* Backups written under an older app name must keep opening, forever.

   This file exists because a rebrand very nearly broke exactly that. A
   find-and-replace pass over the repo rewrote the historical names inside
   BACKUP_APP_IDS to the new one, which compiles, type-checks, and passes every
   other test — while silently making every backup already sitting on a user's
   disk unopenable. The failure has no error path and no recovery: the file is
   simply refused as "not a Bellwether backup".

   So the guarantee is asserted against the real validator, with the literal
   strings spelled out. If the app is renamed again, ADD to this list. Do not
   edit what is here. */
import { describe, it, expect } from "vitest";
import { __internals as I } from "../src/App";

/** Every name this app has ever stamped into an export's `app` field. */
const HISTORICAL_NAMES = ["Family Health Journal", "Health Journal", "Bellwether"];

const backup = (app: string) => ({
  app,
  profile: { name: "test" },
  entries: [{ date: "2026-01-01" }],
});

describe("backup compatibility across renames", () => {
  for (const name of HISTORICAL_NAMES) {
    it(`opens a backup written as "${name}"`, () => {
      const v = I.validateBackup(backup(name));
      expect(v.ok, `a backup stamped "${name}" must still validate`).toBe(true);
      expect(v.summary.entries).toBe(1);
    });
  }

  it("still refuses a file that is not ours", () => {
    expect(I.validateBackup(backup("Some Other App")).ok).toBe(false);
    expect(I.validateBackup({ entries: [] }).ok).toBe(false);
  });
});
