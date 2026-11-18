import { test, expect, type Page } from "@playwright/test";
import { CORE_URL } from "./support/seed";
import { setTime } from "./support/time-field";
import { pickDate } from "./support/date-picker";

/**
 * The Schedule and Month by keyboard (#284): an item that takes the focus
 * opens on Enter and moves on the arrow keys, and the focus stays on it.
 * An Event opens its Peek (#536), and closing a Peek that changed its timing
 * leaves one Undo; so do a Task's block (#537), a blocker band (#538) and a
 * Project's Deadline; another App's item and an iCal item open read-only.
 * One case per place a Peek opens from and per kind of timing; a Chore's
 * block peeks through the same path as a Task's (its `peekOf`:
 * schedulable.test.ts). Mon 9 Nov 2026's week, an Event on the Tuesday at 10:00–11:00.
 */

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

test("an Event in Upcoming opens its Peek on a click and on Enter, and closing hands the focus back to its row", async ({ page }) => {
  const title = `Upcoming dentist ${Date.now()}`;
  await addEvent(page, title);
  await page.goto("/calendar?view=upcoming&d=2026-11-09");
  await workLocally(page);
  const row = page.getByRole("button", { name: title, exact: true });
  await row.click();
  let peek = await expectEventPeek(page, title);
  await page.keyboard.press("Escape");
  await expect(peek).toBeHidden();
  await expect(row, "the focus is back on the row").toBeFocused();

  await page.keyboard.press("Enter");
  peek = await expectEventPeek(page, title);
  await page.keyboard.press("Escape");
  await expect(peek).toBeHidden();
  await expect(row).toBeFocused();
});

/** Today's Event, 10:00–11:00, and the Screen with every Card on it, Today's agenda among them. */
async function agendaWithEvent(page: Page, title: string) {
  await page.goto("/screen/e2elongcontent1");
  await workLocally(page);
  await page.evaluate(
    async ({ coreUrl, title }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      await core.putDocument({ type: "event", title, notes: "", date: core.todayStr(), endDate: null, start: "10:00", end: "11:00", tags: [] });
    },
    { coreUrl: CORE_URL, title },
  );
  const card = page.locator('[data-slot="card"]').filter({ has: page.getByText("Today's agenda", { exact: true }) });
  return card.getByRole("button").filter({ hasText: title });
}

test("an Event on the Agenda Card opens its Peek on a click and on Enter, and closing hands the focus back to it", async ({ page }) => {
  const title = `Agenda dentist ${Date.now()}`;
  const item = await agendaWithEvent(page, title);
  await item.click();
  let peek = await expectEventPeek(page, title);
  await page.keyboard.press("Escape");
  await expect(peek).toBeHidden();
  await expect(item, "the focus is back on the Event").toBeFocused();

  await page.keyboard.press("Enter");
  peek = await expectEventPeek(page, title);
  await page.keyboard.press("Escape");
  await expect(peek).toBeHidden();
  await expect(item).toBeFocused();
});

test("deleting an Event from its Peek acts at once, with its own Undo that brings back the Notes typed just before", async ({ page }) => {
  const title = `Cancelled ${Date.now()}`;
  await addEvent(page, title);
  await page.locator("[data-focus-key]", { hasText: title }).click();
  const peek = await expectEventPeek(page, title);
  await peek.getByLabel("Notes").fill("Bring the slides");
  await peek.getByRole("button", { name: "Delete event" }).click();
  await expect(peek).toBeHidden();
  await expect.poll(() => storedEvent(page, title)).toBeNull();
  await page.locator("[data-sonner-toast]", { hasText: `${title} deleted` }).getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => storedEvent(page, title)).toEqual({ date: "2026-11-10", start: "10:00", end: "11:00" });
  await expect
    .poll(() =>
      page.evaluate(
        async ({ coreUrl, title }) => {
          const core = await import(/* @vite-ignore */ coreUrl);
          return (await core.documentsOf("event")).find((d: { title: string }) => d.title === title)?.notes ?? null;
        },
        { coreUrl: CORE_URL, title },
      ),
    )
    .toBe("Bring the slides");
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

test("a Task's Time block opens the Task's Peek with the block's timing; closing leaves one Undo that puts the block back; peeked elsewhere, it has no timing", async ({ page }) => {
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

  // Peeked from anywhere but the hours, the Task shows no timing section.
  await page.goto("/vault");
  await workLocally(page);
  await page.evaluate(
    async ({ coreUrl, id }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      core.openPeek(id);
    },
    { coreUrl: CORE_URL, id },
  );
  await expect((await expectTaskPeek(page, title)).timing).toHaveCount(0);
});

test("Remove block in a Task's Peek keeps the Task and its chip, with its own Undo; a done Task's block is record, removable but never retimed", async ({ page }) => {
  const title = `Tidy inbox ${Date.now()}`;
  const filed = `Filed taxes ${Date.now()}`;
  const id = await addTask(page, title);
  await addTask(page, filed, { done: true });
  await page.locator('[data-col="2026-11-10"] [data-focus-key]').filter({ hasText: filed }).first().click();
  let { peek, timing } = await expectTaskPeek(page, filed);
  await expect(timing.getByText(/done, kept as record/)).toBeVisible();
  await expect(timing.getByRole("combobox", { name: "Start" })).toHaveCount(0);
  await expect(timing.getByRole("button", { name: "15 minutes later" })).toHaveCount(0);
  await expect(timing.getByRole("button", { name: "Remove block" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(peek).toBeHidden();

  await page.locator('[data-col="2026-11-10"] [data-focus-key]').filter({ hasText: title }).first().click();
  ({ peek, timing } = await expectTaskPeek(page, title));
  await timing.getByRole("button", { name: "Remove block" }).click();
  await expect.poll(() => storedBlocks(page, id)).toEqual([]);
  await expect(peek.getByRole("region", { name: "Time block" }).getByText("Give it a time")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-focus-key]", { hasText: title }), "the Task's chip stays on its day").toHaveCount(1);
  await expect(page.getByText(`${title} updated`), "removal is not a timing change").toHaveCount(0);
  await page.locator("[data-sonner-toast]", { hasText: "Block removed" }).getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => storedBlocks(page, id)).toEqual([{ date: "2026-11-10", start: "14:00", end: "15:00" }]);
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

test("a Project's Deadline opens the Project's Peek, its Deadline field the one timing; closing leaves one Undo", async ({ page }) => {
  const title = `Launch ${Date.now()}`;
  await page.goto("/calendar?view=week&d=2026-11-09");
  await workLocally(page);
  const id: string = await page.evaluate(
    async ({ coreUrl, title }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      return (await core.putDocument({ type: "project", title, body: "", stage: "active", start: null, deadline: "2026-11-10" })).id as string;
    },
    { coreUrl: CORE_URL, title },
  );
  const deadline = () =>
    page.evaluate(
      async ({ coreUrl, id }) => {
        const core = await import(/* @vite-ignore */ coreUrl);
        return ((await core.getDocument(id)) as { deadline: string | null }).deadline;
      },
      { coreUrl: CORE_URL, id },
    );
  await page.locator("[data-focus-key]").filter({ hasText: title }).first().click();
  const peek = page.getByRole("dialog", { name: title, exact: true });
  await expect(peek.getByRole("region", { name: "Timing" }), "the Project's own Deadline field is its timing (ADR 0124)").toHaveCount(0);

  await pickDate(page, peek.getByRole("button", { name: "Deadline", exact: true }), "2026-11-12");
  await expect.poll(deadline).toBe("2026-11-12");
  await pickDate(page, peek.getByRole("button", { name: "Deadline", exact: true }), "2026-11-13");
  await expect.poll(deadline).toBe("2026-11-13");
  await page.keyboard.press("Escape");
  await expect(peek).toBeHidden();
  const undo = page.locator("[data-sonner-toast]").getByRole("button", { name: "Undo" });
  await expect(undo, "one Undo for the visit").toHaveCount(1);
  await undo.click();
  await expect.poll(deadline).toBe("2026-11-10");
});

test("another App's Timed item its App does not move, and an iCal subscription's item, open read-only", async ({ page }) => {
  const title = `Rowing ${Date.now()}`;
  const standup = `Team standup ${Date.now()}`;
  await page.goto("/calendar?view=week&d=2026-11-09");
  await workLocally(page);
  const sessionTitle = await page.evaluate(
    async ({ coreUrl, title, standup }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      const w = await core.putDocument({ type: "workout", title, blocks: [], tallies: [] });
      const s = await core.putDocument({ type: "workout_session", title: `${title} · 2026-11-10`, workoutId: w.id, startedAt: "2026-11-10T09:00:00.000Z", endedAt: "2026-11-10T09:40:00.000Z", date: "2026-11-10", start: "09:00", end: "09:40", durationMin: 40, results: [], notes: "" });
      const id = core.newId() as string;
      const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//e2e//EN", "BEGIN:VEVENT", `UID:${id}@e2e`, "DTSTAMP:20261101T000000", "DTSTART:20261110T110000", "DTEND:20261110T113000", `SUMMARY:${standup}`, "LOCATION:Room 4", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
      const fetchedAt = new Date().toISOString();
      // Cached first, as if just fetched: the subscription's URL is never reached.
      await core.db().collection("_source_cache").put({ id, updatedAt: fetchedAt, deleted: 0, fetchedAt, ok: true, status: 200, contentType: "text/calendar", body });
      await core.putDocument({ id, type: "window", kind: "ical", title: "Work calendar", url: "https://example.invalid/work.ics", refreshMinutes: 1440, color: "blue", tags: [] });
      return s.title as string;
    },
    { coreUrl: CORE_URL, title, standup },
  );

  // Another App's item: its Peek, the timing read-only.
  await page.locator('[data-col="2026-11-10"] [data-focus-key]').filter({ hasText: title }).first().click();
  const peek = page.getByRole("dialog", { name: sessionTitle, exact: true });
  const timing = peek.getByRole("region", { name: "Timing" });
  await expect(timing.getByText(/can't be moved from here/)).toBeVisible();
  await expect(timing.getByRole("combobox", { name: "Start" })).toHaveCount(0);
  await expect(timing.getByRole("button", { name: "15 minutes later" })).toHaveCount(0);
  await expect(timing.getByRole("button", { name: /^Delete/ })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(peek).toBeHidden();

  // An iCal item: a read-only card with nothing to edit, the focus back on it once closed.
  const item = page.locator('[data-col="2026-11-10"] [data-focus-key]').filter({ hasText: standup }).first();
  await item.focus();
  await page.keyboard.press("Enter");
  const card = page.getByRole("dialog", { name: standup, exact: true });
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

// --- a work chip on Month and Upcoming opens its Peek; the menu stays on a right-click (#540) ---

test("a Task's chip in the Month and in Upcoming opens its Peek with the Time block section, on a click and on Enter; Push and Move stay on its menu", async ({ page }) => {
  const title = `Chip ${Date.now()}`;
  await addTask(page, title, { block: false });

  // The Month, on a click; its menu keeps Push and Move.
  await page.goto("/calendar?view=month&d=2026-11-09");
  await workLocally(page);
  const chip = page.locator("[data-focus-key]", { hasText: title });
  await chip.click();
  let { peek, timing } = await expectTaskPeek(page, title);
  await expect(timing.getByText("Give it a time")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(peek).toBeHidden();
  await chip.click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "Push" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Move to day…" })).toBeVisible();
  await page.keyboard.press("Escape");

  // Upcoming, on Enter.
  await page.goto("/calendar?view=upcoming&d=2026-11-09");
  await workLocally(page);
  const row = page.getByRole("button", { name: title, exact: true });
  await row.focus();
  await page.keyboard.press("Enter");
  ({ peek, timing } = await expectTaskPeek(page, title));
  await expect(timing).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(peek).toBeHidden();
});
