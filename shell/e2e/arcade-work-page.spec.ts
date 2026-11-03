import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";

/**
 * The Arcade's Work page: every game has a page of its own. A Gallery tile
 * opens it, its Fields are edited in place there, and a Peek of the game links
 * through to it.
 */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

async function putGame(page: Page, title: string) {
  await expect.poll(() => inCore(page, async (core, t: string) => !!core.documentType(t), "game")).toBe(true);
  return inCore(
    page,
    async (core, t: string) => (await core.putDocument({ type: "game", title: t, engagement: "UNSTARTED", acquisition: "WANTED", addedOn: "2026-01-01" })).id as string,
    title,
  );
}

const fieldOf = (page: Page, id: string, key: string) => inCore(page, async (core, a: { id: string; key: string }) => (await core.getDocument(a.id))![a.key], { id, key });

test("Arcade: a Gallery tile opens the game's page, where a Field edited in place persists", async ({ page }) => {
  await page.goto("/app/arcade");
  await workLocally(page);
  const title = `Celeste ${Date.now()}`;
  const id = await putGame(page, title);

  await page.getByRole("textbox", { name: "Search games" }).fill(title);
  await page.getByRole("button", { name: `Open ${title}` }).click();
  await expect(page).toHaveURL(new RegExp(`/app/arcade/works/${id}$`));
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();

  await page.getByLabel("Developer").fill("Maddy Makes Games");
  await expect.poll(() => fieldOf(page, id, "creator")).toBe("Maddy Makes Games");
  await page.getByLabel("Reason").fill("Recommended.");
  await expect.poll(() => fieldOf(page, id, "reason")).toBe("Recommended.");

  // The guarded Shelf moves only through the Arcade's own transitions.
  await page.getByRole("button", { name: "Shelf" }).click();
  await page.getByRole("menuitem", { name: "Got it (owned)" }).click();
  await expect.poll(() => fieldOf(page, id, "acquisition")).toBe("OWNED");

  await page.reload();
  await expect(page.getByLabel("Developer")).toHaveValue("Maddy Makes Games");
});

test("Arcade: a game's Peek links through to its page", async ({ page }) => {
  await page.goto("/vault");
  await workLocally(page);
  const title = `Hades ${Date.now()}`;
  const id = await putGame(page, title);
  await inCore(page, async (core, docId: string) => core.openPeek(docId), id);
  await page.getByRole("dialog").getByRole("button", { name: /^Open/ }).click();
  await expect(page).toHaveURL(new RegExp(`/app/arcade/works/${id}$`));
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
});
