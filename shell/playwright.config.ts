import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end layout tests (see e2e/README.md): every screen, at phone and
 * desktop widths, filled with the longest content a person could type.
 */
// Its own vite servers, never ones found on the port: in another worktree those
// would be serving other code. Agents running side by side set E2E_PORT, which
// moves all three.
const PORT = Number(process.env.E2E_PORT ?? 1421);
/**
 * The Demo (ADR 0077): a production build with the switch on, served by
 * `vite preview` — the bundle a visitor gets, and far quicker to open and seed
 * than the dev server's thousands of modules.
 */
const DEMO_PORT = PORT + 1;
/**
 * The Demo built with a Source link (VITE_DEMO_SOURCE_URL); the one on
 * DEMO_PORT has none, like the Demo today. demo.spec.ts finds it as the port
 * after DEMO_PORT. Built exactly as the Demo is deployed: without the test
 * hook the DEMO_PORT build carries (VITE_DEMO_E2E, src/demo/inspect.ts).
 */
const DEMO_SOURCE_PORT = PORT + 2;
/** The Demo life, seeded once by demo.setup.ts (which writes this path). */
const DEMO_STATE = "e2e/.auth/demo.json";

/** Build the Demo into `outDir`, then serve that build on `port`. */
const demoServer = (port: number, outDir: string) =>
  `pnpm exec vite build --outDir ${outDir} --emptyOutDir --logLevel warn && pnpm exec vite preview --outDir ${outDir} --port ${port} --strictPort`;

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
      // Opens the Demo once and keeps the life it seeds, so the cases need not
      // each write it again.
      name: "demo-setup",
      testMatch: /demo\.setup\.ts/,
      use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${DEMO_PORT}`, locale: "en-IE" },
    },
    {
      // The Demo (never the layout seed); phone and desktop widths are set per
      // test in demo.spec.ts. Cases start from the seeded life; those about a
      // stranger's first open start from an empty store instead.
      name: "demo",
      testMatch: /demo\.spec\.ts/,
      dependencies: ["demo-setup"],
      timeout: 30_000,
      workers: 2,
      // Dates and amounts as the Demo's made-up person reads them, whatever this machine's locale.
      use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${DEMO_PORT}`, storageState: DEMO_STATE, locale: "en-IE" },
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
      command: demoServer(DEMO_PORT, "dist/demo"),
      url: `http://localhost:${DEMO_PORT}`,
      env: { VITE_DEMO: "1", VITE_DEMO_E2E: "1" },
      reuseExistingServer: false,
      timeout: 240_000,
    },
    {
      command: demoServer(DEMO_SOURCE_PORT, "dist/demo-source"),
      url: `http://localhost:${DEMO_SOURCE_PORT}`,
      env: { VITE_DEMO: "1", VITE_DEMO_SOURCE_URL: "https://github.com/grimfeld/lifeline" },
      reuseExistingServer: false,
      timeout: 240_000,
    },
  ],
});
