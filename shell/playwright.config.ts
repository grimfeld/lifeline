import { createServer } from "node:net";
import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end layout tests (see e2e/README.md): every screen, at phone and
 * desktop widths, filled with the longest content a person could type.
 */

/** Resolves whether nothing listens on `port`, on IPv4 or IPv6 localhost. */
const free = (port: number) =>
  Promise.all(
    ["127.0.0.1", "::1"].map(
      (host) =>
        new Promise<boolean>((resolve) => {
          const server = createServer()
            // A machine without IPv6 has nothing listening there either.
            .once("error", (e: NodeJS.ErrnoException) => resolve(e.code === "EADDRNOTAVAIL"))
            .once("listening", () => server.close(() => resolve(true)))
            .listen(port, host);
        }),
    ),
  ).then((all) => all.every(Boolean));

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
const projects = selectedProjects();
/** The Demo builds take half a minute and two ports: only for a run that has Demo cases. */
const needsDemo = projects.length === 0 || projects.some((p) => p.test("demo") || p.test("demo-setup"));

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
      // A small Android phone: the narrowest width the app is laid out for. Here and
      // below, dates and numbers read in en-IE whatever this machine's locale.
      use: { ...devices["Pixel 5"], viewport: { width: 360, height: 780 }, storageState: "e2e/.auth/seeded.json", locale: "en-IE" },
    },
    {
      name: "desktop",
      dependencies: ["seed"],
      testIgnore: /demo\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 }, storageState: "e2e/.auth/seeded.json", locale: "en-IE" },
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
