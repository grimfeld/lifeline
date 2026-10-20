import { test, expect, type Page } from "@playwright/test";
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
