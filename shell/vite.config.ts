import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { intakesPlugin } from "./build/intakes";

export default defineConfig({
  // intakesPlugin: /intakes.json, the Intakes list the Lifeline extension reads (ADR 0080).
  plugins: [react(), tailwindcss(), intakesPlugin()],
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
});
