import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";

/**
 * Memories (ADR 0136): the Journal's Memories place is a grid of tiles, the
 * newest date first, with an empty state; a tile opens its Memory.
 */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

async function keep(page: Page, title: string, date: string) {
  await inCore(page, async (core, a: { title: string; date: string }) => (await core.createDocument({ type: "memories_memory", title: a.title, folder: "Memories", fields: { date: a.date, about: [] } })).id as string, { title, date });
}

test("the Journal's Memories place shows the Memories newest first, and a tile opens its Memory", async ({ page }) => {
  await page.goto("/app/journal/memories");
  await workLocally(page);
  await expect(page.getByRole("heading", { name: "Memories" })).toBeVisible();

  await keep(page, "Old harbour", "2020-05-01");
  await keep(page, "Dancing on the terrace", "2026-06-14");
  const tiles = page.locator("main ul > li > a");
  const dancing = tiles.filter({ hasText: "Dancing on the terrace" });
  const harbour = tiles.filter({ hasText: "Old harbour" });
  await expect(dancing).toHaveCount(1);
  await expect(harbour).toHaveCount(1);
  const titles = await tiles.allInnerTexts();
  expect(titles.findIndex((t) => t.includes("Dancing on the terrace"))).toBeLessThan(titles.findIndex((t) => t.includes("Old harbour")));

  await dancing.click();
  await expect(page).toHaveURL(/\/app\/journal\/memories\/.+/);
  await expect(page.locator("main").getByRole("link", { name: "Memories" })).toBeVisible();
});
