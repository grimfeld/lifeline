import { test, expect } from "@playwright/test";
import { workLocally } from "./support/journal";

/** On a phone, ☰ on /vault opens the Vault's sidebar, with a way back to the Rail (#319, ADR 0068). */
test.describe("Vault · the phone drawer (#319)", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) >= 768, "the drawer is a phone feature");

  test("☰ shows Files / Search / Tags, a pick closes it, All places goes to the Rail", async ({ page }) => {
    await page.goto("/vault");
    await workLocally(page);
    const drawer = page.getByRole("dialog", { name: "Navigation" });

    await page.getByRole("button", { name: "Menu" }).click();
    await expect(drawer.getByRole("button", { name: "Files" })).toBeVisible();
    await expect(drawer.getByRole("button", { name: "Search" })).toBeVisible();
    await expect(drawer.getByRole("button", { name: "Tags" })).toBeVisible();

    // A file in the tree: picking it closes the drawer and opens it.
    const file = drawer.locator("button[draggable=true]").first();
    await expect(file).toBeVisible();
    const title = await file.getAttribute("title");
    await file.click();
    await expect(drawer).toBeHidden();
    await expect(page).not.toHaveURL(/\/vault\/?$/);
    if (title) await expect(page.getByText(title).first()).toBeVisible();

    await page.getByRole("button", { name: "Menu" }).click();
    await drawer.getByRole("button", { name: "All places" }).click();
    await expect(drawer.getByRole("button", { name: "Files" })).toHaveCount(0);
    await expect(drawer.getByRole("button", { name: "All places" })).toHaveCount(0);
  });
});
