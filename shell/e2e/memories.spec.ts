import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";
import { openDay, seedJournal } from "./support/journal";
import { openPalette } from "./support/palette";

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

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

test("New memory from the palette keeps a photo in the Memory's body, opens it, and shows its tile in the grid", async ({ page }) => {
  await page.goto("/app/journal/memories");
  await workLocally(page);
  await openPalette(page);
  await page.keyboard.type("New memory");
  await page.getByRole("option", { name: /New memory/ }).first().click();
  const dialog = page.getByRole("dialog", { name: "New memory" });
  await dialog.getByLabel("Photo", { exact: true }).setInputFiles({ name: "terrace.png", mimeType: "image/png", buffer: PNG });
  await dialog.getByRole("textbox", { name: "Title" }).fill("Dancing on the terrace");
  await dialog.getByRole("button", { name: "Keep" }).click();
  await expect(page).toHaveURL(/\/app\/journal\/memories\/.+/);

  const body = await inCore(page, async (core) => ((await core.documentsOf("memories_memory")) as { title: string; body: string }[]).find((m) => m.title === "Dancing on the terrace")?.body ?? "", undefined);
  expect(body).toMatch(/!\[\[.+\]\]/);

  await page.goto("/app/journal/memories");
  await expect(page.locator("main ul > li > a").filter({ hasText: "Dancing on the terrace" })).toHaveCount(1);
  await expect(page.locator("main ul > li > a img")).toHaveCount(1);
});

test("from a past Event's Peek, Add a memory keeps a Memory about it, and its thumbnail shows in the panel", async ({ page }) => {
  await page.goto("/vault");
  await workLocally(page);
  const event = await inCore(page, async (core) => (await core.putDocument({ type: "event", title: "Midsummer lunch", date: "2026-03-02", endDate: null, start: null, end: null, notes: "", tags: [] })).id as string, undefined);
  const future = await inCore(page, async (core) => (await core.putDocument({ type: "event", title: "Far away", date: "2099-03-02", endDate: null, start: null, end: null, notes: "", tags: [] })).id as string, undefined);

  await inCore(page, async (core, id: string) => core.openPeek(id), future);
  const ahead = page.getByRole("dialog", { name: "Far away" });
  await expect(ahead).toBeVisible();
  await expect(ahead.getByRole("button", { name: "Add a memory" })).toHaveCount(0);
  await expect(ahead.getByRole("region", { name: "Memories" })).toHaveCount(0);
  await page.keyboard.press("Escape");

  await inCore(page, async (core, id: string) => core.openPeek(id), event);
  const peek = page.getByRole("dialog", { name: "Midsummer lunch" });
  await peek.getByRole("button", { name: "Add a memory" }).click();
  const dialog = page.getByRole("dialog", { name: "New memory" });
  await expect(dialog.getByRole("textbox", { name: "Title" })).toHaveValue("Midsummer lunch");
  await dialog.getByLabel("Photo", { exact: true }).setInputFiles({ name: "lunch.png", mimeType: "image/png", buffer: PNG });
  await dialog.getByRole("button", { name: "Keep" }).click();
  await expect(page).toHaveURL(/\/app\/journal\/memories\/.+/);

  await page.goto("/vault");
  await inCore(page, async (core, id: string) => core.openPeek(id), event);
  const panel = page.getByRole("dialog", { name: "Midsummer lunch" }).getByRole("region", { name: "Memories" });
  await expect(panel.locator("a img")).toHaveCount(1);
});

/** Below `lg` the Day's side column is the Links sheet, opened from the Links button. */
async function showDayLinks(page: Page) {
  const links = page.getByRole("button", { name: /^Links/ });
  if (await links.isVisible()) await links.click();
}

test("a Day shows the Memories dated that day, and no panel when none", { tag: "@also-phone" }, async ({ page }) => {
  await seedJournal(page, { days: { "2001-05-04": "Sunny.", "2001-05-05": "Cloudy." } });
  await keep(page, "Picnic by the canal with a very long title that has to wrap", "2001-05-04");

  await openDay(page, "2001-05-04");
  await showDayLinks(page);
  const panel = page.getByRole("region", { name: "Memories" });
  await expect(panel.getByRole("link", { name: /Picnic by the canal/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await openDay(page, "2001-05-05");
  await showDayLinks(page);
  await expect(page.getByRole("region", { name: "Memories" })).toHaveCount(0);
});

test("a Memory whose photo is gone shows its title-only tile, not a loading placeholder", async ({ page }) => {
  await page.goto("/app/journal/memories");
  await workLocally(page);
  await inCore(page, async (core) => (await core.createDocument({ type: "memories_memory", title: "Lost snapshot", folder: "Memories", body: "![[never-kept.png]]\n", fields: { date: "2026-01-02", about: [] } })).id as string, undefined);
  const tile = page.locator("main ul > li > a").filter({ hasText: "Lost snapshot" });
  await expect(tile).toHaveCount(1);
  await expect(tile.getByRole("img", { name: "Loading photo" })).toHaveCount(0);
});

test("a Memory's page edits its title, date and About through the Memory form", async ({ page }) => {
  await page.goto("/app/journal/memories");
  await workLocally(page);
  await keep(page, "Old harbour", "2020-05-01");
  await page.locator("main ul > li > a").filter({ hasText: "Old harbour" }).click();
  const title = page.getByRole("textbox", { name: "Title" });
  await title.fill("New harbour");
  await title.blur();
  await expect(page.getByRole("button", { name: "Delete" })).toBeVisible();
  await expect(page.getByText("About", { exact: true })).toBeVisible();
  const titles = await inCore(page, async (core) => ((await core.documentsOf("memories_memory")) as { title: string }[]).map((m) => m.title), undefined);
  expect(titles).toContain("New harbour");
});
