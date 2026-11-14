import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";
import { openPalette } from "./support/palette";

/** An Event's With (a People field): completes People's names and aliases, and the Event shows on their page. */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

test("an Event added With someone, found by an alias, shows on their Person page under Events", async ({ page }) => {
  const title = `Dinner ${Date.now()}`;
  await page.goto("/app/events");
  await workLocally(page);
  const marc = await inCore(page, async (core) => (await core.createDocument({ type: "contacts_person", title: "Marc Lefèvre", fields: { aliases: ["Marco"] } })).id as string, null);

  await openPalette(page);
  await page.getByPlaceholder("Type a command or search…").fill("Add event");
  await page.getByRole("option", { name: "Add event Calendar", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "New event" });
  await dialog.getByLabel("Title").fill(title);
  await dialog.getByRole("combobox", { name: "With" }).fill("Marco");
  await page.getByRole("option", { name: /Marc Lefèvre/ }).click();
  await expect(dialog.getByText("Marc Lefèvre")).toBeVisible();
  await dialog.getByRole("button", { name: "Add event" }).click();
  await expect(dialog).toBeHidden();

  await page.goto(`/app/people/person/${marc}`);
  await workLocally(page);
  await expect(page.getByRole("region", { name: "Timeline" })).toContainText(title);
});
