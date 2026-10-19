import { test as setup, expect } from "@playwright/test";

/**
 * Opens the Demo once and keeps the life it writes (IndexedDB and all), for
 * every `demo` case that starts from the seeded life. Its dates are this run's
 * visit day, which holds for the whole run.
 */
setup("open the Demo once and keep the life it seeds", async ({ page }) => {
  setup.setTimeout(90_000);
  await page.goto("/");
  // The app shows once today's agenda is written (main.tsx), then writes the
  // rest behind "Filling in the rest of the Demo…"; with that gone the store
  // holds the whole life.
  await expect(page.locator("main").first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("status").filter({ hasText: /^Filling in the rest of the Demo/ })).toHaveCount(0, { timeout: 60_000 });
  await page.waitForFunction(() => !!window.lifelineDemo);
  const apps = await page.evaluate(() => window.lifelineDemo!.appPages());
  expect(apps.length, "Apps with Documents seeded").toBeGreaterThan(20);
  await page.waitForLoadState("networkidle");
  await page.context().storageState({ path: "e2e/.auth/demo.json", indexedDB: true });
});
