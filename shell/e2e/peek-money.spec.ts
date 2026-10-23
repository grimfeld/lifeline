import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";

/**
 * Ledger, Pocket, Prices, Knowledge and Projects edit in their own Peek
 * (ADR 0085): each draws its own Fields with its own controls and writes
 * them through its own operations. One case per App: a Document made where
 * it is not shown, peeked, a Field edited, the edit kept.
 */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

/** Store the Documents in order (each may name the ids before it as `$0`, `$1`…) and return their ids. */
async function make(page: Page, docs: Record<string, unknown>[]): Promise<string[]> {
  await page.goto("/");
  await workLocally(page);
  return inCore(
    page,
    async (core, list: Record<string, unknown>[]) => {
      const ids: string[] = [];
      for (const d of list) {
        const filled = Object.fromEntries(Object.entries(d).map(([k, v]) => [k, typeof v === "string" && /^\$\d+$/.test(v) ? ids[Number(v.slice(1))] : v]));
        ids.push((await core.putDocument({ folder: "", tags: [], ...filled } as unknown as { type: string })).id);
      }
      return ids;
    },
    docs,
  );
}

async function peek(page: Page, id: string) {
  await inCore(page, async (core, docId: string) => core.openPeek(docId), id);
  return page.getByRole("dialog");
}

const field = (page: Page, id: string, key: string) => inCore(page, async (core, a: { id: string; key: string }) => (await core.getDocument(a.id))![a.key], { id, key });

test("Ledger: a Transaction's payee is edited in its Peek", async ({ page }) => {
  const stamp = Date.now();
  const ids = await make(page, [
    { type: "ledger_account", title: `Checking ${stamp}`, flavor: "checking", openingBalance: 0, archived: false, importMapping: null },
    { type: "ledger_category", title: `Food ${stamp}`, kind: "expense", group: "", target: 0, accumulating: false },
    { type: "ledger_transaction", title: "", kind: "expense", date: "2026-10-01", amount: 1250, accountId: "$0", fromAccountId: "", toAccountId: "", categoryId: "$1", payee: "Bakery", note: "", importId: "", paypalId: "", bankPayee: "" },
  ]);
  const dialog = await peek(page, ids[2]);
  await dialog.getByLabel("Payee").fill(`Baker ${stamp}`);
  await dialog.getByLabel("Payee").press("Enter");
  await expect.poll(() => field(page, ids[2], "payee")).toBe(`Baker ${stamp}`);
  // The kind is the Ledger's (guarded): no control in the Peek writes it.
  await expect(dialog.getByLabel("Kind")).toHaveCount(0);
});

test("Pocket: an Allowance's name is edited in its Peek, and its title follows", async ({ page }) => {
  const stamp = Date.now();
  const [id] = await make(page, [{ type: "pocket_allowance", title: "", name: "Eating out", period: "month", from: "2026-10-01", to: "", amount: 30000, emoji: "", color: "" }]);
  const dialog = await peek(page, id);
  await dialog.getByLabel("Name").fill(`Cinema ${stamp}`);
  await dialog.getByLabel("Name").blur();
  await expect.poll(() => field(page, id, "name")).toBe(`Cinema ${stamp}`);
  await expect.poll(() => field(page, id, "title")).toContain(`Cinema ${stamp}`);
});

test("Prices: a Receipt's branch is edited in its Peek", async ({ page }) => {
  const stamp = Date.now();
  const ids = await make(page, [
    { type: "price_shop", title: `Shop ${stamp}`, note: "" },
    { type: "price_receipt", title: "", shopId: "$0", date: "2026-10-01", branch: "", total: 0, body: "" },
  ]);
  const dialog = await peek(page, ids[1]);
  await dialog.getByLabel("Branch").fill(`Centre ${stamp}`);
  await dialog.getByLabel("Branch").press("Enter");
  await expect.poll(() => field(page, ids[1], "branch")).toBe(`Centre ${stamp}`);
});

test("Knowledge: a Word's meaning is edited in its Peek", async ({ page }) => {
  const stamp = Date.now();
  const ids = await make(page, [
    { type: "language", title: "", name: `Spanish ${stamp}`, newCap: 10, archived: false },
    { type: "language_word", title: "", languageId: "$0", term: `ganas ${stamp}`, meaning: "desire", notes: "", origin: "", originId: "", paused: false },
  ]);
  const dialog = await peek(page, ids[1]);
  await dialog.getByLabel("Meaning").fill("to feel like");
  await dialog.getByLabel("Meaning").press("Enter");
  await expect.poll(() => field(page, ids[1], "meaning")).toBe("to feel like");
});

test("Projects: a Project's outcome is edited in its Peek", async ({ page }) => {
  const stamp = Date.now();
  const [id] = await make(page, [{ type: "project", title: `Bathroom ${stamp}`, outcome: "", stage: "active", start: null, deadline: null, startedOn: null, endedOn: null, emoji: "", color: "", rank: null }]);
  const dialog = await peek(page, id);
  await dialog.getByLabel("Outcome").fill("New tiles, no leak");
  await dialog.getByLabel("Outcome").press("Enter");
  await expect.poll(() => field(page, id, "outcome")).toBe("New tiles, no leak");
});
