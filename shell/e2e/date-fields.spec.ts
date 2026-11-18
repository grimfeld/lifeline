import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";
import { datePickerLabelled, dayFromToday, openCalendar, pickDate, pickInCalendar, showPhoneFilters } from "./support/date-picker";

/**
 * Dates picked from the kit's calendar, never the browser's (ADR 0087): a Stat
 * is marked for a day already lived, a Task moved to another day, a Base filter
 * set to a day. A to-date that can't fall before its from-date is covered once,
 * by Pocket's custom Allowance (money-dialogs.spec.ts).
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

const dateOf = (page: Page, id: string) => inCore(page, async (core, docId: string) => (await core.getDocument(docId))!.date as string, id);

test("a Task moved to another day from Move to day… in the Peek it opens from Upcoming", async ({ page }) => {
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
  // The tap opens the Task's Peek; its Time block section carries the row's actions, a phone's way to them.
  const peek = page.getByRole("dialog", { name: title, exact: true });
  await peek.getByRole("region", { name: "Time block" }).getByRole("button", { name: "Move to day…" }).click();
  const dialog = page.getByRole("dialog", { name: `Move "${title}"` });
  const later = dayFromToday(3);
  await pickDate(page, datePickerLabelled(dialog, "Day"), later);
  await dialog.getByRole("button", { name: "Move" }).click();
  await expect.poll(() => dateOf(page, id)).toBe(later);
  await expect(peek, "the tapped row has moved: the Peek closes").toBeHidden();
});

test("on the desk, a right-click on a Task in Upcoming still opens its menu", async ({ page }) => {
  const title = `Menu me ${Date.now()}`;
  await page.goto("/calendar?view=upcoming");
  await workLocally(page);
  await inCore(page, async (core, a: { title: string; today: string }) => void (await core.putDocument({ type: "task", title: a.title, status: "active", date: a.today, completedOn: null, recurrence: null, notes: "", tags: [] })), { title, today: dayFromToday(0) });
  await page.getByText(title).click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "Move to day…" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: title, exact: true }), "a right-click opens no Peek").toHaveCount(0);
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
// timing run for #633; not to merge
