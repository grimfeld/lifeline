import { test as base } from "@playwright/test";

/**
 * The suite's `test`: every page load starts a new desk (ADR 0133), so a
 * `page.goto` lands as the one maximised Window, as a whole page did before
 * the Hub — not as one more Window beside the last test step's. `hub.spec.ts`
 * keeps the saved layout: it is what it tests.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      for (const key of Object.keys(localStorage)) if (key.startsWith("lifeline:windows:")) localStorage.removeItem(key);
    });
    await use(page);
  },
});
