import { expect } from "@playwright/test";
import { test } from "./support/test";
import { workLocally } from "./support/journal";

/**
 * On a phone the Vault's tree, search and tags open from **Browse** in its
 * Phone dock (#319, ADR 0068): the ☰ drawer that held them is gone (#664), and
 * the Hub's grid goes between places.
 */
test.describe("Vault · the phone's Browse sheet (#319, #664)", { tag: "@phone" }, () => {
  test("Browse shows Files / Search / Tags and a pick closes it; there is no ☰", async ({ page }) => {
    await page.goto("/vault");
    await workLocally(page);
    await expect(page.getByRole("button", { name: "Menu" })).toHaveCount(0);
    const sheet = page.getByRole("dialog", { name: "Vault" });
    // The Folder tabs stay in the dock beside Browse, each on its own route.
    await expect(page.getByRole("link", { name: "Thoughts" })).toBeVisible();

    await page.getByRole("button", { name: "Browse" }).click();
    await expect(sheet.getByRole("button", { name: "Files" })).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Search" })).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Tags" })).toBeVisible();

    // A file in the tree: picking it closes the sheet and opens it.
    const file = sheet.locator("button[draggable=true]").first();
    await expect(file).toBeVisible();
    const title = await file.getAttribute("title");
    await file.click();
    await expect(sheet).toBeHidden();
    await expect(page).not.toHaveURL(/\/vault\/?$/);
    if (title) await expect(page.getByText(title).first()).toBeVisible();
  });
});
