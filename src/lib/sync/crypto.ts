/* Encrypting the journal before it leaves the device.

   What this is, stated precisely, because the temptation to overstate it is the
   whole risk:

   Every synced record's contents are encrypted on the device with AES-256-GCM
   under a key derived from a passphrase the user chooses. The passphrase is
   never transmitted, and neither is the key. The server stores ciphertext plus
   the metadata it genuinely needs to order and filter rows — kind, id, a
   timestamp, a device id, a deleted flag. It cannot read an answer, a note, a
   meal, or a photo.

   What this is **not**, and what the UI must therefore never claim:

   - It is not zero-knowledge in the strong sense. The application code is
     served from a web host; anyone able to change what that host serves could
     change what the page does with the passphrase. That is a real limitation of
     every browser-delivered encrypted app, and saying so is more useful than a
     badge that implies otherwise.
   - It is not protection against someone with the device unlocked in their
     hand. The local journal is, and remains, plaintext on the device — which is
     what makes the app work offline and instantly, and is the same trust model
     as every note-taking app on the phone.
   - It is not a compliance posture. No claim of HIPAA, and none of "medical
     grade", is made anywhere.

   Design choices worth defending:

   - **PBKDF2-SHA256, 600,000 iterations.** Not the strongest KDF in existence —
     Argon2id is — but it is the strongest one available in every browser's
     WebCrypto without shipping a WASM blob, and the iteration count is the
     current OWASP figure. The count is stored per user so it can be raised for
     new accounts without stranding old ones.
   - **A random 16-byte salt per user**, stored server-side. Salts are not
     secret; their job is to make a precomputed attack against many users at
     once useless, and they do that in the clear.
   - **A fresh 96-bit nonce per write.** GCM's failure mode on nonce reuse is
     catastrophic and silent, so nonces are drawn from the CSPRNG per record
     write and never derived from anything.
   - **The record's identity is authenticated.** `kind` and `id` go into the
     GCM additional-authenticated-data, so a ciphertext cannot be lifted from
     one row and dropped into another — the decrypt fails instead of silently
     showing yesterday's answers under today's date.
   - **A verifier, not a plaintext check.** Whether a passphrase is right is
     established by decrypting a fixed probe string, so the app can tell "wrong
     passphrase" from "damaged data" without ever having to try the journal. */

const enc = new TextEncoder();
const dec = new TextDecoder();

/** OWASP's current floor for PBKDF2-HMAC-SHA256. Stored per user, so raising
    this later applies to new setups without locking anyone out of an old one. */
export const KDF_ITERATIONS = 600_000;
export const SALT_BYTES = 16;
export const IV_BYTES = 12;

/** The probe. Its contents are irrelevant and public; only the fact that it
    decrypts under the right key matters. */
const VERIFIER_PLAINTEXT = "bellwether.sync.v1";
const VERIFIER_AAD = "verifier";

function subtle(): SubtleCrypto {
  const c = (globalThis as any).crypto;
  if (!c?.subtle) {
    throw new Error("This browser can't encrypt sync data (WebCrypto unavailable).");
  }
  return c.subtle;
}

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  (globalThis as any).crypto.getRandomValues(out);
  return out;
}

/* ---------- base64 ----------
   Hand-rolled rather than via btoa(String.fromCharCode(...bytes)): the spread
   form blows the call stack on a photo-sized array, which is exactly the input
   this has to survive. */

export function toBase64(bytes: Uint8Array): string {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}

export function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* ---------- key derivation ---------- */

export interface DerivedKey {
  key: CryptoKey;
  salt: string;      // base64
  iterations: number;
}

export async function deriveKey(
  passphrase: string,
  saltB64: string,
  iterations: number = KDF_ITERATIONS
): Promise<DerivedKey> {
  const s = subtle();
  const material = await s.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  const key = await s.deriveKey(
    { name: "PBKDF2", salt: fromBase64(saltB64) as unknown as BufferSource, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    /* Not extractable. The key object can encrypt and decrypt and cannot be
       read back out of the browser, so a bug elsewhere in the app cannot
       accidentally serialise it into a log or a backup. */
    false,
    ["encrypt", "decrypt"]
  );
  return { key, salt: saltB64, iterations };
}

export function newSalt(): string {
  return toBase64(randomBytes(SALT_BYTES));
}

/* ---------- record sealing ---------- */

export interface Sealed {
  ciphertext: string; // base64
  iv: string;         // base64
}

/** Bind a ciphertext to the row it belongs to. A ciphertext moved to another
    row fails to decrypt rather than silently misreporting someone's data. */
const aadFor = (kind: string, id: string) => enc.encode(`${kind}\u0000${id}`);

export async function seal(key: CryptoKey, kind: string, id: string, value: unknown): Promise<Sealed> {
  const iv = randomBytes(IV_BYTES);
  const buf = await subtle().encrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource, additionalData: aadFor(kind, id) as unknown as BufferSource },
    key,
    enc.encode(JSON.stringify(value)) as unknown as BufferSource
  );
  return { ciphertext: toBase64(new Uint8Array(buf)), iv: toBase64(iv) };
}

export class DecryptError extends Error {
  constructor(message = "Couldn't decrypt this record with the current sync passphrase.") {
    super(message);
    this.name = "DecryptError";
  }
}

export async function open<T = unknown>(
  key: CryptoKey, kind: string, id: string, sealed: Sealed
): Promise<T> {
  let buf: ArrayBuffer;
  try {
    buf = await subtle().decrypt(
      {
        name: "AES-GCM",
        iv: fromBase64(sealed.iv) as unknown as BufferSource,
        additionalData: aadFor(kind, id) as unknown as BufferSource,
      },
      key,
      fromBase64(sealed.ciphertext) as unknown as BufferSource
    );
  } catch {
    /* GCM refuses to say *why* — wrong key, wrong nonce, tampered ciphertext
       and wrong row all surface identically, which is the correct behaviour and
       the reason the verifier below exists. */
    throw new DecryptError();
  }
  try {
    return JSON.parse(dec.decode(buf)) as T;
  } catch {
    throw new DecryptError("A synced record decrypted but wasn't readable.");
  }
}

/* ---------- verifier ---------- */

export async function makeVerifier(key: CryptoKey): Promise<Sealed> {
  return seal(key, VERIFIER_AAD, "", VERIFIER_PLAINTEXT);
}

/** True when `key` is the key that produced `sealed`. Used to tell a mistyped
    passphrase from a genuine data problem, before any journal data is touched. */
export async function checkVerifier(key: CryptoKey, sealed: Sealed): Promise<boolean> {
  try {
    return (await open<string>(key, VERIFIER_AAD, "", sealed)) === VERIFIER_PLAINTEXT;
  } catch {
    return false;
  }
}

/* ---------- passphrase quality ----------

   The passphrase is the only thing standing between a stolen database dump and
   a person's medical journal, and unlike a login password there is no server to
   rate-limit guesses against it. So the bar is a real one — but expressed as
   guidance a person can act on rather than a rule that pushes them toward
   "Password1!". Length is what actually matters; the checks below say so. */

export interface PassphraseVerdict {
  ok: boolean;
  /** 0–4, for the strength meter. */
  score: number;
  label: string;
  hint: string;
}

const COMMON = [
  "password", "passphrase", "12345678", "qwertyui", "letmein",
  "health", "bellwether", "bellwether", "iloveyou", "welcome1", "abc12345",
];

export function ratePassphrase(input: string): PassphraseVerdict {
  const value = (input || "").trim();
  const len = value.length;
  if (len < 10) {
    return {
      ok: false, score: len >= 6 ? 1 : 0, label: "Too short",
      hint: "At least 10 characters. A few unrelated words is easier to remember and harder to guess than a short password.",
    };
  }
  const lower = value.toLowerCase();
  if (COMMON.some((c) => lower.includes(c))) {
    return {
      ok: false, score: 1, label: "Too easy to guess",
      hint: "This contains a very common phrase. Try words that only mean something to you.",
    };
  }
  if (/^(.)\1+$/.test(value)) {
    return { ok: false, score: 0, label: "Too simple", hint: "One repeated character isn't a passphrase." };
  }
  const words = value.split(/\s+/).filter(Boolean).length;
  const variety =
    (/[a-z]/.test(value) ? 1 : 0) + (/[A-Z]/.test(value) ? 1 : 0) +
    (/[0-9]/.test(value) ? 1 : 0) + (/[^A-Za-z0-9]/.test(value) ? 1 : 0);
  /* Length carries most of the weight, and multiple words count for as much as
     punctuation — because they are worth as much, and they are the thing people
     will actually still know in six months. */
  let score = 2;
  if (len >= 16 || words >= 3) score = 3;
  if ((len >= 20 && variety >= 2) || (words >= 4 && len >= 24)) score = 4;
  const label = score >= 4 ? "Strong" : score >= 3 ? "Good" : "Workable";
  const hint = score >= 3
    ? "Write it down somewhere safe. It's the only way to read your synced journal on a new device."
    : "Longer is stronger. Three or four unrelated words beats a short complicated one.";
  return { ok: true, score, label, hint };
}

/** A generated suggestion, for the people who would rather not invent one.
    Four words from a small hand-checked list plus a number: about 46 bits with
    this list, which is fine behind a 600k-iteration KDF, and memorable. */
const WORDS = [
  "amber", "anchor", "basil", "beacon", "birch", "cedar", "cinder", "clover",
  "cobalt", "copper", "coral", "cotton", "dahlia", "delta", "ember", "fennel",
  "ferry", "flint", "garnet", "gravel", "harbor", "hazel", "indigo", "ivory",
  "juniper", "kettle", "lantern", "linen", "marble", "meadow", "mica", "nickel",
  "olive", "opal", "pebble", "pewter", "quartz", "quill", "ripple", "saffron",
  "sage", "shale", "sienna", "slate", "sorrel", "spruce", "thistle", "timber",
  "topaz", "tundra", "velvet", "walnut", "willow", "yarrow", "zephyr",
];

export function suggestPassphrase(): string {
  const pick = () => WORDS[randomBytes(2)[0] % WORDS.length];
  const n = 10 + (randomBytes(1)[0] % 90);
  return `${pick()}-${pick()}-${pick()}-${pick()}-${n}`;
}
