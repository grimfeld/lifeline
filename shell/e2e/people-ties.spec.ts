import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";

/** Ties between People (#412): entered once on either page, read from each side. */

const PERSON = "contacts_person";

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 8000 }).then(() => local.click(), () => {});
}

async function makePerson(page: Page, title: string): Promise<string> {
  return inCore(page, async (core, a: { type: string; title: string }) => (await core.createDocument({ type: a.type, title: a.title })).id as string, { type: PERSON, title });
}

test("a Tie entered on Anne's page reads from Léa's, is edited from there, and goes with a Person", async ({ page }) => {
  await page.goto("/app/people");
  await workLocally(page);
  const anne = await makePerson(page, "Anne");
  const lea = await makePerson(page, "Léa");

  await page.goto(`/app/people/person/${anne}`);
  await workLocally(page);
  const ties = page.getByRole("region", { name: "Ties" });
  await ties.getByRole("button", { name: "Add tie" }).click();
  const dialog = page.getByRole("dialog", { name: "Add a tie" });
  await dialog.getByRole("combobox").fill("Lé");
  await page.getByRole("option", { name: /Léa/ }).click();
  await dialog.getByLabel("Léa is Anne's…").fill("daughter");
  await dialog.getByLabel("Anne is Léa's…").fill("mother");
  await dialog.getByRole("button", { name: "Add" }).click();
  await expect(ties).toContainText("daughter: Léa");

  // Stored once.
  // (the seeded demo data holds Ties of its own: count those between these two.)
  const between = await inCore(page, async (core, ids: string[]) => (await core.documentsOf("contacts_tie")).filter((t) => ids.includes(t.a as string) && ids.includes(t.b as string)).length, [anne, lea]);
  expect(between).toBe(1);

  // Read from the other side, with the words swapped; edit it there.
  await ties.getByRole("link", { name: "Léa" }).click();
  await expect(page).toHaveURL(new RegExp(`/person/${lea}$`));
  await expect(ties).toContainText("mother: Anne");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await ties.getByRole("button", { name: "Edit mother: Anne" }).click();
  const edit = page.getByRole("dialog", { name: "Edit tie" });
  await edit.getByLabel("Anne is Léa's…").fill("mum");
  await edit.getByRole("button", { name: "Save" }).click();
  await expect(ties).toContainText("mum: Anne");
  await page.goto(`/app/people/person/${anne}`);
  await workLocally(page);
  await expect(ties).toContainText("daughter: Léa");

  // Deleting a Person takes the Tie; the other page is whole.
  await inCore(page, async (core, id: string) => core.removeDocument(id), anne);
  await page.goto(`/app/people/person/${lea}`);
  await workLocally(page);
  await expect(ties).toContainText("No ties yet.");
});
