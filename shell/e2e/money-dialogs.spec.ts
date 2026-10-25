import { test, expect, type Page } from "@playwright/test";
import { CORE_URL } from "./support/seed";
import { openCalendar, pickDate } from "./support/date-picker";
import { inCore } from "./support/core";

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

/** Letters only: a payee's digits are normalized away, so a digit stamp would not tell two runs apart. */
const lettersStamp = () => Date.now().toString().replace(/\d/g, (d) => "abcdefghij".charAt(Number(d)));

test("Ledger: Apply to history recategorizes the ticked rows only, and a never rule has no action", async ({ page }) => {
  const word = `rides${lettersStamp()}`;
  const tx = (n: number, payee: string, categoryId: string, date: string) => ({
    type: "ledger_transaction", title: "", kind: "expense", date, amount: 1000 + n, accountId: "$0", fromAccountId: "", toAccountId: "", categoryId, payee, note: "", importId: "", paypalId: "", bankPayee: "", folder: "", tags: [],
  });
  await page.goto("/");
  await workLocally(page);
  const ids = await inCore(
    page,
    async (core, a: { word: string }) => {
      const put = async (d: Record<string, unknown>) => (await core.putDocument({ folder: "", tags: [], ...d } as unknown as { type: string })).id as string;
      const acc = await put({ type: "ledger_account", title: `Checking ${a.word}`, flavor: "checking", openingBalance: 0, archived: false, importMapping: null });
      const taxi = await put({ type: "ledger_category", title: `Taxi ${a.word}`, kind: "expense", group: "", target: 0, accumulating: false });
      const target = await put({ type: "ledger_category", title: `Cab ${a.word}`, kind: "expense", group: "", target: 0, accumulating: false });
      await put({ type: "ledger_rule", title: a.word, match: a.word, mode: "contains", kind: "expense", categoryId: target, never: false });
      await put({ type: "ledger_rule", title: `${a.word}never`, match: `${a.word}never`, mode: "contains", kind: "both", categoryId: "", never: true });
      return { acc, taxi, target };
    },
    { word },
  );
  const rows = [
    ["1", `${word} one`, ids.taxi, "2026-03-01"],
    ["2", `${word} two`, ids.taxi, "2026-02-01"],
    ["3", `${word} inbox`, "", "2026-01-01"],
  ] as const;
  const made: string[] = [];
  for (const [n, payee, cat, date] of rows) {
    made.push(await inCore(page, async (core, d: Record<string, unknown>) => (await core.putDocument(d as unknown as { type: string })).id as string, { ...tx(Number(n), payee, cat, date), accountId: ids.acc }));
  }

  await open(page, "/app/ledger?tab=rules");
  await page.getByLabel("Search rules").fill(word);
  // Two rules match the search (the Category rule and the never rule); only the Category rule has the action.
  await expect(page.getByRole("button", { name: "Edit this rule" })).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Apply to history" })).toHaveCount(1);
  await page.getByRole("button", { name: "Apply to history" }).click();
  const dialog = page.getByRole("dialog", { name: new RegExp(`Apply “${word}”`) });
  await expect(dialog.getByRole("button", { name: "Recategorize 3" })).toBeVisible();
  await expect(dialog).toContainText("Changes spending in 3 past months");
  await dialog.getByRole("checkbox", { name: `Recategorize ${word} two` }).click();
  await expect(dialog.getByRole("button", { name: "Recategorize 2" })).toBeVisible();
  await expect(dialog).toContainText("Changes spending in 2 past months");
  await dialog.getByRole("button", { name: "Recategorize 2" }).click();
  await expect(dialog).toBeHidden();

  const cat = (id: string) => inCore(page, async (core, i: string) => (await core.getDocument(i))!.categoryId, id);
  await expect.poll(() => cat(made[0]!)).toBe(ids.target);
  await expect.poll(() => cat(made[2]!)).toBe(ids.target);
  expect(await cat(made[1]!)).toBe(ids.taxi);

  // Undo on the result toast puts every applied row's previous Category back, the inbox row included.
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(() => cat(made[0]!)).toBe(ids.taxi);
  await expect.poll(() => cat(made[2]!)).toBe("");
  expect(await cat(made[1]!)).toBe(ids.taxi);
});
