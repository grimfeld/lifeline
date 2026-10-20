import { expect, type Locator, type Page } from "@playwright/test";

/**
 * The open Date picker's calendar. Scoped by the calendar itself, not by role:
 * the popover is a `dialog` too, so `getByRole("dialog")` is ambiguous over a
 * Peek or a Dialog while a picker is open.
 */
export const openCalendar = (page: Page) => page.locator('[data-slot="popover-content"] [data-slot="calendar"]');

/**
 * Pick a day with the kit's Date picker (ADR 0087): open its trigger, choose
 * the month and year in the header, click the day. `day` is `YYYY-MM-DD`.
 */
export async function pickDate(page: Page, trigger: Locator, day: string) {
  const [year, month] = day.split("-").map(Number);
  await trigger.click();
  const calendar = openCalendar(page);
  await expect(calendar).toBeVisible();
  await pickInCalendar(calendar, day, year, month);
  await expect(calendar).toBeHidden();
}

/** Choose month, year and day in a calendar already shown (one in place has no trigger to open). */
export async function pickInCalendar(calendar: Locator, day: string, year = Number(day.slice(0, 4)), month = Number(day.slice(5, 7))) {
  await calendar.getByRole("combobox", { name: "Choose the Year" }).selectOption(String(year));
  await calendar.getByRole("combobox", { name: "Choose the Month" }).selectOption(String(month - 1));
  await calendar.locator(`[role="gridcell"][data-day="${day}"]:not([data-outside]) button`).click();
}
