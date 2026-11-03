import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";

/**
 * The Cinema's Work page (ADR 0110): every film and series has a page of its
 * own. A Gallery tile opens it, its Fields are edited in place there, and a
 * Peek of the work links through to it.
 */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

async function putMovie(page: Page, title: string) {
  await expect.poll(() => inCore(page, async (core, t: string) => !!core.documentType(t), "movie")).toBe(true);
  return inCore(page, async (core, t: string) => (await core.putDocument({ type: "movie", title: t, body: "", engagement: "UNSTARTED", addedOn: "2026-01-01" })).id as string, title);
}

const fieldOf = (page: Page, id: string, key: string) => inCore(page, async (core, a: { id: string; key: string }) => (await core.getDocument(a.id))![a.key], { id, key });

test("Cinema: a Gallery tile opens the work's page, where a Field edited in place persists", async ({ page }) => {
  await page.goto("/app/cinema");
  await workLocally(page);
  const title = `Stalker ${Date.now()}`;
  const id = await putMovie(page, title);

  await page.getByRole("textbox", { name: "Search films" }).fill(title);
  await page.getByRole("button", { name: `Open ${title}` }).first().click();
  await expect(page).toHaveURL(new RegExp(`/app/cinema/works/${id}$`));
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();

  await page.getByLabel("Reason").fill("A recommendation.");
  await expect.poll(() => fieldOf(page, id, "reason")).toBe("A recommendation.");

  // The guarded Shelf moves only through the Cinema's own transitions.
  await page.getByRole("button", { name: "Shelf" }).click();
  await page.getByRole("menuitem", { name: /^Start/ }).first().click();
  await expect.poll(() => fieldOf(page, id, "engagement")).toBe("IN_PROGRESS");

  await page.reload();
  await expect(page.getByLabel("Reason")).toHaveValue("A recommendation.");
});

test("Cinema: a work's Peek links through to its page", async ({ page }) => {
  await page.goto("/vault");
  await workLocally(page);
  const title = `Solaris ${Date.now()}`;
  const id = await putMovie(page, title);
  await inCore(page, async (core, docId: string) => core.openPeek(docId), id);
  await page.getByRole("dialog").getByRole("button", { name: /^Open/ }).click();
  await expect(page).toHaveURL(new RegExp(`/app/cinema/works/${id}$`));
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
});
