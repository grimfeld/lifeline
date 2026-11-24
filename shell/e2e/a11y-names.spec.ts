import { expect, type Page } from "@playwright/test";
import { test } from "./support/test";
import { inCore } from "./support/core";
import { openPalette } from "./support/palette";

/**
 * Names a screen reader needs (batch 10): the tab says where you are (WCAG
 * 2.4.2), the palette's input has a name and says how many results it left
 * (4.1.2, 4.1.3), each Card's title is a heading (1.3.1), and a list of checkboxes
 * names each for its row (4.1.2).
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

test("each row's checkbox in Tidy given names is named for its Person and described with what Apply will change", async ({ page }) => {
  await page.goto("/app/people");
  await workLocally(page);
  await inCore(page, async (core) => void (await core.createDocument({ type: "contacts_person", title: "Anne Dupont", fields: { aliases: ["Anne", "Annie"] } })), undefined);
  await page.getByRole("button", { name: "Tidy given names…" }).click();
  const dialog = page.getByRole("dialog", { name: "Tidy given names" });
  const box = dialog.getByRole("checkbox", { name: "Tidy Anne Dupont", exact: true });
  await expect(box).toBeVisible();
  await expect(box).toHaveAccessibleDescription(/Given name Anne · Family name Dupont · drops alias Anne/);
});

test("each Window is a region named for its Module, and its bar's buttons are named", async ({ page, isMobile }) => {
  test.skip(isMobile, "A phone has no Windows (ADR 0133)");
  await page.goto("/calendar");
  await workLocally(page);
  const calendar = page.getByRole("region", { name: "Calendar", exact: true });
  await expect(calendar).toBeVisible();
  await expect(calendar.getByRole("button", { name: "Close Calendar" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Hub" })).toBeVisible();
});
