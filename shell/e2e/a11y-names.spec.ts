import { test, expect, type Page } from "@playwright/test";
import { openPalette } from "./support/palette";

/**
 * Names a screen reader needs (batch 10): the tab says where you are (WCAG
 * 2.4.2), the palette's input has a name and says how many results it left
 * (4.1.2, 4.1.3), and each Card's title is a heading (1.3.1).
 */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

test("the tab's title names the place, and the page's own title when it has one", async ({ page }) => {
  await page.goto("/calendar");
  await workLocally(page);
  await expect(page).toHaveTitle("Calendar · Lifeline");

  await page.goto("/base");
  await expect(page).toHaveTitle("Bases · Lifeline");

  await page.goto("/settings/keys");
  await expect(page).toHaveTitle(/^Keys · Lifeline$/);
});

test("the palette's input is named, and the result count is announced", async ({ page, isMobile }) => {
  test.skip(isMobile, "The palette opens by key on the desk");
  await page.goto("/calendar");
  await workLocally(page);
  await openPalette(page);
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("combobox", { name: "Search commands" })).toBeFocused();
  await page.keyboard.type("Go to Calendar");
  await expect(dialog.getByRole("status")).toHaveText(/^\d+ results?$/);
});

test("every Card's title is a heading", async ({ page }) => {
  await page.goto("/screen/e2elongcontent1");
  await workLocally(page);
  const titles = page.locator('[data-slot="card-title"]');
  await expect(titles.first()).toBeVisible();
  const count = await titles.count();
  expect(count).toBeGreaterThan(5);
  await expect(page.locator('h2[data-slot="card-title"]')).toHaveCount(count);
});
