import { test, expect, type Locator, type Page } from "@playwright/test";
import { CORE_URL } from "./support/seed";
import { setTime } from "./support/time-field";

/**
 * The Schedule's quick add (#225): tapping an empty hour (a double-click on the
 * desk) asks for a title, a Start and an End — an End earlier than the Start
 * being the next day's (ADR 0090) — and "More…" carries all of it into the
 * Event dialog.
 */

const DAY = "2026-11-09"; // a Monday

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
  // The sign-in dialog fades out over its overlay; a raw mouse press (a sweep)
  // has no actionability wait and would land on that overlay.
  await expect(page.locator('[data-slot="dialog-overlay"]')).toHaveCount(0);
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

/** Open the Day view on DAY and tap (phone) or double-click (desk) an empty hour: the quick add. */
async function openQuickAdd(page: Page, isMobile: boolean) {
  await page.goto(`/calendar?view=day&d=${DAY}`);
  await workLocally(page);
  const column = page.locator(`[data-col="${DAY}"]`);
  await expect(column).toBeVisible();
  const position = { x: 40, y: 2 * 56 + 10 };
  if (isMobile) await column.tap({ position });
  else await column.dblclick({ position });
  const quick = page.getByRole("dialog", { name: /^Add on / });
  await expect(quick).toBeVisible();
  return quick;
}

test("an hour tapped adds an Event from its Start to its End, an earlier End rolling to the next day", async ({ page, isMobile }) => {
  const title = `Night shift ${Date.now()}`;
  const quick = await openQuickAdd(page, isMobile);
  const add = quick.getByRole("button", { name: "Add", exact: true });
  await expect(add, "no nameless Event").toBeDisabled();
  // It starts at the tapped quarter hour and lasts an hour.
  await expect(quick.getByText(/· 1h$/)).toBeVisible();

  await quick.getByRole("textbox", { name: "Title" }).fill(title);
  await setTime(quick.getByRole("combobox", { name: "Start" }), "22:00");
  await setTime(quick.getByRole("combobox", { name: "End" }), "01:30");
  await expect(quick.getByText(/· 3h 30m$/)).toBeVisible();
  await add.click();
  await expect(quick).toBeHidden();
  await expect.poll(() => storedEvent(page, title)).toEqual({ date: DAY, endDate: "2026-11-10", start: "22:00", end: "01:30" });
});

test("an Event added at 23:30 for an hour ends at 00:30 the next day, never at 24:00 (#224)", async ({ page, isMobile }) => {
  const title = `Late call ${Date.now()}`;
  const quick = await openQuickAdd(page, isMobile);
  await quick.getByRole("textbox", { name: "Title" }).fill(title);
  await setTime(quick.getByRole("combobox", { name: "Start" }), "23:30");
  await expect(quick.getByText(/· 1h$/)).toBeVisible();
  await quick.getByRole("button", { name: "Add", exact: true }).click();
  await expect(quick).toBeHidden();
  await expect.poll(() => storedEvent(page, title)).toEqual({ date: DAY, endDate: "2026-11-10", start: "23:30", end: "00:30" });
});

test("moving the Start keeps the length, and Enter in the title adds", async ({ page, isMobile }) => {
  const title = `Standup ${Date.now()}`;
  const quick = await openQuickAdd(page, isMobile);
  await setTime(quick.getByRole("combobox", { name: "Start" }), "09:00");
  await setTime(quick.getByRole("combobox", { name: "End" }), "09:45");
  await expect(quick.getByText(/· 45m$/)).toBeVisible();
  await setTime(quick.getByRole("combobox", { name: "Start" }), "10:00");
  await expect(quick.getByText(/· 45m$/)).toBeVisible();
  const titleBox = quick.getByRole("textbox", { name: "Title" });
  await titleBox.fill(title);
  await titleBox.press("Enter");
  await expect(quick).toBeHidden();
  await expect.poll(() => storedEvent(page, title)).toEqual({ date: DAY, endDate: null, start: "10:00", end: "10:45" });
});

test('"More…" opens the Event dialog with the title, day, start and end already typed', async ({ page, isMobile }) => {
  const title = `Long lunch ${Date.now()}`;
  const quick = await openQuickAdd(page, isMobile);
  await quick.getByRole("textbox", { name: "Title" }).fill(title);
  await setTime(quick.getByRole("combobox", { name: "Start" }), "12:15");
  await setTime(quick.getByRole("combobox", { name: "End" }), "13:45");
  await quick.getByRole("button", { name: "More…" }).click();
  await expect(quick).toBeHidden();

  const dialog = page.getByRole("dialog", { name: "New event" });
  await expect(dialog.getByLabel("Title")).toHaveValue(title);
  await expect(dialog.getByRole("combobox", { name: "Start" })).toHaveValue(/^12:15/);
  await expect(dialog.getByRole("combobox", { name: "End" })).toHaveValue(/^(13|1):45/);
  await expect(dialog.getByText(/· 1h 30m$/)).toBeVisible();
  await dialog.getByRole("button", { name: "Add event" }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => storedEvent(page, title)).toEqual({ date: DAY, endDate: null, start: "12:15", end: "13:45" });
});

/**
 * The desk sweep (#226): press on an empty hour and drag down, and the quick
 * add opens with that range. An empty day shows from 7:00 (hourWindow's
 * floor), so an hour's y is (hour - 7) × 56px from the column's top.
 */
const SWEEP_DAY = "2026-11-16"; // a Monday with nothing on it
const HOUR_PX = 56;
const FIRST_HOUR = 7;

async function openEmptyDay(page: Page) {
  await page.goto(`/calendar?view=day&d=${SWEEP_DAY}`);
  await workLocally(page);
  const column = page.locator(`[data-col="${SWEEP_DAY}"]`);
  await expect(column).toBeVisible();
  // The hours open scrolled to now: bring the morning into view.
  await column.evaluate((el, top) => {
    el.closest(".overflow-y-auto")!.scrollTop = top;
  }, (9 - FIRST_HOUR) * HOUR_PX);
  return column;
}

/** Where an hour of the column sits on screen now (the hours scroll). */
async function hourAt(column: Locator, hours: number) {
  const box = (await column.boundingBox())!;
  return { x: box.x + 40, y: box.y + (hours - FIRST_HOUR) * HOUR_PX };
}

test("a desk sweep from 10:00 to 11:45 opens the quick add with that range", async ({ page, isMobile }) => {
  test.skip(isMobile, "the phone has no sweep: a tap is the way in");
  const title = `Workshop ${Date.now()}`;
  const column = await openEmptyDay(page);
  const press = await hourAt(column, 10 + 5 / 60);
  const release = await hourAt(column, 11.6);
  await page.mouse.move(press.x, press.y);
  await page.mouse.down();
  await page.mouse.move(release.x, release.y, { steps: 8 });
  // The ghost range, snapped to the quarter hours.
  await expect(column.getByText(/^10:00\s?AM–11:45\s?AM$|^10:00–11:45$/)).toBeVisible();
  await page.mouse.up();

  const quick = page.getByRole("dialog", { name: /^Add on / });
  await expect(quick).toBeVisible();
  await expect(quick.getByRole("combobox", { name: "Start" })).toHaveValue(/^10:00/);
  await expect(quick.getByRole("combobox", { name: "End" })).toHaveValue(/^11:45/);
  await expect(quick.getByText(/· 1h 45m$/)).toBeVisible();
  await expect(column.getByText(/–11:45/), "the ghost goes once the quick add is open").toBeHidden();
  await quick.getByRole("textbox", { name: "Title" }).fill(title);
  await quick.getByRole("button", { name: "Add", exact: true }).click();
  await expect(quick).toBeHidden();
  await expect.poll(() => storedEvent(page, title)).toEqual({ date: SWEEP_DAY, endDate: null, start: "10:00", end: "11:45" });
});

test("on the desk, dragging an Event still moves it rather than sweeping", async ({ page, isMobile }) => {
  test.skip(isMobile, "a phone drags on press and hold");
  const title = `Movable ${Date.now()}`;
  const column = await openEmptyDay(page);
  await column.dblclick({ position: { x: 40, y: (9 - FIRST_HOUR) * HOUR_PX + 4 } });
  const quick = page.getByRole("dialog", { name: /^Add on / });
  await quick.getByRole("textbox", { name: "Title" }).fill(title);
  await quick.getByRole("textbox", { name: "Title" }).press("Enter");
  await expect.poll(() => storedEvent(page, title)).toEqual({ date: SWEEP_DAY, endDate: null, start: "09:00", end: "10:00" });

  const block = column.getByText(title);
  const from = (await block.boundingBox())!;
  await page.mouse.move(from.x + 4, from.y + 4);
  await page.mouse.down();
  await page.mouse.move(from.x + 4, from.y + 4 + 2 * HOUR_PX, { steps: 10 });
  await page.mouse.up();
  await expect.poll(() => storedEvent(page, title)).toEqual({ date: SWEEP_DAY, endDate: null, start: "11:00", end: "12:00" });
  await expect(page.getByRole("dialog", { name: /^Add on / }), "no quick add from a drag").toBeHidden();
});
