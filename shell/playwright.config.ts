import { defineConfig, devices } from "@playwright/test";
import { NIGHTLY_SPECS, UI_CHECK_SPECS, free, preinstalledChromium } from "../scripts/e2e-env.mjs";

/**
 * End-to-end tests (see e2e/README.md). The delivery gate (`mobile`, `desktop`) runs
 * behaviour flows; the nightly projects run the UI checks and the Demo (ADR 0129).
 */

/** The first of 1421, 1424, 1427… whose three ports (the app and both Demos) are all free. */
async function freeBase() {
  for (let base = 1421; base < 1421 + 3 * 100; base += 3) {
    if ((await free(base)) && (await free(base + 1)) && (await free(base + 2))) return base;
  }
  throw new Error("playwright.config: no three free ports from 1421 on; set E2E_PORT");
}

// Its own vite servers, never ones found on the port: in another worktree those
// would be serving other code. So it takes the first free trio of ports from 1421
// on, or E2E_PORT and the two after it when set. The choice goes into the
// environment: the workers load this file again once the servers hold those ports,
// and must not go looking for others.
process.env.E2E_PORT ??= String(await freeBase());
const PORT = Number(process.env.E2E_PORT);
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

/**
 * The `--project` names this run asked for (`--project=a`, `--project a b`), or
 * none for every project. Patterns as Playwright reads them: `*` wildcards, any case.
 */
function selectedProjects(argv = process.argv) {
  const names: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg.startsWith("--project=")) names.push(arg.slice("--project=".length));
    else if (arg === "--project") for (let next = argv[i + 1]; next && !next.startsWith("-"); next = argv[++i + 1]) names.push(next);
  }
  return names.map((n) => new RegExp(`^${n.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`, "i"));
}
const chromium = preinstalledChromium();
const projects = selectedProjects();
/** The Demo builds take half a minute and two ports: only for a run that has Demo cases. */
const needsDemo = projects.length === 0 || projects.some((p) => p.test("demo") || p.test("demo-setup"));

/** One of these spec files, by name. */
const specs = (names: string[]) => new RegExp(`(^|/)(${names.map((n) => n.replace(/\./g, "\\.")).join("|")})$`);
/** The UI checks (ADR 0129): how screens look and read. Nightly, at both widths, in their own projects. */
const UI_CHECKS = specs(UI_CHECK_SPECS);
/** Specs the gate projects never run: the UI checks and the Demo (its own `demo` project). */
const NIGHTLY_ONLY = specs(NIGHTLY_SPECS);
/**
 * A case for the phone only, which the desktop project leaves out. `@phone\b` does not
 * match `@also-phone`: there the `@` is followed by `also`.
 */
const PHONE_ONLY = /@phone\b/;
/** A case tagged for the phone: `@phone` (phone width only) or `@also-phone` (both widths). */
const PHONE_TAGS = /@(also-)?phone\b/;
const PHONE = { ...devices["Pixel 5"], viewport: { width: 360, height: 780 }, storageState: "e2e/.auth/seeded.json", locale: "en-IE" };
const DESKTOP = { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 }, storageState: "e2e/.auth/seeded.json", locale: "en-IE" };

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // In CI the github reporter turns each failure into an annotation on the check run.
  // The json report names the failing cases for the nightly run's issue (scripts/e2e-failures.mjs).
  reporter: process.env.CI ? [["list"], ["github"], ["html", { open: "never" }], ["json", { outputFile: "e2e-results.json" }]] : "list",
  use: {
    // Cloud containers ship their Chromium in /opt/pw-browsers, at a build that may not
    // be the one this Playwright expects, and cannot download another: launch that one.
    // Elsewhere nothing is set and Playwright uses its own.
    ...(chromium ? { launchOptions: { executablePath: chromium } } : {}),
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "seed", testMatch: /seed\.setup\.ts/, use: { ...devices["Desktop Chrome"] } },
    // The delivery gate (ADR 0129): behaviour flows, at desktop width unless a case
    // carries a phone tag. `@phone` runs at phone width only, `@also-phone` at both.
    {
      name: "mobile",
      dependencies: ["seed"],
      testIgnore: NIGHTLY_ONLY,
      grep: PHONE_TAGS,
      // A small Android phone: the narrowest width the app is laid out for. Here and
      // below, dates and numbers read in en-IE whatever this machine's locale.
      use: PHONE,
    },
    {
      name: "desktop",
      dependencies: ["seed"],
      testIgnore: NIGHTLY_ONLY,
      grepInvert: PHONE_ONLY,
      use: DESKTOP,
    },
    // Nightly only (e2e.yml): the UI checks, every case at both widths (ADR 0065, 0129).
    { name: "nightly-mobile", dependencies: ["seed"], testMatch: UI_CHECKS, use: PHONE },
    { name: "nightly-desktop", dependencies: ["seed"], testMatch: UI_CHECKS, use: DESKTOP },
    {
      // Opens the Demo once and keeps the life it seeds, so the cases need not
      // each write it again.
      name: "demo-setup",
      testMatch: /demo\.setup\.ts/,
      use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${DEMO_PORT}`, locale: "en-IE" },
    },
    {
      // The Demo (never the layout seed), nightly only; phone and desktop widths are
      // set per test in demo.spec.ts. Cases start from the seeded life; those about a
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
      // Nothing cached by the browser: Chromium's HTTP cache stalls over many page loads (build/noStore.ts).
      env: { LIFELINE_E2E_NO_STORE: "1" },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    ...(needsDemo
      ? [
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
        ]
      : []),
  ],
});
