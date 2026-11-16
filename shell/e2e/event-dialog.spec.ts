import { test, expect, type Page } from "@playwright/test";
import { openPalette } from "./support/palette";
import { CORE_URL } from "./support/seed";
import { pickDate } from "./support/date-picker";
import { setTime } from "./support/time-field";
import { encodeHandoff } from "@lifeline/handoff";

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
  await openPalette(page);
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

/** The labels of the Event Form's Fields, in the order shown — the dialog's and the Peek's are one Form (#532). */
const formLabels = async (scope: ReturnType<Page["getByRole"]>) => {
  const form = scope.getByRole("group", { name: "Event" });
  return (await form.locator("label").allInnerTexts()).map((t) => t.trim()).filter(Boolean);
};

test("the Event dialog and the Event's Peek show the same Form, and the Events screen's Edit opens the Peek", async ({ page }) => {
  const title = `Planning ${Date.now()}`;
  await page.goto("/app/events");
  await workLocally(page);
  await page.evaluate(
    async ({ coreUrl, title }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      await core.putDocument({ type: "event", title, date: "2099-06-01", endDate: null, start: "09:00", end: "10:00", notes: "", tags: [] });
    },
    { coreUrl: CORE_URL, title },
  );

  await page.getByRole("button", { name: "New event" }).click();
  const dialog = page.getByRole("dialog", { name: "New event" });
  const adding = await formLabels(dialog);
  expect(adding).toEqual(["Day", "Start", "End", "All day", "Notes", "With", "Tags"]);
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();

  // Edit opens the Event's Peek, never the dialog.
  const row = page.locator('[data-slot="card"]', { hasText: title });
  await row.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const peek = page.getByRole("dialog", { name: title });
  await expect(peek).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Edit event" })).toHaveCount(0);
  expect(await formLabels(peek)).toEqual(adding);

  await peek.getByLabel("Notes").fill("Bring the slides");
  await expect.poll(() => page.evaluate(
    async ({ coreUrl, title }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      return (await core.documentsOf("event")).find((d: { title: string }) => d.title === title)?.notes;
    },
    { coreUrl: CORE_URL, title },
  )).toBe("Bring the slides");
});

test("an Event Intake (a Handoff) opens the Event dialog prefilled, and its Add saves the Event", async ({ page }) => {
  const title = `Concert ${Date.now()}`;
  await page.goto(`/handoff#${encodeHandoff({ title, text: "", url: "https://example.com/concert" }, "calendar/event")}`);
  await workLocally(page);
  const dialog = page.getByRole("dialog", { name: "New event" });
  await expect(dialog.getByLabel("Title")).toHaveValue(title);
  await expect(dialog.getByLabel("Notes")).toHaveValue("https://example.com/concert");
  await pickDate(page, dialog.getByLabel("Day", { exact: true }), "2026-12-04");
  await dialog.getByRole("button", { name: "Add event" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await expect.poll(() => storedEvent(page, title)).toMatchObject({ date: "2026-12-04" });
});
