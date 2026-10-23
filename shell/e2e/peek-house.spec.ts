import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";
import { openCalendar, pickDate } from "./support/date-picker";

/**
 * The House Apps' editable Peeks (ADR 0085): a Chore, a Provision and a Need
 * are edited where they are peeked — here over the Vault, away from House —
 * through each App's own controls, and the edit lands on the Document.
 */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

/** Make a Document over the Vault and open its Peek. */
async function peekNew(page: Page, doc: Record<string, unknown>) {
  await page.goto("/vault");
  await workLocally(page);
  const id = await inCore(page, async (core, d: Record<string, unknown>) => (await core.putDocument(d as { type: string })).id as string, doc);
  await inCore(page, async (core, docId: string) => core.openPeek(docId), id);
  // The first dialog is the Peek; an open Date picker's popover is a dialog too.
  const dialog = page.getByRole("dialog").first();
  await expect(dialog).toBeVisible();
  return { id, dialog };
}

const field = (page: Page, id: string, key: string) =>
  inCore(page, async (core, a: { id: string; key: string }) => (await core.getDocument(a.id))![a.key], { id, key });

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
  const expires = dialog.getByLabel("Expires (check by)");
  await expect(expires).toHaveText(/No date/);
  await pickDate(page, expires, "2026-12-01");
  await expect.poll(() => field(page, id, "expires")).toBe("2026-12-01");
});

test("a Provision's date is picked from the keyboard in its Peek, and Escape backs out", async ({ page }) => {
  const { id, dialog } = await peekNew(page, {
    type: "provision",
    title: `Beans ${Date.now()}`,
    quantity: 1,
    unit: "",
    minimum: 0,
    expires: "2026-12-01",
    frozenOn: "",
  });
  const expires = dialog.getByLabel("Expires (check by)");
  const calendar = openCalendar(page);

  // Open from the keyboard; focus lands on the stored day, arrows move, Enter picks.
  await expires.focus();
  await page.keyboard.press("Enter");
  await expect(calendar).toBeVisible();
  await expect(calendar.locator('[data-day="2026-12-01"] button')).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(calendar).toBeHidden();
  await expect.poll(() => field(page, id, "expires")).toBe("2026-12-09");
  await expect(expires).toBeFocused();

  // Escape closes the picker, not the Peek, and writes nothing.
  await page.keyboard.press("Enter");
  await expect(calendar).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Escape");
  await expect(calendar).toBeHidden();
  await expect(dialog).toBeVisible();
  await expect.poll(() => field(page, id, "expires")).toBe("2026-12-09");

  // An optional date can be cleared.
  await expires.click();
  await page.locator('[data-slot="popover-content"]').getByRole("button", { name: "Clear" }).click();
  await expect.poll(() => field(page, id, "expires")).toBe("");
  await expect(expires).toHaveText(/No date/);
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
