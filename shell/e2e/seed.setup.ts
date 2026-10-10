import { test as setup, expect } from "@playwright/test";
import { CORE_URL, LONG_WORD, seedInPage } from "./support/seed";

setup("seed the store with long content", async ({ page }) => {
  setup.setTimeout(180_000);
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const report = await page.evaluate(seedInPage, { coreUrl: CORE_URL, longWord: LONG_WORD });
  if (report.failedCommands.length) console.log(`Commands that refused seeded arguments:\n  ${report.failedCommands.join("\n  ")}`);
  expect(report.failedTypes, "every Document type can be seeded").toEqual([]);
  await page.context().storageState({ path: "e2e/.auth/seeded.json", indexedDB: true });
});
