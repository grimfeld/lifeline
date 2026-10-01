import { defineConfig } from "vitest/config";

// The tests load every App, views included; a DOM lets the browser-only
// libraries load (the build swaps them for inert stand-ins instead).
export default defineConfig({
  test: { environment: "jsdom" },
});
