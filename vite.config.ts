import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// The site has to work from a domain root (health-journal.app) *and* from a
// project sub-path (user.github.io/HealthJournal/). Everything below derives
// from one env var so a Pages deploy is `BASE_PATH=/HealthJournal/ npm run build`
// and nothing else has to change. Always normalised to a leading+trailing slash.
const base = (() => {
  const raw = process.env.BASE_PATH || "/";
  const withLead = raw.startsWith("/") ? raw : `/${raw}`;
  return withLead.endsWith("/") ? withLead : `${withLead}/`;
})();

// Optional absolute origin (e.g. https://health-journal.example). Only social
// scrapers need it — everything the app itself loads is relative. When unset,
// previews fall back to a root-relative image, which most scrapers resolve.
const siteUrl = (process.env.SITE_URL || "").replace(/\/+$/, "");

// Vite rebases href/src attributes it recognises, but not <meta content>, so
// the Open Graph tags carry a %BASE%/%SITE% placeholder that gets filled here.
// Without this, link previews 404 on any sub-path deploy.
const htmlPlaceholders = {
  name: "health-journal:html-placeholders",
  transformIndexHtml(html: string) {
    return html.replace(/%SITE%/g, siteUrl).replace(/%BASE%/g, base);
  },
};

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    htmlPlaceholders,
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "robots.txt", "og-image.png"],
      workbox: {
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, // precache the app shell incl. charts/xlsx chunks
        // The journal is the app shell; a hard-refresh on any path should still
        // boot it offline rather than showing the browser's dinosaur.
        navigateFallback: `${base}index.html`,
        navigateFallbackDenylist: [/^\/viewer\.html/],
      },
      manifest: {
        name: "Health Journal — private daily tracking",
        short_name: "Health Journal",
        description: "Private daily health tracking — stored on your device. Not medical advice.",
        theme_color: "#F2F4F1",
        background_color: "#F2F4F1",
        display: "standalone",
        orientation: "portrait",
        categories: ["health", "lifestyle", "medical"],
        start_url: base,
        scope: base,
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "pwa-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        shortcuts: [
          { name: "Log today", short_name: "Log", url: `${base}?screen=log` },
          { name: "This week's report", short_name: "Report", url: `${base}?screen=report` },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      input: { main: "index.html", viewer: "viewer.html" },
      output: {
        manualChunks: { xlsx: ["xlsx"], charts: ["recharts"] },
      },
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    // Several suites mount the full App (React + recharts + xlsx) in jsdom;
    // under CPU contention on small/CI runners the default 5s waitFor budget
    // can time out even though nothing is actually wrong (observed directly:
    // ~1s isolated vs 5s+ when all 6 suites run concurrently on 4 cores).
    testTimeout: 15000,
  },
} as any);
