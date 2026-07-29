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
