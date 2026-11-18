import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";
import { openPalette } from "./support/palette";

/**
 * An Event's At (ADR 0128): one Place, or one Person meaning their home,
 * completed by name or alias with what each is; an unknown name makes the
 * Place. Prior art: event-with.spec.ts.
 */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

async function make(page: Page, type: string, title: string, folder: string, aliases: string[]): Promise<string> {
  return inCore(page, async (core, a: { type: string; title: string; folder: string; aliases: string[] }) => (await core.createDocument({ type: a.type, title: a.title, folder: a.folder, fields: { aliases: a.aliases } })).id as string, { type, title, folder, aliases });
}

async function storedAt(page: Page, title: string): Promise<string | undefined> {
  const events = await inCore(page, async (core) => (await core.documentsOf("event")) as never, null);
  return (events as { title: string; at?: string }[]).find((e) => e.title === title)?.at;
}

async function newEvent(page: Page, title: string) {
  await openPalette(page);
  await page.getByPlaceholder("Type a command or search…").fill("Add event");
  await page.getByRole("option", { name: "Add event Calendar", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "New event" });
  await dialog.getByLabel("Title").fill(title);
  return dialog;
}

test("an Event At a Place, found by its alias, shows where it is and is on the Place's page", async ({ page }) => {
  const stamp = Date.now();
  const title = `Dinner ${stamp}`;
  const placeName = `Chez Janou ${stamp}`;
  await page.goto("/app/events");
  await workLocally(page);
  const place = await make(page, "atlas_place", placeName, "Places", [`Janou${stamp}`]);

  const dialog = await newEvent(page, title);
  await dialog.getByRole("combobox", { name: "At" }).fill(`Janou${stamp}`);
  const option = page.getByRole("option", { name: new RegExp(placeName) });
  await expect(option).toContainText("Place");
  await option.click();
  await expect(dialog.getByText(placeName)).toBeVisible();
  await dialog.getByRole("button", { name: "Add event" }).click();
  await expect(dialog).toBeHidden();
  expect(await storedAt(page, title)).toBe(place);
  await expect(page.getByText(title).locator("..")).toContainText(`At ${placeName}`);

  await page.goto(`/app/places/place/${place}`);
  await workLocally(page);
  await expect(page.getByText(title).first()).toBeVisible();
});

test("an Event At a Person holds one At, which can be changed to a new Place by name and cleared", async ({ page }) => {
  const stamp = Date.now();
  const title = `Feed the cat ${stamp}`;
  await page.goto("/app/events");
  await workLocally(page);
  const marc = await make(page, "contacts_person", `Marc Lefèvre ${stamp}`, "People", [`Marco${stamp}`]);

  const dialog = await newEvent(page, title);
  const at = dialog.getByRole("combobox", { name: "At" });
  await at.fill(`Marco${stamp}`);
  const option = page.getByRole("option", { name: new RegExp(`Marc Lefèvre ${stamp}`) });
  await expect(option).toContainText("Person");
  await option.click();
  await expect(dialog.getByText(`Marc Lefèvre ${stamp}`)).toBeVisible();
  // At holds one: a name that is no one's makes a Place, which takes Marc's place.
  await at.fill(`Le Nouveau ${stamp}`);
  await page.getByRole("option", { name: `New place “Le Nouveau ${stamp}”` }).click();
  await expect(dialog.getByText(`Le Nouveau ${stamp}`)).toBeVisible();
  await expect(dialog.getByText(`Marc Lefèvre ${stamp}`)).toBeHidden();
  const made = await inCore(page, async (core, name: string) => ((await core.documentsOf("atlas_place")) as { id: string; title: string }[]).find((p) => p.title === name)?.id, `Le Nouveau ${stamp}`);
  expect(made).toBeTruthy();
  // Back to Marc, saved.
  await at.fill(`Marco${stamp}`);
  await page.getByRole("option", { name: new RegExp(`Marc Lefèvre ${stamp}`) }).click();
  await dialog.getByRole("button", { name: "Add event" }).click();
  await expect(dialog).toBeHidden();
  expect(await storedAt(page, title)).toBe(marc);
  await expect(page.getByText(title).locator("..")).toContainText(`At Marc Lefèvre ${stamp}`);

  // Cleared from the Event's Peek (Edit opens it, #540), saved at once.
  const row = page.locator("[data-slot=card]").filter({ hasText: title });
  await row.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const peek = page.getByRole("dialog", { name: title });
  await peek.getByRole("button", { name: "Clear At" }).click();
  await expect.poll(() => storedAt(page, title)).toBe("");
});
