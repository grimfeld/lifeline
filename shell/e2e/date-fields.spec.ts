import { test, expect, type Page } from "@playwright/test";
import { CORE_URL } from "./support/seed";
import { openCalendar, pickDate, pickInCalendar } from "./support/date-picker";

/**
 * Dates picked from the kit's calendar, never the browser's (ADR 0087), where
 * the picker holds a rule of its own: a type's report window can't end before
 * it starts, and a Stat is marked for a day already lived.
 */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

/** Runs in the page against the app's own Core module. */
async function inCore<A, R>(page: Page, fn: (core: any, arg: A) => Promise<R>, arg: A): Promise<R> {
  return page.evaluate(
    async ({ coreUrl, src, arg }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      return new Function("core", "arg", `return (${src})(core, arg);`)(core, arg);
    },
    { coreUrl: CORE_URL, src: fn.toString(), arg },
  );
}

/** `YYYY-MM-DD`, `offset` days from today, in local time. */
const dayFromToday = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

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
          ((await core.documentsOf("stat_entry")) as { statId: string; ts: string }[])
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

  await pickDate(page, page.getByLabel("From", { exact: true }), "2026-03-10");
  await expect(page).toHaveURL(/from=2026-03-10/);

  await page.getByLabel("To", { exact: true }).click();
  const calendar = openCalendar(page);
  await expect(calendar).toBeVisible();
  await calendar.getByRole("combobox", { name: "Choose the Year" }).selectOption("2026");
  await calendar.getByRole("combobox", { name: "Choose the Month" }).selectOption("2");
  await expect(calendar.locator('[role="gridcell"][data-day="2026-03-09"]:not([data-outside]) button')).toBeDisabled();
  await pickInCalendar(calendar, "2026-03-20");
  await expect(page).toHaveURL(/to=2026-03-20/);
});

const dateOf = (page: Page, id: string) => inCore(page, async (core, docId: string) => (await core.getDocument(docId)).date as string, id);

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
  await pickDate(page, dialog.getByLabel("Day"), later);
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
  await pickDate(page, page.getByLabel("Day", { exact: true }), later);
  await expect.poll(() => dateOf(page, id)).toBe(later);
});
