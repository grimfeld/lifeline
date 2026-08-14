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
});
