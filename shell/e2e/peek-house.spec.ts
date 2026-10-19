import { test, expect, type Page } from "@playwright/test";
import { CORE_URL } from "./support/seed";

/**
 * The House Apps' editable Peeks (ADR 0085): a Chore, a Provision and a Need
 * are edited where they are peeked — here over the Vault, away from House —
 * through each App's own controls, and the edit lands on the Document.
 */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

/** Runs in the page against the app's own Core module. */
async function inCore<A, R>(page: Page, fn: (core: any, arg: A) => Promise<R>, arg: A): Promise<R> {
  return page.evaluate(
    async ({ coreUrl, src, arg }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      return new Function("core", "arg", `return (${src})(core, arg);`)(core, arg);
    },
    { coreUrl: CORE_URL, src: fn.toString(), arg },
  );
}

/** Make a Document over the Vault and open its Peek. */
async function peekNew(page: Page, doc: Record<string, unknown>) {
  await page.goto("/vault");
  await workLocally(page);
  const id = await inCore(page, async (core, d: Record<string, unknown>) => (await core.putDocument(d)).id as string, doc);
  await inCore(page, async (core, docId: string) => core.openPeek(docId), id);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return { id, dialog };
}

const field = (page: Page, id: string, key: string) =>
  inCore(page, async (core, a: { id: string; key: string }) => (await core.getDocument(a.id))[a.key], { id, key });

test("a Chore's schedule is changed and the Chore paused in its Peek", async ({ page }) => {
  const { id, dialog } = await peekNew(page, {
    type: "chore",
    title: `Water the plants ${Date.now()}`,
    status: "active",
    schedule: { kind: "weekly", weekdays: [1] },
    anchorDate: null,
  });
  // Status is guarded: no raw control for it, only the Chore's operations.
  await expect(dialog.getByRole("combobox", { name: "Status" })).toHaveCount(0);

  await dialog.getByRole("combobox", { name: "Schedule" }).click();
  await page.getByRole("option", { name: "Monthly (day of month)" }).click();
  await dialog.getByLabel("Day of month (1–31)").fill("15");
  await expect.poll(() => field(page, id, "schedule")).toEqual({ kind: "monthly", dayOfMonth: 15 });

  await dialog.getByRole("button", { name: "Pause" }).click();
  await expect.poll(() => field(page, id, "status")).toBe("paused");
  await dialog.getByRole("button", { name: "Resume" }).click();
  await expect.poll(() => field(page, id, "status")).toBe("active");
});

test("a Provision is counted up and given a unit in its Peek", async ({ page }) => {
  await page.goto("/vault");
  await workLocally(page);
  const storageId = await inCore(page, async (core) => (await core.putDocument({ type: "storage", title: "Peek freezer", kind: "freezer" })).id as string, null);
  const { id, dialog } = await peekNew(page, {
    type: "provision",
    title: `Peas ${Date.now()}`,
    storageId,
    quantity: 2,
    unit: "",
    minimum: 0,
    expires: "",
    frozenOn: "",
  });
  await dialog.getByRole("button", { name: "One more" }).click();
  await expect.poll(() => field(page, id, "quantity")).toBe(3);
  await dialog.getByLabel("Unit").fill("500g bag");
  await dialog.getByLabel("Unit").blur();
  await expect.poll(() => field(page, id, "unit")).toBe("500g bag");
  await dialog.getByLabel("Expires (check by)").fill("2026-12-01");
  await expect.poll(() => field(page, id, "expires")).toBe("2026-12-01");
});

test("a Need gets a note and is ticked bought in its Peek", async ({ page }) => {
  const { id, dialog } = await peekNew(page, {
    type: "need",
    title: `Milk ${Date.now()}`,
    note: "",
    aisleId: "",
    boughtOn: "",
    listedAt: new Date().toISOString(),
  });
  await dialog.getByLabel("Note").fill("2 L, the blue one");
  await dialog.getByLabel("Note").press("Enter");
  await expect.poll(() => field(page, id, "note")).toBe("2 L, the blue one");

  await dialog.getByRole("button", { name: "Mark bought" }).click();
  await expect.poll(() => field(page, id, "boughtOn")).not.toBe("");
  await dialog.getByRole("button", { name: "Put back on list" }).click();
  await expect.poll(() => field(page, id, "boughtOn")).toBe("");
});
