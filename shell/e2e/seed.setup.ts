import { test as setup, expect } from "@playwright/test";
import { CORE_URL, LONG_WORD, seedInPage } from "./support/seed";

setup("seed the store with long content", async ({ page }) => {
  setup.setTimeout(180_000);
  // Vite may reload the page once while it optimises dependencies on a cold
  // start; seeding is idempotent per type, so a second go finishes the job.
  let report;
  for (let attempt = 1; ; attempt++) {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    try {
      report = await page.evaluate(seedInPage, { coreUrl: CORE_URL, longWord: LONG_WORD });
      break;
    } catch (e) {
      if (attempt >= 3 || !/context was destroyed|navigation/i.test((e as Error).message)) throw e;
    }
  }
  if (report.failedCommands.length) console.log(`Commands that refused seeded arguments:\n  ${report.failedCommands.join("\n  ")}`);
  expect(report.failedTypes, "every Document type can be seeded").toEqual([]);
  await page.context().storageState({ path: "e2e/.auth/seeded.json", indexedDB: true });
});
