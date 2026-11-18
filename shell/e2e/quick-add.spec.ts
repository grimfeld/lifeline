import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";
import type { Document as StoredDoc } from "@lifeline/core";
import { setTime } from "./support/time-field";

/**
 * An empty hour of the Schedule opens the Event dialog (#539): a tap (a
 * double-click on the desk) starts it at that day and hour, a desk sweep with
 * that start and end — a sweep to midnight ending at 00:00 the next day
 * (ADR 0090). Below the Form, "Or place here" places a Blocker template or
 * unplaced work at the Form's day and start; all day, it asks for a start.
 * The range a sweep snaps to is `hours.test.ts`'s; a template's start at an
 * hour `templates.test.ts`'s; an End before the Start `eventForm.test.ts`'s.
 */

// A Monday a year before any run's seed: the seed dates its Events and Blockers
// around the real today, so the clock is pinned here and the next Monday is empty.
const TODAY = "2025-11-10";
const DAY = "2025-11-17"; // a Monday with nothing on it
const HOUR_PX = 56;
/** An empty day shows from 7:00 (hourWindow's floor): an hour's y is (hour - 7) × 56px from the column's top. */
const FIRST_HOUR = 7;

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(`${TODAY}T08:00:00`));
});

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
  // The sign-in dialog fades out over its overlay; a raw mouse press (a sweep)
  // has no actionability wait and would land on that overlay.
  await expect(page.locator('[data-slot="dialog-overlay"]')).toHaveCount(0);
}

const storedEvent = (page: Page, title: string) =>
  inCore(
    page,
    async (core, t: string) => {
      const ev = (await core.documentsOf<StoredDoc & { date: string; endDate: string | null; start: string | null; end: string | null }>("event")).find((d) => d.title === t);
      return ev ? { date: ev.date, endDate: ev.endDate, start: ev.start, end: ev.end } : null;
    },
    title,
  );

const storedBlocker = (page: Page, title: string) =>
  inCore(
    page,
    async (core, t: string) => {
      const b = (await core.documentsOf<StoredDoc & { date: string; start: string; end: string }>("time_blocker")).find((d) => d.title === t);
      return b ? { date: b.date, start: b.start, end: b.end } : null;
    },
    title,
  );

/** Open the Day view on DAY, its morning in view. */
async function openDay(page: Page) {
  await page.goto(`/calendar?view=day&d=${DAY}`);
  await workLocally(page);
  const column = page.locator(`[data-col="${DAY}"]`);
  await expect(column).toBeVisible();
  // The hours open scrolled to now: bring the morning into view.
  await column.evaluate((el, top) => {
    el.closest(".overflow-y-auto")!.scrollTop = top;
  }, (9 - FIRST_HOUR) * HOUR_PX);
  return column;
}

/** Double-click (desk), or tap (`tap`, a phone), the empty 9:00 of DAY: the Event dialog. */
async function openAtNine(page: Page, tap = false) {
  const column = await openDay(page);
  const position = { x: 40, y: (9 - FIRST_HOUR) * HOUR_PX + 4 };
  if (tap) await column.tap({ position });
  else await column.dblclick({ position });
  const dialog = page.getByRole("dialog", { name: "New event" });
  await expect(dialog).toBeVisible();
  return { column, dialog };
}

test("an empty hour opens the Event dialog at that day and hour, and Add saves the Event there", { tag: "@also-phone" }, async ({ page, isMobile }) => {
  const title = `Stand-up ${Date.now()}`;
  const { dialog } = await openAtNine(page, isMobile);
  await expect(dialog.getByRole("combobox", { name: "Start" })).toHaveValue(/^9:00|^09:00/);
  await expect(dialog.getByRole("combobox", { name: "End" })).toHaveValue(/^10:00/);
  await expect(page.getByRole("dialog", { name: /^Add on / }), "the add-at-hour popover is gone").toHaveCount(0);

  await dialog.getByLabel("Title").fill(title);
  await dialog.getByRole("button", { name: "Add event" }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => storedEvent(page, title)).toEqual({ date: DAY, endDate: null, start: "09:00", end: "10:00" });
});

test("a desk sweep opens the Event dialog with the range swept; swept down to midnight, the Event ends at 00:00 the next day", async ({ page }) => {
  const title = `Late shift ${Date.now()}`;
  const day = "2025-11-18";
  await page.goto("/calendar");
  await workLocally(page);
  // A late Event stretches the day's hours to midnight; the sweep starts above it.
  await inCore(page, async (core, d: string) => void (await core.putDocument({ type: "event", title: "Last call", date: d, endDate: null, start: "23:15", end: "23:45", notes: "", tags: [] })), day);
  await page.goto(`/calendar?view=day&d=${day}`);
  await workLocally(page);
  const column = page.locator(`[data-col="${day}"]`);
  await expect(column.getByText("Last call")).toBeAttached();
  await column.evaluate((el) => {
    const scroller = el.closest(".overflow-y-auto")!;
    scroller.scrollTop = scroller.scrollHeight;
  });
  const box = (await column.boundingBox())!;
  const bottom = box.y + box.height;
  await page.mouse.move(box.x + 40, bottom - 2 * HOUR_PX + 4);
  await page.mouse.down();
  // Into the last quarter hour, below the late Event: the sweep reaches midnight.
  await page.mouse.move(box.x + 40, bottom - 2, { steps: 8 });
  await expect(column.getByText(/^(10:00\s?PM–12:00\s?AM|22:00–0?0:00)$/)).toBeVisible();
  await page.mouse.up();

  const dialog = page.getByRole("dialog", { name: "New event" });
  await expect(dialog.getByRole("combobox", { name: "Start" })).toHaveValue(/^(22|10):00/);
  await expect(dialog.getByText(/· 2h$/)).toBeVisible();
  await expect(column.getByText(/^(10:00\s?PM–12:00\s?AM|22:00–0?0:00)$/), "the ghost goes once the dialog is open").toBeHidden();
  await dialog.getByLabel("Title").fill(title);
  await dialog.getByRole("button", { name: "Add event" }).click();
  await expect.poll(() => storedEvent(page, title)).toEqual({ date: day, endDate: "2025-11-19", start: "22:00", end: "00:00" });
});

test('"Or place here" places a Blocker template at the Form\'s day and start, and closes the dialog; all day, it places nothing', async ({ page }) => {
  const tpl = `Focus ${Date.now()}`;
  await page.goto("/calendar");
  await workLocally(page);
  await inCore(page, async (core, title: string) => void (await core.putDocument({ type: "blocker_template", title, durationMin: 30, color: null, tags: [] })), tpl);

  const { dialog } = await openAtNine(page);
  const place = dialog.getByRole("group", { name: "Or place here" });
  // All day, it asks for a start time and places nothing.
  await dialog.getByRole("checkbox", { name: "All day" }).check();
  await expect(place.getByText("Give it a start time to place something here.")).toBeVisible();
  await expect(place.getByRole("button", { name: tpl, exact: true })).toBeDisabled();
  await dialog.getByRole("checkbox", { name: "All day" }).uncheck();
  // The Form's start, not the hour tapped, is where it lands.
  await setTime(dialog.getByRole("combobox", { name: "Start" }), "14:00");
  await place.getByRole("button", { name: tpl, exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => storedBlocker(page, tpl)).toEqual({ date: DAY, start: "14:00", end: "14:30" });
});

test('"Or place here" gives unplaced work a Time block at the Form\'s start, its Estimate long', async ({ page }) => {
  const task = `Write the report ${Date.now()}`;
  await page.goto("/calendar");
  await workLocally(page);
  await inCore(
    page,
    async (core, title: string) => void (await core.putDocument({ type: "task", title, status: "active", date: null, completedOn: null, recurrence: null, notes: "", tags: [], estimate: 45 })),
    task,
  );

  const { column, dialog } = await openAtNine(page);
  await setTime(dialog.getByRole("combobox", { name: "Start" }), "11:00");
  await dialog.getByRole("group", { name: "Or place here" }).getByRole("button", { name: `${task} 45m`, exact: true }).click();
  await expect(dialog).toBeHidden();
  // The block on the hours, from the Form's start for the Estimate.
  await expect(column.locator(`[title$=" ${task}"]`)).toHaveAttribute("title", /^11:00\s?(AM)?–11:45\s?(AM)? /);
});

test("on the desk, dragging an Event still moves it rather than sweeping", async ({ page }) => {
  const title = `Movable ${Date.now()}`;
  const { column, dialog } = await openAtNine(page);
  await dialog.getByLabel("Title").fill(title);
  await dialog.getByLabel("Title").press("Enter");
  await expect.poll(() => storedEvent(page, title)).toEqual({ date: DAY, endDate: null, start: "09:00", end: "10:00" });

  const block = column.getByText(title);
  const from = (await block.boundingBox())!;
  await page.mouse.move(from.x + 4, from.y + 4);
  await page.mouse.down();
  await page.mouse.move(from.x + 4, from.y + 4 + 2 * HOUR_PX, { steps: 10 });
  await page.mouse.up();
  await expect.poll(() => storedEvent(page, title)).toEqual({ date: DAY, endDate: null, start: "11:00", end: "12:00" });
  await expect(page.getByRole("dialog", { name: "New event" }), "no dialog from a drag").toBeHidden();
});
// timing run for #633; not to merge
