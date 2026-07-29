/* Lightweight on-device PIN lock. Deters casual/shared-device snooping —
   it is not a hardened security boundary: there's no attempt limiting, and
   "Forgot PIN" always wins by design (the journal itself must never become
   unrecoverable just because a PIN was forgotten). The PIN is never stored,
   only a salted hash, and it's kept in its own storage key (LOCK_KEY in
   App.tsx) so it never rides along in an exported JSON backup. */

export interface PinRecord {
  salt: string; // hex
  hash: string; // hex — sha256(`${salt}:${pin}`)
}

export const PIN_LENGTH = 4;

export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomSaltHex(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toHex(bytes.buffer);
}

async function digest(saltHex: string, pin: string): Promise<string> {
  const data = new TextEncoder().encode(`${saltHex}:${pin}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return toHex(buf);
}

export async function createPinRecord(pin: string): Promise<PinRecord> {
  const salt = randomSaltHex();
  const hash = await digest(salt, pin);
  return { salt, hash };
}

export async function verifyPin(pin: string, record: PinRecord): Promise<boolean> {
  if (!record || typeof record.salt !== "string" || typeof record.hash !== "string") return false;
  const hash = await digest(record.salt, pin);
  return hash === record.hash;
}
