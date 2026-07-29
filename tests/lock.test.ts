/* Node unit tests for the PIN-lock hashing core (src/lib/lock.ts). */
import { describe, it, expect } from "vitest";
import { createPinRecord, verifyPin, isValidPin, PIN_LENGTH } from "../src/lib/lock";

describe("PIN validation", () => {
  it("accepts exactly PIN_LENGTH digits", () => {
    expect(isValidPin("0".repeat(PIN_LENGTH))).toBe(true);
    expect(isValidPin("1234".slice(0, PIN_LENGTH))).toBe(true);
  });
  it("rejects the wrong length or non-digits", () => {
    expect(isValidPin("123")).toBe(false);
    expect(isValidPin("12345678")).toBe(false);
    expect(isValidPin("abcd".slice(0, PIN_LENGTH))).toBe(false);
    expect(isValidPin("")).toBe(false);
  });
});

describe("PIN hashing round-trip", () => {
  it("verifies the correct PIN and rejects a wrong one", async () => {
    const record = await createPinRecord("4271");
    expect(await verifyPin("4271", record)).toBe(true);
    expect(await verifyPin("0000", record)).toBe(false);
  });
  it("never stores the PIN itself in the record", async () => {
    const record = await createPinRecord("1357");
    expect(JSON.stringify(record)).not.toContain("1357");
  });
  it("salts independently, so two records for the same PIN don't match by hash alone", async () => {
    const a = await createPinRecord("2580");
    const b = await createPinRecord("2580");
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
    expect(await verifyPin("2580", a)).toBe(true);
    expect(await verifyPin("2580", b)).toBe(true);
  });
  it("verifyPin is defensive against a missing/malformed record", async () => {
    expect(await verifyPin("1234", null as any)).toBe(false);
    expect(await verifyPin("1234", {} as any)).toBe(false);
  });
});
