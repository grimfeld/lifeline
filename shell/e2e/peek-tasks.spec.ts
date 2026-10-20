import { test, expect, type Page } from "@playwright/test";
import { CORE_URL } from "./support/seed";
import { openCalendar, pickDate, pickInCalendar } from "./support/date-picker";

/**
 * Tasks and the Calendar App edit their Documents in a Peek (ADR 0085): each
 * through its own controls, the guarded Fields through its own operations,
 * from wherever the Document was peeked.
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

async function peek(page: Page, id: string) {
  await inCore(page, async (core, docId: string) => core.openPeek(docId), id);
  // The first dialog: a Date picker's popover is a later one.
  return page.getByRole("dialog").first();
}

const field = (page: Page, id: string) => inCore(page, async (core, docId: string) => core.getDocument(docId), id);

test("a Task peeked from the Vault is moved to another day and given notes there", async ({ page }) => {
  const stamp = Date.now();
  await page.goto("/vault");
  await workLocally(page);
  const id = await inCore(
    page,
    async (core, title: string) =>
      (await core.putDocument({ type: "task", title, status: "active", date: "2026-03-02", completedOn: null, recurrence: null, notes: "", tags: [] })).id as string,
    `Call the dentist ${stamp}`,
  );

  const dialog = await peek(page, id);
  await pickDate(page, dialog.getByLabel("Day"), "2026-03-05");
  await dialog.getByLabel("Notes").fill("Ask about the crown");
  await expect.poll(async () => { const d = await field(page, id); return { date: d.date, notes: d.notes }; }).toEqual({ date: "2026-03-05", notes: "Ask about the crown" });

  // The day is optional: Clear puts the Task back in the Unassigned pool, and back.
  await dialog.getByLabel("Day").click();
  await page.getByRole("button", { name: "Clear" }).click();
  await expect(openCalendar(page)).toBeHidden();
  await expect.poll(async () => (await field(page, id)).date).toBeNull();
  await expect(dialog.getByLabel("Day")).toHaveText(/Unassigned/);
  await pickDate(page, dialog.getByLabel("Day"), "2026-03-05");
  await expect.poll(async () => (await field(page, id)).date).toBe("2026-03-05");

  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect.poll(async () => Boolean((await field(page, id)).completedOn)).toBe(true);
  await expect(dialog.getByRole("button", { name: "Not done" })).toBeVisible();
});

test("a Task is moved by tapping a day in the Move dialog, and Cancel backs out", async ({ page }) => {
  const stamp = Date.now();
  const title = `Renew the passport ${stamp}`;
  await page.goto("/app/tasks");
  await workLocally(page);
  const id = await inCore(
    page,
    async (core, t: string) =>
      (await core.putDocument({ type: "task", title: t, status: "active", date: "2026-03-02", completedOn: null, recurrence: null, notes: "", tags: [] })).id as string,
    title,
  );
  const openMove = async () => {
    const row = page.locator("div").filter({ hasText: title, has: page.getByRole("button", { name: "More" }) }).last();
    await row.getByRole("button", { name: "More" }).click();
    await page.getByRole("menuitem", { name: "Move to day…" }).click();
    const dialog = page.getByRole("dialog", { name: `Move "${title}"` });
    await expect(dialog).toBeVisible();
    return dialog;
  };

  // Cancel backs out with the day unchanged.
  let dialog = await openMove();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  expect((await field(page, id)).date).toBe("2026-03-02");

  // The calendar sits in the dialog itself: no native date input, no Move button.
  dialog = await openMove();
  await expect(dialog.locator('input[type="date"]')).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Move", exact: true })).toHaveCount(0);
  await pickInCalendar(dialog.locator('[data-slot="calendar"]'), "2026-03-09");
  await expect(dialog).toBeHidden();
  await expect(page.getByText(/Moved to .*(9 Mar|Mar 9)/)).toBeVisible();
  await expect.poll(async () => (await field(page, id)).date).toBe("2026-03-09");
});

test("an Event peeked from the Vault gets a time there, and an end before its start is refused", async ({ page }) => {
  const stamp = Date.now();
  await page.goto("/vault");
  await workLocally(page);
  const id = await inCore(
    page,
    async (core, title: string) =>
      (await core.putDocument({ type: "event", title, date: "2026-03-02", endDate: null, start: null, end: null, notes: "", tags: [] })).id as string,
    `Standup ${stamp}`,
  );

  const dialog = await peek(page, id);
  await dialog.getByRole("checkbox", { name: "All day" }).click();
  await dialog.getByLabel("Start").fill("10:30");
  await dialog.getByLabel("End").fill("11:00");
  await expect.poll(async () => { const d = await field(page, id); return { date: d.date, start: d.start, end: d.end }; }).toEqual({ date: "2026-03-02", start: "10:30", end: "11:00" });

  await dialog.getByLabel("End").fill("09:00");
  await expect(dialog.getByText("End must be after start")).toBeVisible();
  await page.waitForTimeout(800);
  expect((await field(page, id)).end).toBe("11:00");
});
