import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

// Builds the extension into dist/ (load that folder unpacked in chrome://extensions).
// public/ holds the manifest, service worker, content script and icon as they are.
export default defineConfig({
  base: "./",
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Extension pages may not load remote code; keep everything in the bundle.
    modulePreload: { polyfill: false },
  },
});
