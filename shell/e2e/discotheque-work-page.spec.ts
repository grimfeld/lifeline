import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";

/**
 * The Work page for albums (ADR 0110): every album has a page of its own. A
 * Gallery tile opens it, its Fields are edited in place there, and a Peek of
 * the album links through to it.
 */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

async function putAlbum(page: Page, title: string) {
  await expect.poll(() => inCore(page, async (core, t: string) => !!core.documentType(t), "music")).toBe(true);
  return inCore(
    page,
    async (core, t: string) => (await core.putDocument({ type: "music", title: t, body: "", engagement: "UNSTARTED", creator: "Boards of Canada", addedOn: "2026-01-01" })).id as string,
    title,
  );
}

const fieldOf = (page: Page, id: string, key: string) => inCore(page, async (core, a: { id: string; key: string }) => (await core.getDocument(a.id))![a.key], { id, key });

test("Discotheque: a Gallery tile opens the album's page, where a Field edited in place persists", async ({ page }) => {
  await page.goto("/app/discotheque");
  await workLocally(page);
  const title = `Geogaddi ${Date.now()}`;
  const id = await putAlbum(page, title);

  await page.getByRole("textbox", { name: "Search albums" }).fill(title);
  await page.getByRole("button", { name: `Open ${title}` }).click();
  await expect(page).toHaveURL(new RegExp(`/app/discotheque/works/${id}$`));
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();

  await page.getByLabel("Reason").fill("A friend's loan.");
  await expect.poll(() => fieldOf(page, id, "reason")).toBe("A friend's loan.");
  await page.getByLabel("Artist").fill("BoC");
  await expect.poll(() => fieldOf(page, id, "creator")).toBe("BoC");

  // The guarded Shelf moves only through the Discotheque's own transitions.
  await page.getByRole("button", { name: "Shelf" }).click();
  await page.getByRole("menuitem", { name: /^Start/ }).click();
  await expect.poll(() => fieldOf(page, id, "engagement")).toBe("IN_PROGRESS");

  await page.reload();
  await expect(page.getByLabel("Reason")).toHaveValue("A friend's loan.");
});

test("Discotheque: an album's Peek links through to its page", async ({ page }) => {
  await page.goto("/vault");
  await workLocally(page);
  const title = `Tomorrow's Harvest ${Date.now()}`;
  const id = await putAlbum(page, title);
  await inCore(page, async (core, docId: string) => core.openPeek(docId), id);
  await page.getByRole("dialog").getByRole("button", { name: /^Open/ }).click();
  await expect(page).toHaveURL(new RegExp(`/app/discotheque/works/${id}$`));
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
});
