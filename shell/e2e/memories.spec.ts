import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";
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
