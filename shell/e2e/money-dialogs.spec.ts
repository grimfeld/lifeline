import { test, expect, type Page } from "@playwright/test";
import { CORE_URL } from "./support/seed";
import { openCalendar, pickDate } from "./support/date-picker";

/**
 * The Money Module's dialogs pick their days from the kit's Date picker
 * (ADR 0087), never the browser's date input. One case per App: a day picked
 * in the dialog, the Document stored with it.
 */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

/** The stored Documents of a type whose `key` field equals `value`. */
function stored(page: Page, type: string, key: string, value: string): Promise<Record<string, unknown>[]> {
  return page.evaluate(
    async ({ coreUrl, type, key, value }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      return (await core.allDocuments()).filter((d: Record<string, unknown>) => d.type === type && d[key] === value);
    },
    { coreUrl: CORE_URL, type, key, value },
  );
}

async function open(page: Page, path: string) {
  await page.goto(path);
  await workLocally(page);
}

test("Pocket: a custom Allowance runs from → to, and to can't fall before from", async ({ page }) => {
  const name = `Holiday ${Date.now()}`;
  await open(page, "/app/pocket");
  await page.getByRole("button", { name: "New allowance" }).click();
  const dialog = page.getByRole("dialog", { name: "New allowance" });
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByLabel("Amount").fill("300");
  await dialog.getByRole("combobox").filter({ hasText: "Month" }).click();
  await page.getByRole("option", { name: "Custom span" }).click();
  await expect(dialog.locator('input[type="date"]')).toHaveCount(0);

  await pickDate(page, dialog.getByLabel("From"), "2026-10-10");
  await dialog.getByLabel("To").click();
  const calendar = openCalendar(page);
  await calendar.getByRole("combobox", { name: "Choose the Year" }).selectOption("2026");
  await calendar.getByRole("combobox", { name: "Choose the Month" }).selectOption("9");
  await expect(calendar.locator('[role="gridcell"][data-day="2026-10-09"] button')).toBeDisabled();
  await calendar.locator('[role="gridcell"][data-day="2026-10-20"]:not([data-outside]) button').click();
  await expect(calendar).toBeHidden();

  await dialog.getByRole("button", { name: "Create" }).click();
  await expect.poll(async () => (await stored(page, "pocket_allowance", "name", name)).map((a) => [a.from, a.to])).toEqual([["2026-10-10", "2026-10-20"]]);
});

test("Pocket: a Spend is stored on the day picked", async ({ page }) => {
  const label = `Lunch ${Date.now()}`;
  await open(page, "/app/pocket");
  await page.getByRole("button", { name: "Spend", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Spend" });
  await dialog.getByLabel("Amount").fill("12");
  await dialog.getByLabel("Label").fill(label);
  await expect(dialog.locator('input[type="date"]')).toHaveCount(0);
  await pickDate(page, dialog.getByLabel("Day"), "2026-09-03");
  await dialog.getByRole("button", { name: "Spend", exact: true }).click();
  await expect.poll(async () => (await stored(page, "pocket_spend", "label", label)).map((s) => s.date)).toEqual(["2026-09-03"]);
});

test("Ledger: a Transaction is stored on the day picked", async ({ page }) => {
  const payee = `Bakery ${Date.now()}`;
  await open(page, "/app/ledger");
  await page.getByRole("button", { name: "Add transaction" }).first().click();
  const dialog = page.getByRole("dialog").filter({ has: page.getByLabel("Payee") });
  await dialog.getByLabel("Amount").fill("4,50");
  await dialog.getByLabel("Payee").fill(payee);
  await dialog.getByRole("combobox").filter({ hasText: "Uncategorized" }).click();
  await page.getByRole("option").first().click();
  await expect(dialog.locator('input[type="date"]')).toHaveCount(0);
  await pickDate(page, dialog.getByLabel("Day"), "2026-08-14");
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await expect.poll(async () => (await stored(page, "ledger_transaction", "payee", payee)).map((t) => t.date)).toEqual(["2026-08-14"]);
});

test("Prices: Add price and Receipt pick their day from the calendar", async ({ page }) => {
  await open(page, "/app/prices");
  await page.getByRole("button", { name: "Price", exact: true }).click();
  let dialog = page.getByRole("dialog").filter({ has: page.getByLabel("Day") });
  await expect(dialog.locator('input[type="date"]')).toHaveCount(0);
  await pickDate(page, dialog.getByLabel("Day"), "2026-07-01");
  await expect(dialog.getByLabel("Day")).toContainText("2026");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Receipt", exact: true }).click();
  dialog = page.getByRole("dialog").filter({ has: page.getByLabel("Day") });
  await expect(dialog.locator('input[type="date"]')).toHaveCount(0);
  await pickDate(page, dialog.getByLabel("Day"), "2026-07-02");
  await expect(dialog.getByLabel("Day")).toContainText("2026");
});
