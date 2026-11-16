import { test, expect, type Page } from "@playwright/test";
import { CORE_URL } from "./support/seed";
import { setTime } from "./support/time-field";

/**
 * The Schedule and Month by keyboard (#284): an item that takes the focus
 * opens on Enter and moves on the arrow keys, and the focus stays on it.
 * An Event opens its Peek (#536), and closing a Peek that changed its timing
 * leaves one Undo; so do a Task's or a Chore's block (#537), a blocker band and
 * another App's item (#538); an iCal item shows a read-only card. Mon 9 Nov 2026's week, an Event on the Tuesday at 10:00–11:00.
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

// --- a Time blocker band and other Apps' Timed items open their Peek; an iCal item, a read-only card (#538) ---

/** A one-off Time blocker on the Tuesday, 08:00–09:00. */
async function addBlocker(page: Page, title: string): Promise<string> {
  await page.goto("/calendar?view=week&d=2026-11-09");
  await workLocally(page);
  return page.evaluate(
    async ({ coreUrl, title }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      return (await core.putDocument({ type: "time_blocker", title, date: "2026-11-10", endDate: "2026-11-10", weekdays: [], start: "08:00", end: "09:00", color: null, active: true, tags: [] })).id as string;
    },
    { coreUrl: CORE_URL, title },
  );
}

const storedBlocker = (page: Page, title: string) =>
  page.evaluate(
    async ({ coreUrl, title }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      const b = (await core.documentsOf("time_blocker")).find((d: { title: string }) => d.title === title);
      return b ? { date: b.date, start: b.start, end: b.end } : null;
    },
    { coreUrl: CORE_URL, title },
  );

test("a Time blocker band opens its Peek with its timing; closing leaves one Undo, and the focus on the band", async ({ page }) => {
  const title = `Deep work ${Date.now()}`;
  await addBlocker(page, title);
  const band = page.locator('[data-col="2026-11-10"]').getByLabel(title, { exact: false });
  await band.focus();
  await page.keyboard.press("Enter");
  const peek = page.getByRole("dialog", { name: title, exact: true });
  const timing = peek.getByRole("region", { name: "Timing" });
  await expect(timing.getByRole("combobox", { name: "Start" })).toHaveValue("08:00");
  await expect(timing.getByLabel("All day"), "a band has hours").toHaveCount(0);

  await timing.getByRole("button", { name: "15 minutes later" }).click();
  await expect.poll(() => storedBlocker(page, title)).toEqual({ date: "2026-11-10", start: "08:15", end: "09:15" });
  await page.keyboard.press("Escape");
  await expect(peek).toBeHidden();
  await expect(band, "the focus is back on the band").toBeFocused();

  const toast = page.locator("[data-sonner-toast]", { hasText: `${title} updated` });
  await expect(toast, "one Undo for the whole visit").toHaveCount(1);
  await toast.getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => storedBlocker(page, title)).toEqual({ date: "2026-11-10", start: "08:00", end: "09:00" });
});

test("Delete blocker in its Peek acts at once, with its own Undo", async ({ page }) => {
  const title = `Commute ${Date.now()}`;
  await addBlocker(page, title);
  await page.locator('[data-col="2026-11-10"]').getByLabel(title, { exact: false }).click();
  const peek = page.getByRole("dialog", { name: title, exact: true });
  await peek.getByRole("region", { name: "Timing" }).getByRole("button", { name: "Delete blocker" }).click();
  await expect(peek).toBeHidden();
  await expect.poll(() => storedBlocker(page, title)).toBeNull();
  await page.locator("[data-sonner-toast]", { hasText: `${title} deleted` }).getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => storedBlocker(page, title)).toEqual({ date: "2026-11-10", start: "08:00", end: "09:00" });
});

test("another App's Timed item its App does not move opens its Peek with its timing read-only", async ({ page }) => {
  const title = `Rowing ${Date.now()}`;
  await page.goto("/calendar?view=week&d=2026-11-09");
  await workLocally(page);
  const sessionTitle = await page.evaluate(
    async ({ coreUrl, title }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      const w = await core.putDocument({ type: "workout", title, blocks: [], tallies: [] });
      const s = await core.putDocument({ type: "workout_session", title: `${title} · 2026-11-10`, workoutId: w.id, startedAt: "2026-11-10T09:00:00.000Z", endedAt: "2026-11-10T09:40:00.000Z", date: "2026-11-10", start: "09:00", end: "09:40", durationMin: 40, results: [], notes: "" });
      return s.title as string;
    },
    { coreUrl: CORE_URL, title },
  );
  await page.locator('[data-col="2026-11-10"] [data-focus-key]').filter({ hasText: title }).first().click();
  const peek = page.getByRole("dialog", { name: sessionTitle, exact: true });
  const timing = peek.getByRole("region", { name: "Timing" });
  await expect(timing.getByText(/can't be moved from here/)).toBeVisible();
  await expect(timing.getByRole("combobox", { name: "Start" })).toHaveCount(0);
  await expect(timing.getByRole("button", { name: "15 minutes later" })).toHaveCount(0);
  await expect(timing.getByRole("button", { name: /^Delete/ })).toHaveCount(0);
});

test("an iCal subscription's item shows a read-only card with nothing to edit", async ({ page }) => {
  const title = `Team standup ${Date.now()}`;
  await page.goto("/calendar?view=week&d=2026-11-09");
  await workLocally(page);
  await page.evaluate(
    async ({ coreUrl, title }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      const id = core.newId() as string;
      const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//e2e//EN", "BEGIN:VEVENT", `UID:${id}@e2e`, "DTSTAMP:20261101T000000", "DTSTART:20261110T110000", "DTEND:20261110T113000", `SUMMARY:${title}`, "LOCATION:Room 4", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
      const fetchedAt = new Date().toISOString();
      // Cached first, as if just fetched: the subscription's URL is never reached.
      await core.db().collection("_source_cache").put({ id, updatedAt: fetchedAt, deleted: 0, fetchedAt, ok: true, status: 200, contentType: "text/calendar", body });
      await core.putDocument({ id, type: "window", kind: "ical", title: "Work calendar", url: "https://example.invalid/work.ics", refreshMinutes: 1440, color: "blue", tags: [] });
    },
    { coreUrl: CORE_URL, title },
  );
  const item = page.locator('[data-col="2026-11-10"] [data-focus-key]').filter({ hasText: title }).first();
  await item.focus();
  await page.keyboard.press("Enter");
  const card = page.getByRole("dialog", { name: title, exact: true });
  await expect(card).toBeVisible();
  await expect(card.getByText(/11:00/)).toBeVisible();
  await expect(card.getByText("Room 4")).toBeVisible();
  await expect(card.getByText(/From Work calendar · read-only/)).toBeVisible();
  await expect(card.getByRole("textbox")).toHaveCount(0);
  await expect(card.getByRole("combobox")).toHaveCount(0);
  await expect(card.getByRole("button")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(card).toBeHidden();
  await expect(item, "the focus is back on the item").toBeFocused();
});

test("a Chore's Time block opens the Chore's Peek with the block's timing", async ({ page }) => {
  const title = `Mop the floor ${Date.now()}`;
  await page.goto("/calendar?view=week&d=2026-11-09");
  await workLocally(page);
  await page.evaluate(
    async ({ coreUrl, title }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      const chore = await core.putDocument({ type: "chore", title, status: "active", schedule: { kind: "weekly", weekdays: [2] }, anchorDate: null, tags: [] });
      await core.addTimeBlock("chores", chore.id, "2026-11-10", { start: "16:00", end: "16:30" });
    },
    { coreUrl: CORE_URL, title },
  );
  await page.locator('[data-col="2026-11-10"] [data-focus-key]').filter({ hasText: title }).first().click();
  const peek = page.getByRole("dialog", { name: title, exact: true });
  const timing = peek.getByRole("region", { name: "Time block" });
  await expect(timing.getByRole("combobox", { name: "Start" })).toHaveValue("16:00");
  await expect(peek.getByRole("combobox", { name: "Schedule" }), "the Chore's own Fields are there").toBeVisible();
});
