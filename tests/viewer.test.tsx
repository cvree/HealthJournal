/* Web viewer tests: landing, demo browse, backup-file open (data-only and
   with photos), invalid file handling, and read-only guarantees (no Log tab,
   no persistence writes, edit screens unreachable). */
// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

let App: any;
let I: any;

function installMemStorage() {
  const kv = new Map<string, string>();
  const setSpy = vi.fn(async (k: string, v: string) => { kv.set(k, String(v)); return { key: k, value: v }; });
  (window as any).storage = {
    get: async (k: string) => (kv.has(k) ? { key: k, value: kv.get(k) } : null),
    set: setSpy,
    delete: async (k: string) => { kv.delete(k); return { key: k, deleted: true }; },
    list: async (prefix?: string) => ({ keys: [...kv.keys()].filter((k) => !prefix || k.startsWith(prefix)) }),
  };
  return { kv, setSpy };
}

beforeAll(async () => {
  (globalThis as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.matchMedia = ((q: string) =>
    ({ matches: q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false } as any)) as any;
  window.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
  const mod = await import("../src/App");
  App = mod.default;
  I = mod.__internals;
});

beforeEach(() => cleanup());

const sampleDb = () => I.migrateDb({ ...I.genSampleData(), ack: true, onboarded: true });
const dataBackup = () => {
  const db = sampleDb();
  return { app: "Family Health Journal", exportedAt: new Date().toISOString(),
    profile: db.profile, entries: db.entries, reports: db.reports || [] };
};

async function openFile(text: string) {
  const input = screen.getByLabelText("journal backup file") as HTMLInputElement;
  const file = new File([text], "backup.json", { type: "application/json" });
  file.text = async () => text; // jsdom File lacks text()
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  fireEvent.change(input);
}

describe("web viewer", () => {
  it("shows the landing with privacy copy and no journal loaded", () => {
    installMemStorage();
    render(React.createElement(App, { viewer: true }));
    expect(document.body.textContent).toMatch(/read-only viewer/i);
    expect(document.body.textContent).toMatch(/nothing you open here is uploaded/i);
  });

  it("demo browse loads Connor data read-only: no Log tab, badge shown, no writes", async () => {
    const { setSpy } = installMemStorage();
    render(React.createElement(App, { viewer: true }));
    fireEvent.click(screen.getByText(/browse example data/i));
    await waitFor(() => expect(document.body.textContent).toMatch(/streak/i));
    expect(document.body.textContent).toMatch(/read-only/i);
    expect(screen.queryByText("Log")).toBeNull(); // nav tab absent
    await new Promise((r) => setTimeout(r, 700)); // outlive the debounced save window
    const journalWrites = setSpy.mock.calls.filter(([k]) => k === "fhj_v1");
    expect(journalWrites.length).toBe(0); // viewer never persists the journal
  });

  it("opens a data-only backup file", async () => {
    installMemStorage();
    render(React.createElement(App, { viewer: true }));
    await openFile(JSON.stringify(dataBackup()));
    await waitFor(() => expect(document.body.textContent).toMatch(/streak/i));
    expect(document.body.textContent).toMatch(/read-only/i);
  });

  it("opens a full backup with photos and hydrates blobs into tab-only storage", async () => {
    const { kv } = installMemStorage();
    render(React.createElement(App, { viewer: true }));
    const backup: any = dataBackup();
    backup.kind = "full";
    backup.photos = [{ id: "ph_view_1", meta: { fieldKey: "photo_neck", date: "2026-07-01", takenAt: "2026-07-01T10:00:00Z" },
      full: "data:image/jpeg;base64,AAAA", thumb: "data:image/jpeg;base64,AAAA" }];
    await openFile(JSON.stringify(backup));
    await waitFor(() => expect(document.body.textContent).toMatch(/streak/i));
    await waitFor(() => expect([...kv.keys()].some((k) => k.includes("ph_view_1"))).toBe(true));
  });

  it("rejects a non-journal file with a friendly error, no crash", async () => {
    installMemStorage();
    render(React.createElement(App, { viewer: true }));
    await openFile("{ not json at all");
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/couldn't be read/i));
    await openFile(JSON.stringify({ app: "Something Else" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/isn't a family health journal backup/i));
  });
});
