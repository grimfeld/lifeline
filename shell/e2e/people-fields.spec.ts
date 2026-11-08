import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";
import { openPalette } from "./support/palette";

/**
 * The People fields beyond an Event's With (CONTEXT.md): a Task's For, a
 * Transaction's For and a Work's Recommended by. Each completes People's
 * names and aliases in its own dialog, and shows on the Person's page under
 * what it is. None of them counts as Seen.
 */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

async function newPerson(page: Page, title: string, alias: string) {
  return inCore(page, async (core, a: { title: string; alias: string }) => (await core.createDocument({ type: "contacts_person", title: a.title, fields: { aliases: [a.alias] } })).id as string, { title, alias });
}

async function runCommand(page: Page, query: string, option: string | RegExp) {
  await openPalette(page);
  await page.getByPlaceholder("Type a command or search…").fill(query);
  await page.getByRole("option", { name: option }).first().click();
}

/** Pick `alias`'s Person in the field named `label` of `dialog`. */
async function pickPerson(page: Page, dialog: ReturnType<Page["getByRole"]>, label: string, alias: string, name: string) {
  await dialog.getByRole("combobox", { name: label }).fill(alias);
  await page.getByRole("option", { name: new RegExp(name) }).click();
  await expect(dialog.getByText(name)).toBeVisible();
}

test("a Task added For someone, found by an alias, shows on their Person page under Tasks", async ({ page }) => {
  const title = `Buy a present ${Date.now()}`;
  await page.goto("/app/projects");
  await workLocally(page);
  const anne = await newPerson(page, "Anne Verhoeven", "Annie");

  await runCommand(page, "Add task", /^Add task/);
  const dialog = page.getByRole("dialog", { name: "New task" });
  await dialog.getByLabel("Title").fill(title);
  await pickPerson(page, dialog, "For", "Annie", "Anne Verhoeven");
  await dialog.getByRole("button", { name: "Add task" }).click();
  await expect(dialog).toBeHidden();

  await page.goto(`/app/people/person/${anne}`);
  await workLocally(page);
  await expect(page.getByRole("region", { name: "Tasks" })).toContainText(title);
});

test("a Transaction added For someone shows on their Person page under Transactions", async ({ page }) => {
  const payee = `Flowers ${Date.now()}`;
  await page.goto("/app/ledger");
  await workLocally(page);
  const marc = await newPerson(page, "Marc Lefèvre", "Marco");
  await inCore(page, async (core) => {
    await core.putDocument({ type: "ledger_account", title: "Current", flavor: "checking", openingBalance: 0, archived: false, importMapping: null, folder: "", tags: [] });
    await core.putDocument({ type: "ledger_category", title: "Gifts", kind: "expense", group: "", target: 0, accumulating: false, folder: "", tags: [] });
  }, null);

  await runCommand(page, "Add transaction", /^Add transaction/);
  const dialog = page.getByRole("dialog", { name: "Add transaction" });
  await dialog.getByLabel("Amount").fill("25");
  await dialog.getByLabel("Payee").fill(payee);
  await dialog.getByRole("combobox", { name: "Category" }).click();
  await page.getByRole("option", { name: "Gifts" }).click();
  await pickPerson(page, dialog, "For", "Marco", "Marc Lefèvre");
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await expect(dialog).toBeHidden();

  await page.goto(`/app/people/person/${marc}`);
  await workLocally(page);
  await expect(page.getByRole("region", { name: "Transactions" })).toContainText(payee);
});

test("a book added Recommended by someone shows on their Person page, and Reason stays free text", async ({ page }) => {
  const title = `Dune ${Date.now()}`;
  await page.route(/^https:\/\/(?!localhost)/, (route) => route.abort());
  await page.goto("/app/library");
  await workLocally(page);
  const jo = await newPerson(page, "Jo Peeters", "Joey");

  await runCommand(page, "Add book with details", /^Add book with details/);
  const dialog = page.getByRole("dialog", { name: "Add book" });
  await dialog.getByLabel("Title").fill(title);
  await dialog.getByRole("button", { name: "Can't find it — enter manually" }).click();
  await dialog.getByLabel("Reason").fill("Sounded good");
  await pickPerson(page, dialog, "Recommended by", "Joey", "Jo Peeters");
  await dialog.getByRole("button", { name: /^Add/ }).last().click();
  await expect(dialog).toBeHidden();

  await page.goto(`/app/people/person/${jo}`);
  await workLocally(page);
  await expect(page.getByRole("region", { name: "Books" })).toContainText(title);
});
