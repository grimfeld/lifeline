import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
    // One React across source-linked workspace packages
    dedupe: ["react", "react-dom"],
  },
  server: {
    port: 1420,
    strictPort: true,
  },
  clearScreen: false,
  // The Demo's dev server (ADR 0077) runs beside the real one in the e2e
  // suite (twice: with and without a Source link); each keeps its own
  // optimised-deps cache so none clobbers another.
  cacheDir: process.env.VITE_DEMO ? (process.env.VITE_DEMO_SOURCE_URL ? "node_modules/.vite-demo-source" : "node_modules/.vite-demo") : undefined,
});
