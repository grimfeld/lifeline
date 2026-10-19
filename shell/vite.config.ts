import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { intakesPlugin } from "./build/intakes.ts";

export default defineConfig(({ mode }) => {
  // VITE_* from the environment or a .env file, the environment winning.
  const env = loadEnv(mode, import.meta.dirname, "VITE_");
  return {
    // intakesPlugin: /intakes.json, the Intakes list the Lifeline extension reads (ADR 0080).
    plugins: [react(), tailwindcss(), intakesPlugin()],
    // The Demo switch as literals (packages/core/src/demo.ts, ADR 0077): the
    // real build sees `false` and drops every Demo branch.
    define: {
      __LIFELINE_DEMO__: JSON.stringify(env.VITE_DEMO === "1"),
      __LIFELINE_DEMO_SOURCE_URL__: JSON.stringify(env.VITE_DEMO_SOURCE_URL?.trim() ?? ""),
    },
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
  };
});
