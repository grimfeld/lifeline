import { test, expect, type Page } from "@playwright/test";
import { CORE_URL } from "./support/seed";
import { pickDate } from "./support/date-picker";
import { setTime } from "./support/time-field";

/**
 * "Add event…" asks for an Event the way people talk about meetings: a Start
 * (day + time) and an End, with the length shown beside the End. It opens timed.
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

test('"Add event…" opens a timed Event; the typed start and end are stored, and moving the start keeps the length', async ({ page }) => {
  const title = `Board meeting ${Date.now()}`;
  await page.goto("/app/events");
  await workLocally(page);
  await page.keyboard.press("ControlOrMeta+k");
  await page.getByPlaceholder("Type a command or search…").fill("Add event");
  await page.getByRole("option", { name: "Add event Calendar", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "New event" });
  await expect(dialog.getByRole("checkbox", { name: "All day" })).not.toBeChecked();
  const start = dialog.getByRole("combobox", { name: "Start" });
  const end = dialog.getByRole("combobox", { name: "End" });
  await expect(start).not.toHaveValue("");
  await expect(dialog.getByText(/^until .+ · 1h$/)).toBeVisible();
  await expect(dialog.locator('input[type="time"]'), "no native time input").toHaveCount(0);

  await dialog.getByLabel("Title").fill(title);
  await pickDate(page, dialog.getByLabel("Day", { exact: true }), "2026-11-10");
  await setTime(start, "14:00");
  await expect(dialog.getByText(/^until .+ · 1h$/), "the end moved with the start").toBeVisible();
  await setTime(end, "1530");
  await expect(dialog.getByText(/^until .+ · 1h 30m$/)).toBeVisible();
  await setTime(start, "15:00");
  await expect(dialog.getByText(/^until .+ · 1h 30m$/), "the length is kept").toBeVisible();

  await dialog.getByRole("button", { name: "Add event" }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => storedEvent(page, title)).toEqual({ date: "2026-11-10", endDate: null, start: "15:00", end: "16:30" });
});
