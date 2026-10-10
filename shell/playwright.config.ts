import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end layout tests (see e2e/README.md): every screen, at phone and
 * desktop widths, filled with the longest content a person could type.
 */
const PORT = 1421;

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
      // A small Android phone: the narrowest width the app is laid out for.
      use: { ...devices["Pixel 5"], viewport: { width: 360, height: 780 }, storageState: "e2e/.auth/seeded.json" },
    },
    {
      name: "desktop",
      dependencies: ["seed"],
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 }, storageState: "e2e/.auth/seeded.json" },
    },
  ],
  webServer: {
    command: `pnpm exec vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
