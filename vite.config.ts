import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      workbox: {
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, // precache the app shell incl. charts/xlsx chunks
      },
      manifest: {
        name: "Family Health Journal",
        short_name: "Health Journal",
        description: "Private daily health tracking — stored on your device. Not medical advice.",
        theme_color: "#F2F4F1",
        background_color: "#F2F4F1",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "pwa-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
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
  },
} as any);
