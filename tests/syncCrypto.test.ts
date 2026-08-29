/* The encryption layer.
 *
 * The claims made in Settings ("encrypted on this device before it's uploaded",
 * "we can't read it without your passphrase") are only true if this file
 * behaves. So each test below corresponds to a sentence the UI is allowed to
 * say, and the negative cases — wrong passphrase, moved ciphertext, tampered
 * bytes — matter more than the happy path.
 */

import { describe, it, expect } from "vitest";
import {
  deriveKey, newSalt, seal, open, makeVerifier, checkVerifier,
  toBase64, fromBase64, ratePassphrase, suggestPassphrase, DecryptError,
} from "../src/lib/sync/crypto";

/* Real PBKDF2 at the shipping iteration count takes about a second per call.
   The property under test is never "600,000 is slow" — it is what the key does
   — so the tests derive at a low count and one test asserts the constant. */
const FAST = 1000;

const keyFor = async (pass: string, salt: string) => (await deriveKey(pass, salt, FAST)).key;

describe("sealing a record", () => {
  it("round-trips a journal entry", async () => {
    const salt = newSalt();
    const key = await keyFor("correct horse battery staple", salt);
    const value = { date: "2026-03-04", answers: { pain: 6, notes: "sore" } };
    const sealed = await seal(key, "entry", "2026-03-04", value);
    expect(await open(key, "entry", "2026-03-04", sealed)).toEqual(value);
  });

  it("leaves nothing readable in the ciphertext", async () => {
    const key = await keyFor("a passphrase for this", newSalt());
    const sealed = await seal(key, "entry", "2026-03-04", { notes: "eczema flare on both hands" });
    const decoded = new TextDecoder().decode(fromBase64(sealed.ciphertext));
    expect(sealed.ciphertext).not.toContain("eczema");
    expect(decoded).not.toContain("eczema");
  });

  it("uses a fresh nonce every time, so the same value never seals the same way", async () => {
    // GCM's failure mode on nonce reuse is catastrophic and silent. This is the
    // assertion that it cannot happen.
    const key = await keyFor("a passphrase for this", newSalt());
    const a = await seal(key, "entry", "d", { pain: 1 });
    const b = await seal(key, "entry", "d", { pain: 1 });
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it("refuses a different passphrase", async () => {
    const salt = newSalt();
    const sealed = await seal(await keyFor("the right one", salt), "entry", "d", { pain: 1 });
    await expect(open(await keyFor("the wrong one", salt), "entry", "d", sealed))
      .rejects.toBeInstanceOf(DecryptError);
  });

  it("refuses a ciphertext lifted from another row", async () => {
    /* Without binding the row's identity into the AEAD, a server (or anyone who
       can write to it) could move Monday's ciphertext onto Tuesday and the app
       would cheerfully show Monday's symptoms under Tuesday's date. */
    const key = await keyFor("a passphrase for this", newSalt());
    const sealed = await seal(key, "entry", "2026-03-04", { pain: 9 });
    await expect(open(key, "entry", "2026-03-05", sealed)).rejects.toBeInstanceOf(DecryptError);
    await expect(open(key, "food", "2026-03-04", sealed)).rejects.toBeInstanceOf(DecryptError);
  });

  it("refuses a tampered ciphertext rather than returning something plausible", async () => {
    const key = await keyFor("a passphrase for this", newSalt());
    const sealed = await seal(key, "entry", "d", { pain: 1 });
    const bytes = fromBase64(sealed.ciphertext);
    bytes[0] ^= 0xff;
    await expect(open(key, "entry", "d", { ...sealed, ciphertext: toBase64(bytes) }))
      .rejects.toBeInstanceOf(DecryptError);
  });

  it("derives different keys from the same passphrase under different salts", async () => {
    const sealed = await seal(await keyFor("same words", newSalt()), "entry", "d", { pain: 1 });
    await expect(open(await keyFor("same words", newSalt()), "entry", "d", sealed)).rejects.toThrow();
  });

  it("survives a photo-sized payload without blowing the call stack", async () => {
    // The naive base64 helper (btoa(String.fromCharCode(...bytes))) throws on
    // an array this size, which is exactly the input a photo produces.
    const key = await keyFor("a passphrase for this", newSalt());
    const big = "x".repeat(400_000);
    const sealed = await seal(key, "photo", "p1", { full: big, thumb: "y" });
    expect((await open<any>(key, "photo", "p1", sealed)).full.length).toBe(400_000);
  });
});

describe("telling a wrong passphrase from broken data", () => {
  it("accepts the passphrase that created the verifier", async () => {
    const salt = newSalt();
    const key = await keyFor("the right one", salt);
    expect(await checkVerifier(key, await makeVerifier(key))).toBe(true);
  });

  it("rejects any other passphrase, without touching journal data", async () => {
    const salt = newSalt();
    const v = await makeVerifier(await keyFor("the right one", salt));
    expect(await checkVerifier(await keyFor("nearly the right one", salt), v)).toBe(false);
  });

  it("returns false rather than throwing on nonsense", async () => {
    const key = await keyFor("a passphrase for this", newSalt());
    expect(await checkVerifier(key, { ciphertext: "not base64 at all!!", iv: "nope" })).toBe(false);
  });
});

describe("base64", () => {
  it("round-trips arbitrary bytes", () => {
    const bytes = new Uint8Array(1024);
    for (let i = 0; i < bytes.length; i++) bytes[i] = i % 256;
    expect(Array.from(fromBase64(toBase64(bytes)))).toEqual(Array.from(bytes));
  });
});

describe("passphrase quality", () => {
  it("turns away anything short enough to be brute-forced offline", () => {
    // There is no server to rate-limit guesses against a stolen database dump,
    // so this is the only bar there is.
    expect(ratePassphrase("hunter2").ok).toBe(false);
    expect(ratePassphrase("").ok).toBe(false);
  });

  it("turns away the obvious ones however long they are", () => {
    expect(ratePassphrase("mypasswordforbellwether").ok).toBe(false);
  });

  it("accepts a few unrelated words and rates them well", () => {
    const v = ratePassphrase("marble kettle thistle 41");
    expect(v.ok).toBe(true);
    expect(v.score).toBeGreaterThanOrEqual(3);
  });

  it("rates a long multi-word phrase at least as highly as a short cryptic one", () => {
    // Length is what actually matters, and the meter has to say so or it pushes
    // people toward "P@ssw0rd!" — memorable to a cracker, not to a person.
    expect(ratePassphrase("copper willow sienna harbor pebble").score)
      .toBeGreaterThanOrEqual(ratePassphrase("Xk9$mQ2!az").score);
  });

  it("rejects one character repeated", () => {
    expect(ratePassphrase("aaaaaaaaaaaaaaa").ok).toBe(false);
  });

  it("suggests something that passes its own bar, and never the same twice", () => {
    const a = suggestPassphrase();
    expect(ratePassphrase(a).ok).toBe(true);
    expect(new Set(Array.from({ length: 12 }, suggestPassphrase)).size).toBeGreaterThan(8);
  });
});

describe("the numbers behind the claim", () => {
  it("ships at the current OWASP iteration count", async () => {
    const { KDF_ITERATIONS } = await import("../src/lib/sync/crypto");
    expect(KDF_ITERATIONS).toBeGreaterThanOrEqual(600_000);
  });

  it("uses a 16-byte salt and a 12-byte nonce", async () => {
    const { SALT_BYTES, IV_BYTES } = await import("../src/lib/sync/crypto");
    expect(SALT_BYTES).toBe(16);
    expect(IV_BYTES).toBe(12);
    expect(fromBase64(newSalt()).length).toBe(16);
  });

  it("derives a key that cannot be read back out of the browser", async () => {
    const { key } = await deriveKey("a passphrase for this", newSalt(), FAST);
    expect(key.extractable).toBe(false);
    await expect(crypto.subtle.exportKey("raw", key)).rejects.toThrow();
  });
});
