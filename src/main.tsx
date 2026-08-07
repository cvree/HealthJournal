import React from "react";
import { createRoot } from "react-dom/client";
import { installStorage } from "./lib/storage";
import "./styles/index.css";
import App from "./App";

installStorage(); // no-op inside Claude.ai artifacts, IndexedDB elsewhere

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

/* Retire the pre-React boot text from index.html once the app has painted.
   Faded rather than cut so a fast load doesn't flash. */
const boot = document.getElementById("boot");
if (boot) {
  requestAnimationFrame(() => {
    boot.style.opacity = "0";
    setTimeout(() => boot.remove(), 240);
  });
}
