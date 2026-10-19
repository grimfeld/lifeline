import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end layout tests (see e2e/README.md): every screen, at phone and
 * desktop widths, filled with the longest content a person could type.
 */
// Its own vite servers, never ones found on the port: in another worktree those
// would be serving other code. Agents running side by side set E2E_PORT, which
// moves all three.
const PORT = Number(process.env.E2E_PORT ?? 1421);
/** The Demo build (ADR 0077): its own dev server, with the switch on. */
const DEMO_PORT = PORT + 1;
/**
 * The Demo built with a Source link (VITE_DEMO_SOURCE_URL); the one on
 * DEMO_PORT has none, like the Demo today. demo.spec.ts finds it as the port
 * after DEMO_PORT.
 */
const DEMO_SOURCE_PORT = PORT + 2;

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "seed", testMatch: /seed\.setup\.ts/, use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      dependencies: ["seed"],
      testIgnore: /demo\.spec\.ts/,
      // A small Android phone: the narrowest width the app is laid out for.
      use: { ...devices["Pixel 5"], viewport: { width: 360, height: 780 }, storageState: "e2e/.auth/seeded.json" },
    },
    {
      name: "desktop",
      dependencies: ["seed"],
      testIgnore: /demo\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 }, storageState: "e2e/.auth/seeded.json" },
    },
    {
      // The Demo as a stranger meets it: a fresh, empty browser store (no
      // layout seed), phone and desktop widths set per test in demo.spec.ts.
      name: "demo",
      testMatch: /demo\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${DEMO_PORT}` },
    },
  ],
  webServer: [
    {
      command: `pnpm exec vite --port ${PORT} --strictPort`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `pnpm exec vite --port ${DEMO_PORT} --strictPort`,
      url: `http://localhost:${DEMO_PORT}`,
      env: { VITE_DEMO: "1" },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `pnpm exec vite --port ${DEMO_SOURCE_PORT} --strictPort`,
      url: `http://localhost:${DEMO_SOURCE_PORT}`,
      env: { VITE_DEMO: "1", VITE_DEMO_SOURCE_URL: "https://github.com/grimfeld/lifeline" },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
