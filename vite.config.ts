// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "mask-icon.svg"],
      manifest: {
        name: "FlexLog Hybrid Tracker",
        short_name: "FlexLog",
        description:
          "High-performance hybrid strength and cardio training logbook.",
        theme_color: "#10b981", // Emerald 500 theme color accent
        background_color: "#111827", // Gray 900 slate background
        display: "standalone", // CRITICAL: This hides browser bars and forces native app mode
        orientation: "portrait",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable", // Perfect layout rendering for Android adaptive icons
          },
        ],
      },
    }),
  ],
});
