import { test, expect, type Page } from "@playwright/test";
import { CORE_URL } from "./support/seed";

/**
 * Renaming a saved View in a Base is a Dialog with an Input, never a native
 * prompt: a blank name cannot be submitted, Enter submits, the new name shows.
 */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

test("renaming a saved View goes through a Dialog", async ({ page }) => {
  let native = 0;
  page.on("dialog", (d) => {
    native++;
    void d.dismiss();
  });
  await page.goto("/base/daily");
  await workLocally(page);
  const id = await page.evaluate(
    async ({ coreUrl }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      const v = await core.saveView({ type: "daily", name: "E2E before", filters: [], search: "", sortBy: "title", sortDir: "asc", columns: ["title"], layout: "table", sort: 0 });
      return v.id as string;
    },
    { coreUrl: CORE_URL },
  );
  await page.goto(`/base/daily?view=${id}`);
  await workLocally(page);

  await page.getByRole("button", { name: "View actions" }).click();
  await page.getByRole("menuitem", { name: "Rename view" }).click();
  const dialog = page.getByRole("dialog", { name: "Rename view" });
  const input = dialog.getByRole("textbox", { name: "View name" });
  await expect(input).toHaveValue("E2E before");

  await input.fill("   ");
  await expect(dialog.getByRole("button", { name: "Rename" })).toBeDisabled();

  await input.fill("E2E after");
  await input.press("Enter");
  await expect(dialog).toBeHidden();
  await expect(page.getByText("E2E after").first()).toBeVisible();
  await expect(page.getByText("E2E before")).toHaveCount(0);
  expect(native).toBe(0);
});
