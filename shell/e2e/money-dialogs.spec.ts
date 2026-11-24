import { expect, type Page } from "@playwright/test";
import { test } from "./support/test";
import { CORE_URL } from "./support/seed";
import { openCalendar, pickDate } from "./support/date-picker";
import { inCore } from "./support/core";

/**
 * The Money Module's dialogs pick their days from the kit's Date picker
 * (ADR 0087), never the browser's date input: a custom Allowance's from → to,
 * and a Spend stored on the day picked (a Ledger Transaction is added in
 * people-fields.spec.ts). Apply to history keeps one flow case; which rows it
 * offers (filed elsewhere, uncategorized, decided by another rule, never
 * rules) and the count offered on save are `suggest.test.ts`'s.
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

/** Letters only: a payee's digits are normalized away, so a digit stamp would not tell two runs apart. */
const lettersStamp = () => Date.now().toString().replace(/\d/g, (d) => "abcdefghij".charAt(Number(d)));

type SeedRow = { payee: string; date: string; inbox?: boolean };

/** An Account, a "Taxi" and a "Cab" Category, and the given expenses (filed under Taxi unless `inbox`). */
async function seedRuleLedger(page: Page, word: string, rows: SeedRow[]) {
  await page.goto("/");
  await workLocally(page);
  return inCore(
    page,
    async (core, a: { word: string; rows: SeedRow[] }) => {
      const put = async (d: Record<string, unknown>) => (await core.putDocument({ folder: "", tags: [], ...d } as unknown as { type: string })).id as string;
      const acc = await put({ type: "ledger_account", title: `Checking ${a.word}`, flavor: "checking", openingBalance: 0, archived: false, importMapping: null });
      const taxi = await put({ type: "ledger_category", title: `Taxi ${a.word}`, kind: "expense", group: "", target: 0, accumulating: false });
      const target = await put({ type: "ledger_category", title: `Cab ${a.word}`, kind: "expense", group: "", target: 0, accumulating: false });
      const made: string[] = [];
      for (const [i, r] of a.rows.entries()) {
        made.push(
          await put({ type: "ledger_transaction", title: "", kind: "expense", date: r.date, amount: 1000 + i, accountId: acc, fromAccountId: "", toAccountId: "", categoryId: r.inbox ? "" : taxi, payee: r.payee, note: "", importId: "", paypalId: "", bankPayee: "", folder: "", tags: [] }),
        );
      }
      return { acc, taxi, target, made };
    },
    { word, rows },
  );
}

test("Ledger: saving a Category rule offers Apply to history, which recategorizes the ticked rows; Undo puts them back", async ({ page }) => {
  const word = `rides${lettersStamp()}`;
  const ids = await seedRuleLedger(page, word, [
    { payee: `${word} one`, date: "2026-03-01" },
    { payee: `${word} two`, date: "2026-02-01" },
    { payee: `${word} inbox`, date: "2026-01-01", inbox: true },
  ]);
  const made = ids.made;

  await open(page, "/app/ledger?tab=rules");
  await page.getByRole("button", { name: /New rule|Add rule/ }).first().click();
  const editor = page.getByRole("dialog", { name: "New rule" });
  await editor.getByLabel("Payee text").fill(word);
  await editor.getByRole("combobox", { name: "Category" }).click();
  await page.getByRole("option", { name: new RegExp(`Cab ${word}`) }).click();
  await editor.getByRole("button", { name: "Add rule" }).click();
  await expect(page.getByText("Rule added · 3 existing transactions match")).toBeVisible();
  await page.getByRole("button", { name: "Review" }).click();

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
