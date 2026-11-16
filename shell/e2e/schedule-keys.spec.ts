import { test, expect, type Page } from "@playwright/test";
import { CORE_URL } from "./support/seed";
import { setTime } from "./support/time-field";

/**
 * The Schedule and Month by keyboard (#284): an item that takes the focus
 * opens on Enter and moves on the arrow keys, and the focus stays on it.
 * An Event opens its Peek (#536), and closing a Peek that changed its timing
 * leaves one Undo. Mon 9 Nov 2026's week, an Event on the Tuesday at 10:00–11:00.
 */

test.skip(({ isMobile }) => isMobile, "keyboard cases: the desk");

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

const storedEvent = (page: Page, title: string) =>
  page.evaluate(
    async ({ coreUrl, title }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      const ev = (await core.documentsOf("event")).find((d: { title: string }) => d.title === title);
      return ev ? { date: ev.date, start: ev.start, end: ev.end } : null;
    },
    { coreUrl: CORE_URL, title },
  );

async function addEvent(page: Page, title: string): Promise<string> {
  await page.goto("/calendar?view=week&d=2026-11-09");
  await workLocally(page);
  return page.evaluate(
    async ({ coreUrl, title }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      return (await core.putDocument({ type: "event", title, notes: "", date: "2026-11-10", endDate: null, start: "10:00", end: "11:00", tags: [] })).id as string;
    },
    { coreUrl: CORE_URL, title },
  );
}

/** The Event's Peek: the Calendar's Form, editing, with every Field. */
async function expectEventPeek(page: Page, title: string) {
  const peek = page.getByRole("dialog", { name: title, exact: true });
  await expect(peek).toBeVisible();
  await expect(peek.getByRole("combobox", { name: "Start" })).toBeVisible();
  await expect(peek.getByText("Notes", { exact: true })).toBeVisible();
  await expect(peek.getByText("With", { exact: true })).toBeVisible();
  await expect(peek.getByText("Tags", { exact: true })).toBeVisible();
  return peek;
}

test("an Event on the hours opens on Enter, hands the focus back on close, and moves on the arrow keys", async ({ page }) => {
  const title = `Dentist ${Date.now()}`;
  await addEvent(page, title);
  const item = page.locator("[data-focus-key]", { hasText: title });
  await expect(page.locator('[data-col="2026-11-10"]').getByText(title)).toBeVisible();
  await expect(item).toHaveAccessibleDescription(/Enter to open it/);

  await item.focus();
  await page.keyboard.press("Enter");
  const peek = await expectEventPeek(page, title);
  await page.keyboard.press("Escape");
  await expect(peek).toBeHidden();
  await expect(page.getByText(`${title} updated`), "nothing changed: no Undo").toHaveCount(0);
  await expect(item, "the focus is back on the Event").toBeFocused();

  await page.keyboard.press("ArrowDown");
  await expect.poll(() => storedEvent(page, title)).toEqual({ date: "2026-11-10", start: "10:15", end: "11:15" });
  await page.keyboard.press("Shift+ArrowUp");
  await expect.poll(() => storedEvent(page, title)).toEqual({ date: "2026-11-10", start: "09:15", end: "10:15" });

  await page.keyboard.press("ArrowRight");
  await expect.poll(() => storedEvent(page, title)).toEqual({ date: "2026-11-11", start: "09:15", end: "10:15" });
  await expect(page.locator('[data-col="2026-11-11"]').getByText(title)).toBeVisible();
  await expect(item, "the focus follows it into Wednesday").toBeFocused();
});

test("an Event on the Month opens on Enter and moves a week on the down arrow", async ({ page }) => {
  const title = `Recital ${Date.now()}`;
  await addEvent(page, title);
  await page.goto("/calendar?view=month&d=2026-11-09");
  await workLocally(page);
  const item = page.locator("[data-focus-key]", { hasText: title });

  await item.focus();
  await page.keyboard.press("Enter");
  const peek = await expectEventPeek(page, title);
  await page.keyboard.press("Escape");
  await expect(peek).toBeHidden();
  await expect(item).toBeFocused();

  await page.keyboard.press("ArrowDown");
  await expect.poll(() => storedEvent(page, title)).toEqual({ date: "2026-11-17", start: "10:00", end: "11:00" });
  await expect(item).toBeFocused();
});

test("an Event clicked on the hours is retimed in its Peek; closing leaves one Undo that puts it back, and the focus on it", async ({ page }) => {
  const title = `Physio ${Date.now()}`;
  await addEvent(page, title);
  const item = page.locator("[data-focus-key]", { hasText: title });
  await item.click();
  const peek = await expectEventPeek(page, title);

  await peek.getByRole("button", { name: "15 minutes later" }).click();
  await peek.getByRole("button", { name: "15 minutes later" }).click();
  await expect.poll(() => storedEvent(page, title)).toEqual({ date: "2026-11-10", start: "10:30", end: "11:30" });
  await page.keyboard.press("Escape");
  await expect(peek).toBeHidden();
  await expect(item, "the focus is back on the Event").toBeFocused();

  const toast = page.locator("[data-sonner-toast]", { hasText: `${title} updated` });
  await expect(toast, "one Undo for the whole visit").toHaveCount(1);
  await toast.getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => storedEvent(page, title)).toEqual({ date: "2026-11-10", start: "10:00", end: "11:00" });
});

test("an Event in Upcoming opens its Peek", async ({ page }) => {
  const title = `Upcoming dentist ${Date.now()}`;
  await addEvent(page, title);
  await page.goto("/calendar?view=upcoming&d=2026-11-09");
  await workLocally(page);
  await page.getByRole("button", { name: title, exact: true }).click();
  await expectEventPeek(page, title);
});

test("a Peek opened from the Vault leaves the same timing Undo on close", async ({ page }) => {
  const title = `Vault concert ${Date.now()}`;
  const id = await addEvent(page, title);
  await page.goto("/vault");
  await workLocally(page);
  await page.evaluate(
    async ({ coreUrl, id }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      core.openPeek(id);
    },
    { coreUrl: CORE_URL, id },
  );
  const peek = await expectEventPeek(page, title);
  await peek.getByRole("button", { name: "15 minutes earlier" }).click();
  await expect.poll(() => storedEvent(page, title)).toEqual({ date: "2026-11-10", start: "09:45", end: "10:45" });
  await peek.getByRole("button", { name: "Close" }).click();
  const toast = page.locator("[data-sonner-toast]", { hasText: `${title} updated` });
  await toast.getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => storedEvent(page, title)).toEqual({ date: "2026-11-10", start: "10:00", end: "11:00" });
});

test("deleting an Event from its Peek acts at once, with its own Undo", async ({ page }) => {
  const title = `Cancelled ${Date.now()}`;
  await addEvent(page, title);
  await page.locator("[data-focus-key]", { hasText: title }).click();
  const peek = await expectEventPeek(page, title);
  await peek.getByRole("button", { name: "Delete event" }).click();
  await expect(peek).toBeHidden();
  await expect.poll(() => storedEvent(page, title)).toBeNull();
  await page.locator("[data-sonner-toast]", { hasText: `${title} deleted` }).getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => storedEvent(page, title)).toEqual({ date: "2026-11-10", start: "10:00", end: "11:00" });
});

// --- a Task's Time block and untimed chip open the Task's Peek (#537) ---

/** A Task on the Tuesday, with a Time block 14:00–15:00 that day unless `block` is false; `done` makes it record. */
async function addTask(page: Page, title: string, { block = true, done = false } = {}): Promise<string> {
  await page.goto("/calendar?view=week&d=2026-11-09");
  await workLocally(page);
  return page.evaluate(
    async ({ coreUrl, title, block, done }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      const task = await core.putDocument({ type: "task", title, status: "active", date: "2026-11-10", completedOn: done ? "2026-11-10" : null, recurrence: null, notes: "", tags: [], estimate: 45 });
      if (block) await core.addTimeBlock("tasks", task.id, "2026-11-10", { start: "14:00", end: "15:00" });
      return task.id as string;
    },
    { coreUrl: CORE_URL, title, block, done },
  );
}

/** The Task's Time blocks, live (removed ones left out). */
const storedBlocks = (page: Page, taskId: string) =>
  page.evaluate(
    async ({ coreUrl, taskId }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      const rows: { itemId: string; date: string; start: string | null; end: string | null }[] = await core.all("placements");
      return rows.filter((p) => p.itemId === taskId && p.start).map((p) => ({ date: p.date, start: p.start, end: p.end }));
    },
    { coreUrl: CORE_URL, taskId },
  );

/** The Task's Peek, with the timing section of what was tapped above its Form. */
async function expectTaskPeek(page: Page, title: string) {
  const peek = page.getByRole("dialog", { name: title, exact: true });
  await expect(peek).toBeVisible();
  await expect(peek.getByText("Estimate", { exact: true }), "the Task's own Fields are there").toBeVisible();
  return { peek, timing: peek.getByRole("region", { name: "Time block" }) };
}

test("a Task's Time block opens the Task's Peek with the block's timing; closing leaves one Undo that puts the block back", async ({ page }) => {
  const title = `Write report ${Date.now()}`;
  const id = await addTask(page, title);
  const block = page.locator('[data-col="2026-11-10"] [data-focus-key]').filter({ hasText: title }).first();
  await block.focus();
  await page.keyboard.press("Enter");
  const { peek, timing } = await expectTaskPeek(page, title);
  await expect(timing.getByRole("combobox", { name: "Start" })).toHaveValue("14:00");
  await expect(timing.getByText("Ends 15:00")).toBeVisible();

  await timing.getByRole("button", { name: "15 minutes later" }).click();
  await timing.getByRole("group", { name: "Length" }).getByRole("button", { name: "2h", exact: true }).click();
  await expect.poll(() => storedBlocks(page, id)).toEqual([{ date: "2026-11-10", start: "14:15", end: "16:15" }]);
  await page.keyboard.press("Escape");
  await expect(peek).toBeHidden();

  const toast = page.locator("[data-sonner-toast]", { hasText: `${title} updated` });
  await expect(toast, "one Undo for the whole visit").toHaveCount(1);
  await toast.getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => storedBlocks(page, id)).toEqual([{ date: "2026-11-10", start: "14:00", end: "15:00" }]);
});

test("Remove block in a Task's Peek keeps the Task and its chip, with its own Undo", async ({ page }) => {
  const title = `Tidy inbox ${Date.now()}`;
  const id = await addTask(page, title);
  await page.locator('[data-col="2026-11-10"] [data-focus-key]').filter({ hasText: title }).first().click();
  const { peek, timing } = await expectTaskPeek(page, title);
  await timing.getByRole("button", { name: "Remove block" }).click();
  await expect.poll(() => storedBlocks(page, id)).toEqual([]);
  await expect(peek.getByRole("region", { name: "Time block" }).getByText("Give it a time")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-focus-key]", { hasText: title }), "the Task's chip stays on its day").toHaveCount(1);
  await expect(page.getByText(`${title} updated`), "removal is not a timing change").toHaveCount(0);
  await page.locator("[data-sonner-toast]", { hasText: "Block removed" }).getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => storedBlocks(page, id)).toEqual([{ date: "2026-11-10", start: "14:00", end: "15:00" }]);
});

test("a done Task's block is record in its Peek: removable, never retimed", async ({ page }) => {
  const title = `Filed taxes ${Date.now()}`;
  await addTask(page, title, { done: true });
  await page.locator('[data-col="2026-11-10"] [data-focus-key]').filter({ hasText: title }).first().click();
  const { timing } = await expectTaskPeek(page, title);
  await expect(timing.getByText(/done, kept as record/)).toBeVisible();
  await expect(timing.getByRole("combobox", { name: "Start" })).toHaveCount(0);
  await expect(timing.getByRole("button", { name: "15 minutes later" })).toHaveCount(0);
  await expect(timing.getByRole("button", { name: "Remove block" })).toBeVisible();
});

test("a Task's untimed chip opens its Peek and is given a time there, making a block and keeping the chip", async ({ page }) => {
  const title = `Call the bank ${Date.now()}`;
  const id = await addTask(page, title, { block: false });
  const chip = page.locator("[data-focus-key]").filter({ hasText: title }).first();
  await chip.click();
  const { peek, timing } = await expectTaskPeek(page, title);
  await expect(timing.getByText("Give it a time")).toBeVisible();
  await setTime(timing.getByRole("combobox", { name: "Start" }), "09:30");
  await expect.poll(() => storedBlocks(page, id), "the Estimate is its length").toEqual([{ date: "2026-11-10", start: "09:30", end: "10:15" }]);
  await expect(timing.getByRole("button", { name: "Remove block" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(peek).toBeHidden();
  await expect(page.locator("[data-focus-key]", { hasText: title }), "the chip and the new block").toHaveCount(2);

  await page.locator("[data-sonner-toast]", { hasText: `${title} updated` }).getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => storedBlocks(page, id)).toEqual([]);
});

test("a Task peeked from anywhere but the hours shows no timing section", async ({ page }) => {
  const title = `Vault task ${Date.now()}`;
  const id = await addTask(page, title);
  await page.goto("/vault");
  await workLocally(page);
  await page.evaluate(
    async ({ coreUrl, id }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      core.openPeek(id);
    },
    { coreUrl: CORE_URL, id },
  );
  const { timing } = await expectTaskPeek(page, title);
  await expect(timing).toHaveCount(0);
});
