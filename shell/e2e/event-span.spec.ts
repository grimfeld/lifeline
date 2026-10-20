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

  // Tapping the next day's piece opens the whole Event.
  await tuesday.getByText(title).click();
  await expect(page.getByText(/· .+ – Tue /).first()).toBeVisible();
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
