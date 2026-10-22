import { test, expect, type Page } from "@playwright/test";
import { CORE_URL } from "./support/seed";

/**
 * A Base's bulk Delete tries each Document on its own: the ones a type's
 * `onDelete` refuses (an Offence that has Fines) stay, still selected, with
 * the reason in a toast; the rest go.
 */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

test("Offences Base: a used Offence is kept and selected, an unused one is deleted", async ({ page }) => {
  const stamp = Date.now();
  const used = `Used ${stamp}`;
  const unused = `Unused ${stamp}`;
  await page.goto("/");
  await workLocally(page);
  await page.evaluate(
    async ({ coreUrl, used, unused }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      const offence = (n: string) => core.putDocument({ type: "swearjar_offence", title: n, name: n, price: 200, emoji: "", color: "", archived: false, folder: "", tags: [] });
      const u = await offence(used);
      await offence(unused);
      await core.putDocument({ type: "swearjar_fine", title: "fine", offenceId: u.id, amount: 200, occurredAt: new Date().toISOString(), note: "", folder: "", tags: [] });
    },
    { coreUrl: CORE_URL, used, unused },
  );
  await page.goto("/base/swearjar_offence");
  await workLocally(page);

  const row = (name: string) => page.locator("tr, li").filter({ hasText: name }).last();
  await row(used).locator("[role=checkbox]:not([disabled])").first().click();
  await row(unused).locator("[role=checkbox]:not([disabled])").first().click();
  await expect(page.getByText("2 selected")).toBeVisible();
  await page.getByRole("button", { name: "Delete", exact: true }).click();

  await expect(page.getByText("1 deleted")).toBeVisible();
  await expect(page.getByText(/1 kept — .*has fines/)).toBeVisible();
  await expect(page.getByText(unused)).toHaveCount(0);
  await expect(row(used)).toBeVisible();
  await expect(page.getByText("1 selected")).toBeVisible();
  await expect(row(used).locator("[role=checkbox]:not([disabled])").first()).toBeChecked();
});
