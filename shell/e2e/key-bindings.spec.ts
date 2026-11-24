import { expect, type Page } from "@playwright/test";
import { test } from "./support/test";
import { CORE_URL } from "./support/seed";

/**
 * Key bindings (CONTEXT.md "Key binding"): in Settings → Keys the user gives
 * any Command a key; pressing it runs the Command without the palette — a
 * Command that goes somewhere goes, one that asks opens its dialog. Desk only.
 * Which keys are refused or taken, and which Commands can't take one, is
 * `packages/core/src/keyBindings.test.ts`'s.
 */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

async function bind(page: Page, command: string, key: string) {
  await page.getByRole("button", { name: "Bind a key" }).click();
  const dialog = page.getByRole("dialog", { name: "Bind a key" });
  await dialog.getByRole("combobox", { name: "Command" }).fill(command);
  // The suggestions open in a popover of their own, outside the dialog.
  await page.getByRole("option", { name: new RegExp(command) }).first().click();
  await dialog.getByRole("button", { name: "Key", exact: true }).press(key);
  await dialog.getByRole("button", { name: "Bind", exact: true }).click();
  await expect(dialog).toBeHidden();
}

test("a bound key runs its Command, and opens the dialog of one that asks", async ({ page }) => {
  await page.goto("/settings/keys");
  await workLocally(page);

  await bind(page, "Go to Arcade", "Control+Shift+Y");
  await bind(page, "Set mood", "Control+Alt+Y");
  await expect(page.getByRole("list", { name: "Key bindings" }).getByRole("listitem")).toHaveCount(2);

  await page.keyboard.press("Control+Shift+Y");
  await expect(page).toHaveURL(/\/app\/arcade/);

  await page.keyboard.press("Control+Alt+Y");
  await expect(page.getByRole("dialog", { name: "How was it?" })).toBeVisible();
  await page.keyboard.press("Escape");

  // The palette shows the key beside its Command.
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox").fill("Go to Arcade");
  await expect(page.getByRole("option", { name: /Go to Arcade/ }).first()).toContainText(/Y/);
});

test("a binding whose Command no longer exists is shown dead and can be cleared", async ({ page }) => {
  await page.goto("/settings/keys");
  await workLocally(page);
  await page.evaluate(async (coreUrl) => {
    const core = await import(/* @vite-ignore */ coreUrl);
    await core.put("key_bindings", { id: "e2edeadbinding1", key: "Mod+Alt+Shift+G", command: "gone/gone.app" });
  }, CORE_URL);
  const row = page.getByRole("listitem").filter({ hasText: "Dead" });
  await expect(row).toContainText("gone/gone.app no longer exists");
  await row.getByRole("button", { name: /^Clear/ }).click();
  await expect(row).toBeHidden();
});

test("on the phone no key runs anything", { tag: "@phone" }, async ({ page }) => {
  await page.goto("/settings/keys");
  await workLocally(page);
  await page.evaluate(async (coreUrl) => {
    const core = await import(/* @vite-ignore */ coreUrl);
    const c = core.allCommands().find((x: { id: string }) => x.id === "arcade.open");
    await core.saveKeyBinding({ key: "Mod+Shift+Y", command: `${c.appId}/${c.id}` });
  }, CORE_URL);
  await expect(page.getByRole("list", { name: "Key bindings" })).toBeVisible();
  await page.keyboard.press("Control+Shift+Y");
  await page.waitForTimeout(300);
  await expect(page).toHaveURL(/\/settings\/keys/);
});
