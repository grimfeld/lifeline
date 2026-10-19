import { defineConfig } from "vitest/config";

// The tests load every App, views included; a DOM lets the browser-only
// libraries load. Playwright's e2e specs are not Vitest's.
export default defineConfig({
  test: { include: ["src/**/*.test.ts", "build/**/*.test.ts"] },
});
