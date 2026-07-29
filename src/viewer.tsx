/* Read-only viewer entry (/viewer.html).
   Deliberately does NOT install the IndexedDB storage polyfill: an isolated
   in-memory window.storage keeps opened backups (including photo blobs)
   inside this tab only, and guarantees the viewer can never touch a real
   journal stored in this browser. */
import React from "react";
import { createRoot } from "react-dom/client";
import "./styles/index.css";
import App from "./App";

const kv = new Map<string, string>();
(window as any).storage = {
  async get(k: string) { return kv.has(k) ? { key: k, value: kv.get(k) } : null; },
  async set(k: string, v: string) { kv.set(k, String(v)); return { key: k, value: v }; },
  async delete(k: string) { kv.delete(k); return { key: k, deleted: true }; },
  async list(prefix?: string) { return { keys: [...kv.keys()].filter((k) => !prefix || k.startsWith(prefix)) }; },
};

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App viewer />
  </React.StrictMode>
);
