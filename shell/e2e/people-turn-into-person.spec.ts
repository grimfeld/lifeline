import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";

/**
 * Turning someone I came to know into a Person (ADR 0113): a Library Author
 * or a Museum Artist becomes a Person that still wears the Role, keeping its
 * works, aliases and body, after a confirmation.
 */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

/** The Vault's links panel is a sheet on a phone: open it when the button is not already there. */
async function turnButton(page: Page) {
  const button = page.getByRole("button", { name: /Turn into a Person/ });
  if (!(await button.isVisible())) await page.getByRole("button", { name: "Toggle links panel" }).click();
  return button;
}

const put = (page: Page, doc: Record<string, unknown>) =>
  inCore(page, async (core, d: Record<string, unknown>) => (await core.putDocument(d as never)).id as string, doc);
const read = (page: Page, id: string) => inCore(page, async (core, i: string) => (await core.getDocument(i)) as never as Record<string, unknown>, id);
const ready = (page: Page, type: string) => expect.poll(() => inCore(page, async (core, t: string) => !!core.documentType(t), type)).toBe(true);

test("Library: an Author is turned into a Person from the Author page, and stays the Author of their works", async ({ page }) => {
  await page.goto("/app/library");
  await workLocally(page);
  await ready(page, "author");
  const name = `Ursula ${Date.now()}`;
  const id = await put(page, { type: "author", title: name, aliases: ["U. K."], body: "Met at a reading.", born: "1929" });
  const book = await put(page, { type: "book", title: `Earthsea ${Date.now()}`, authors: [id], engagement: "UNSTARTED", acquisition: "OWNED", addedOn: "2026-01-01" });

  await page.goto(`/app/library/authors/${id}`);
  await workLocally(page);
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page.getByRole("menuitem", { name: /Turn into a Person/ }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText(`Turn ${name} into a Person?`);
  await confirm.getByRole("button", { name: "Turn into a Person" }).click();

  await expect.poll(() => read(page, id)).toMatchObject({ type: "contacts_person", roles: ["author"], title: name, aliases: ["U. K."], body: "Met at a reading.", born: "1929" });
  expect(await read(page, book)).toMatchObject({ authors: [id] });
  // Still an Author in the Library, and a Person on the People page.
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await page.getByRole("button", { name: "More", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: /Turn into a Person/ })).toHaveCount(0);
  await page.goto(`/app/people/person/${id}`);
  await workLocally(page);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
});

test("Museum: an Artist is turned into a Person from the Vault, after a confirmation that can be declined", async ({ page }) => {
  await page.goto("/vault");
  await workLocally(page);
  await ready(page, "artist");
  const name = `Anselm ${Date.now()}`;
  const id = await put(page, { type: "artist", title: name, aliases: [], years: "1945" });
  const work = await put(page, { type: "painting", title: `Sunflowers ${Date.now()}`, artistId: id });

  await page.goto(`/vault/d/${id}`);
  await workLocally(page);
  await (await turnButton(page)).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click();
  expect(await read(page, id)).toMatchObject({ type: "artist" });

  await (await turnButton(page)).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Turn into a Person" }).click();
  await expect.poll(() => read(page, id)).toMatchObject({ type: "contacts_person", roles: ["artist"], years: "1945" });
  expect(await read(page, work)).toMatchObject({ artistId: id });
});
