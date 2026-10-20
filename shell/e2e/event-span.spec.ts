import { test, expect, type Page } from "@playwright/test";
import { CORE_URL } from "./support/seed";
import { pickDate } from "./support/date-picker";
import { setTime } from "./support/time-field";

/**
 * A timed Event runs from a start to an end on any day (ADR 0090): an End
 * earlier than the Start is the next day's, and the Event shows on every day
 * it covers.
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
      return ev ? { date: ev.date, endDate: ev.endDate, start: ev.start, end: ev.end } : null;
    },
    { coreUrl: CORE_URL, title },
  );

async function openAddEvent(page: Page) {
  await page.goto("/app/events");
  await workLocally(page);
  await page.keyboard.press("ControlOrMeta+k");
  await page.getByPlaceholder("Type a command or search…").fill("Add event");
  await page.getByRole("option", { name: "Add event Calendar", exact: true }).click();
  return page.getByRole("dialog", { name: "New event" });
}

test("the dialog rolls 22:00 → 06:00 to the next day, and the Event shows on both days in the Week view and in Upcoming", async ({ page }) => {
  const title = `Night flight ${Date.now()}`;
  const dialog = await openAddEvent(page);
  await dialog.getByLabel("Title").fill(title);
  // Mon 9 Nov 2026.
  await pickDate(page, dialog.getByLabel("Day", { exact: true }), "2026-11-09");
  await setTime(dialog.getByRole("combobox", { name: "Start" }), "22:00");
  await setTime(dialog.getByRole("combobox", { name: "End" }), "06:00");
  await expect(dialog.getByText(/^until Tue.* · 8h$/), "the end day shows beside the End").toBeVisible();
  await dialog.getByRole("button", { name: "Add event" }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => storedEvent(page, title)).toEqual({ date: "2026-11-09", endDate: "2026-11-10", start: "22:00", end: "06:00" });

  await page.goto("/calendar?view=week&d=2026-11-09");
  await workLocally(page);
  const monday = page.locator('[data-col="2026-11-09"]');
  const tuesday = page.locator('[data-col="2026-11-10"]');
  await expect(monday.getByText(title)).toBeVisible();
  await expect(tuesday.getByText(title)).toBeVisible();
  // The cut edges say where it carries on.
  await expect(monday.getByText(/^↓ Tue /)).toBeAttached();
  await expect(tuesday.getByText(/^↑ from Mon /)).toBeAttached();

  // Tapping the next day's piece opens the whole Event, from its start.
  await tuesday.getByText(title).click();
  await expect(page.getByText(/^until Tue.* · 8h$/)).toBeVisible();
  await page.keyboard.press("Escape");

  await page.goto("/calendar?view=upcoming&d=2026-11-09");
  await workLocally(page);
  const rows = page.getByRole("button", { name: title, exact: true });
  await expect(rows).toHaveCount(2);
  // A row's lead sits beside its button: the first day reads the whole span, the next where it ends.
  await expect(rows.first().locator("..")).toContainText(/– Tue/);
  await expect(rows.nth(1).locator("..")).toContainText("→");
});

test('"Ends another day" sets a conference from Monday 09:00 to Wednesday 17:00', async ({ page }) => {
  const title = `Conference ${Date.now()}`;
  const dialog = await openAddEvent(page);
  await dialog.getByLabel("Title").fill(title);
  await pickDate(page, dialog.getByLabel("Day", { exact: true }), "2026-11-09");
  await setTime(dialog.getByRole("combobox", { name: "Start" }), "09:00");
  await dialog.getByRole("button", { name: "Ends another day" }).click();
  await pickDate(page, dialog.getByLabel("End day"), "2026-11-11");
  await setTime(dialog.getByRole("combobox", { name: "End" }), "17:00");
  await expect(dialog.getByText(/^until Wed.* · 2d 8h$/)).toBeVisible();
  await dialog.getByRole("button", { name: "Add event" }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => storedEvent(page, title)).toEqual({ date: "2026-11-09", endDate: "2026-11-11", start: "09:00", end: "17:00" });
});

/** An Event put straight into the store, for the Schedule to show. */
const seedEvent = (page: Page, ev: { title: string; date: string; endDate: string | null; start: string; end: string }) =>
  page.evaluate(
    async ({ coreUrl, ev }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      await core.putDocument({ type: "event", notes: "", tags: [], ...ev });
    },
    { coreUrl: CORE_URL, ev },
  );

/** The Week of Mon 9 Nov 2026, with an overnight Event from Monday 22:00 to Tuesday 06:00. */
async function weekWithNightFlight(page: Page, title: string) {
  await page.goto("/calendar?view=week&d=2026-11-09");
  await workLocally(page);
  await seedEvent(page, { title, date: "2026-11-09", endDate: "2026-11-10", start: "22:00", end: "06:00" });
  const monday = page.locator('[data-col="2026-11-09"]').getByTitle(title, { exact: false });
  const tuesday = page.locator('[data-col="2026-11-10"]').getByTitle(title, { exact: false });
  await expect(tuesday).toBeVisible();
  return { monday, tuesday };
}

/** Press on a box `fromY` px below its top and move the mouse `dy` px down, in steps, as a hand would. */
async function dragDown(page: Page, box: { x: number; y: number; width: number }, fromY: number, dy: number) {
  const x = box.x + box.width / 2;
  await page.mouse.move(x, box.y + fromY);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(x, box.y + fromY + (dy * i) / 8);
  await page.mouse.up();
}

const HOUR_PX = 56;

test("dragging the next-day piece of an overnight Event moves the whole Event, keeping its length", async ({ page, isMobile }) => {
  test.skip(isMobile, "a mouse drag; a phone drags after a long press, through the same drop");
  const title = `Red-eye ${Date.now()}`;
  const { tuesday } = await weekWithNightFlight(page, title);
  await tuesday.scrollIntoViewIfNeeded();
  // Tuesday's piece runs 00:00–06:00: drop it an hour later.
  await dragDown(page, (await tuesday.boundingBox())!, 10, HOUR_PX);
  await expect.poll(() => storedEvent(page, title)).toEqual({ date: "2026-11-09", endDate: "2026-11-10", start: "23:00", end: "07:00" });
});

test("only the last piece of an overnight Event resizes, and it moves only the end", async ({ page, isMobile }) => {
  test.skip(isMobile, "a phone sets an end in the Hours editor, not by an edge");
  const title = `Sleeper ${Date.now()}`;
  const { monday, tuesday } = await weekWithNightFlight(page, title);
  await expect(monday.locator(".cursor-ns-resize"), "the first piece carries on: no end of its own to drag").toHaveCount(0);
  await expect(tuesday.locator(".cursor-ns-resize")).toHaveCount(1);
  await tuesday.scrollIntoViewIfNeeded();
  const box = (await tuesday.boundingBox())!;
  await dragDown(page, box, box.height - 3, HOUR_PX);
  await expect.poll(() => storedEvent(page, title)).toEqual({ date: "2026-11-09", endDate: "2026-11-10", start: "22:00", end: "07:00" });
});

test("the Hours editor gives an Event a Start and an End, rolling an earlier End to the next day", async ({ page }) => {
  const title = `Late shift ${Date.now()}`;
  await page.goto("/calendar?view=week&d=2026-11-09");
  await workLocally(page);
  await seedEvent(page, { title, date: "2026-11-09", endDate: null, start: "20:00", end: "21:00" });
  await page.locator('[data-col="2026-11-09"]').getByText(title).click();
  await expect(page.getByRole("combobox", { name: "Start" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Length" }), "an Event is given an end, not a length").toHaveCount(0);
  await setTime(page.getByRole("combobox", { name: "End" }), "02:00");
  await expect(page.getByText(/^until Tue.* · 6h$/)).toBeVisible();
  await expect.poll(() => storedEvent(page, title)).toEqual({ date: "2026-11-09", endDate: "2026-11-10", start: "20:00", end: "02:00" });
  // Moving the Start keeps the length.
  await setTime(page.getByRole("combobox", { name: "Start" }), "19:00");
  await expect.poll(() => storedEvent(page, title)).toEqual({ date: "2026-11-09", endDate: "2026-11-10", start: "19:00", end: "01:00" });
});

test("the Hours editor keeps a Start and a Length for a Time block of work", async ({ page }) => {
  const title = `Write report ${Date.now()}`;
  await page.goto("/calendar?view=week&d=2026-11-09");
  await workLocally(page);
  await page.evaluate(
    async ({ coreUrl, title }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      const task = await core.putDocument({ type: "task", title, status: "active", date: "2026-11-09", completedOn: null, recurrence: null, notes: "", tags: [] });
      await core.addTimeBlock("tasks", task.id, "2026-11-09", { start: "10:00", end: "11:00" });
    },
    { coreUrl: CORE_URL, title },
  );
  await page.locator('[data-col="2026-11-09"]').getByText(title).click();
  await expect(page.getByRole("combobox", { name: "Start" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Length" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "End" })).toHaveCount(0);
});

test("an overnight Event counts as running on its second day until it ends, on the Events screen", async ({ page }) => {
  const title = `Red-eye ${Date.now()}`;
  // Tue 10 Nov 2026, 03:00: the Mon 22:00 → Tue 06:00 flight is still on.
  await page.clock.setFixedTime(new Date("2026-11-10T03:00:00"));
  await page.goto("/app/events");
  await workLocally(page);
  await page.evaluate(
    async ({ coreUrl, title }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      await core.putDocument({ type: "event", title, date: "2026-11-09", endDate: "2026-11-10", start: "22:00", end: "06:00", notes: "", tags: [] });
    },
    { coreUrl: CORE_URL, title },
  );
  const section = (name: string) => page.locator("section", { has: page.getByRole("heading", { name, exact: true }) });
  await expect(section("Today").getByText(title)).toBeVisible();
  await expect(section("Past 30 days").getByText(title)).toHaveCount(0);

  // Tue 07:00: it has landed.
  await page.clock.setFixedTime(new Date("2026-11-10T07:00:00"));
  await page.reload();
  await workLocally(page);
  await expect(section("Past 30 days").getByText(title)).toBeVisible();
  await expect(section("Today").getByText(title)).toHaveCount(0);
});
