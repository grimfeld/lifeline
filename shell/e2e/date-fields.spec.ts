import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";
import { datePickerLabelled, dayFromToday, openCalendar, pickDate, pickInCalendar, showPhoneFilters } from "./support/date-picker";

/**
 * Dates picked from the kit's calendar, never the browser's (ADR 0087), where
 * the picker holds a rule of its own: a type's report window can't end before
 * it starts, and a Stat is marked for a day already lived.
 */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

test("a yes/no Stat is marked for a past day, never a future one", async ({ page }) => {
  const title = `Flossed ${Date.now()}`;
  await page.goto("/vault");
  await workLocally(page);
  const id = await inCore(
    page,
    async (core, t: string) => (await core.putDocument({ type: "stat", title: t, kind: "boolean", unit: "", defaultIncrement: 0, universeSize: 0, items: [], tags: [] })).id as string,
    title,
  );
  await inCore(page, async (core, docId: string) => core.openPeek(docId), id);
  await page.getByRole("dialog").first().getByRole("button", { name: "Mark a day…" }).click();
  const dialog = page.getByRole("dialog", { name: `Mark ${title}` });

  const tomorrow = dayFromToday(1);
  await dialog.getByLabel("Day").click();
  const calendar = openCalendar(page);
  await calendar.getByRole("combobox", { name: "Choose the Year" }).selectOption(tomorrow.slice(0, 4));
  await calendar.getByRole("combobox", { name: "Choose the Month" }).selectOption(String(Number(tomorrow.slice(5, 7)) - 1));
  await expect(calendar.locator(`[role="gridcell"][data-day="${tomorrow}"]:not([data-outside]) button`)).toBeDisabled();
  const yesterday = dayFromToday(-1);
  await pickInCalendar(calendar, yesterday);
  await dialog.getByRole("button", { name: "Mark", exact: true }).click();

  await expect
    .poll(() =>
      inCore(
        page,
        async (core, statId: string) =>
          ((await core.documentsOf("stat_entry")) as unknown as { statId: string; ts: string }[])
            .filter((e) => e.statId === statId)
            .map((e) => { const d = new Date(e.ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }),
        id,
      ),
    )
    .toEqual([yesterday]);
});

test("a type's reports over two dates: To can't fall before From", async ({ page }) => {
  await page.goto("/app/journal/t/e2eperson?w=custom");
  await workLocally(page);

  // From well ahead of today, so an empty To opening on From's month is seen.
  const from = dayFromToday(40);
  const before = dayFromToday(39);
  const to = dayFromToday(45);
  await showPhoneFilters(page, "Dates", datePickerLabelled(page, "From"));
  await pickDate(page, datePickerLabelled(page, "From"), from);
  await expect(page).toHaveURL(new RegExp(`from=${from}`));
  await expect(datePickerLabelled(page, "To")).toHaveAccessibleName("To, No date");

  await datePickerLabelled(page, "To").click();
  const calendar = openCalendar(page);
  await expect(calendar).toBeVisible();
  await expect(calendar.locator(`[role="gridcell"][data-day="${from}"]:not([data-outside])`)).toBeVisible();
  await calendar.getByRole("combobox", { name: "Choose the Year" }).selectOption(before.slice(0, 4));
  await calendar.getByRole("combobox", { name: "Choose the Month" }).selectOption(String(Number(before.slice(5, 7)) - 1));
  await expect(calendar.locator(`[role="gridcell"][data-day="${before}"]:not([data-outside]) button`)).toBeDisabled();
  await pickInCalendar(calendar, to);
  await expect(page).toHaveURL(new RegExp(`to=${to}`));
});

const dateOf = (page: Page, id: string) => inCore(page, async (core, docId: string) => (await core.getDocument(docId))!.date as string, id);

test("a Task moved to another day from Upcoming's Move to day…", async ({ page }) => {
  const title = `Move me ${Date.now()}`;
  const today = dayFromToday(0);
  await page.goto("/calendar?view=upcoming");
  await workLocally(page);
  const id = await inCore(
    page,
    async (core, a: { title: string; today: string }) =>
      (await core.putDocument({ type: "task", title: a.title, status: "active", date: a.today, completedOn: null, recurrence: null, notes: "", tags: [] })).id as string,
    { title, today },
  );
  await page.getByText(title).click();
  await page.getByRole("menuitem", { name: "Move to day…" }).click();
  const dialog = page.getByRole("dialog", { name: `Move "${title}"` });
  const later = dayFromToday(3);
  await pickDate(page, datePickerLabelled(dialog, "Day"), later);
  await dialog.getByRole("button", { name: "Move" }).click();
  await expect.poll(() => dateOf(page, id)).toBe(later);
});

test("an Event's day changed in the Hours editor", async ({ page }) => {
  const title = `Shift me ${Date.now()}`;
  const today = dayFromToday(0);
  await page.goto("/calendar?view=upcoming");
  await workLocally(page);
  const id = await inCore(
    page,
    async (core, a: { title: string; today: string }) =>
      (await core.putDocument({ type: "event", title: a.title, date: a.today, endDate: null, start: "23:00", end: "23:30", notes: "", tags: [] })).id as string,
    { title, today },
  );
  await page.getByText(title).click();
  const later = dayFromToday(2);
  await pickDate(page, datePickerLabelled(page, "Day"), later);
  await expect.poll(() => dateOf(page, id)).toBe(later);
});

test("a Base filter on a date is added by picking the day", async ({ page }) => {
  await page.goto("/base/task");
  await workLocally(page);
  // On a phone the Base's filters sit behind its Filters button.
  const addFilter = page.getByRole("button", { name: "Filter", exact: true });
  await showPhoneFilters(page, "Filters", addFilter);
  await addFilter.click();
  await page.getByRole("combobox", { name: "Field" }).click();
  await page.getByRole("option", { name: "Day", exact: true }).click();
  await page.getByRole("combobox", { name: "Condition" }).click();
  await page.getByRole("option", { name: "is", exact: true }).click();
  const day = dayFromToday(1);
  await pickDate(page, datePickerLabelled(page, "Value"), day);
  await expect(page.getByText(`Day is ${day}`)).toBeVisible();
  await expect(datePickerLabelled(page, "Value")).toBeHidden();
});
