import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";
import { pickDate } from "./support/date-picker";
import { setTime } from "./support/time-field";

/**
 * A Date and time field (ADR 0087): the day from the kit's calendar, the time
 * typed into the kit's Time field beside it. Picking a day with no time yet fills in the time now, a
 * field capped at now never takes a later time, and changing only the day
 * keeps the time. Driven through a Swear Jar fine's "When it happened".
 */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

const pad = (n: number) => String(n).padStart(2, "0");
const dayOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dayOf(d);
};

/** When the Offence's Fine happened, as local `YYYY-MM-DDTHH:MM`. */
const storedWhen = (page: Page, offenceId: string) =>
  inCore(
    page,
    async (core, id: string) => {
      const fine = (await core.documentsOf("swearjar_fine")).find((f) => f.offenceId === id);
      const d = new Date(fine!.occurredAt as string);
      const p = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
    },
    offenceId,
  );

/** A new Offence, then its Fine dialog opened by holding (right-clicking) its button. */
async function openFineDialog(page: Page) {
  await page.goto("/app/swearjar");
  await workLocally(page);
  const name = `Snoozed ${Date.now()}`;
  const offenceId = await inCore(
    page,
    async (core, n: string) => (await core.putDocument({ type: "swearjar_offence", title: n, name: n, price: 200, emoji: "", color: "", archived: false })).id,
    name,
  );
  await page.getByTitle("Tap to fine yourself — hold for the details").filter({ hasText: name }).click({ button: "right" });
  const dialog = page.getByRole("dialog", { name: "Log a fine" });
  await expect(dialog).toBeVisible();
  return { dialog, offenceId, day: dialog.getByLabel("When it happened"), time: dialog.getByRole("combobox", { name: "Time" }) };
}

test("a Fine's 'When it happened': picking a day fills in the time now, and changing the day keeps it", async ({ page }) => {
  const { dialog, offenceId, day, time } = await openFineDialog(page);
  await expect(dialog.locator('input[type="time"]'), "no native time input").toHaveCount(0);
  await pickDate(page, day, daysAgo(10));
  await expect(time).toHaveValue(/\d{1,2}:\d{2}/);

  await setTime(time, "09:05");
  const shown = await time.inputValue();
  await pickDate(page, day, daysAgo(12));
  await expect(time).toHaveValue(shown);

  await dialog.getByRole("button", { name: "Fine me" }).click();
  await expect(dialog).toBeHidden();
  expect(await storedWhen(page, offenceId)).toBe(`${daysAgo(12)}T09:05`);
});

test("a Fine's 'When it happened': today stays capped at now", async ({ page }) => {
  const { dialog, offenceId, day, time } = await openFineDialog(page);

  // Tomorrow can't be picked at all.
  await day.click();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const cell = page.locator(`[data-slot="calendar"] [role="gridcell"][data-day="${dayOf(tomorrow)}"]:not([data-outside])`);
  if (await cell.count()) await expect(cell.getByRole("button")).toBeDisabled();
  await page.keyboard.press("Escape");

  await pickDate(page, day, daysAgo(1));
  await setTime(time, "23:59");
  await pickDate(page, day, daysAgo(0));
  await dialog.getByRole("button", { name: "Fine me" }).click();
  await expect(dialog).toBeHidden();
  const now = new Date();
  expect(await storedWhen(page, offenceId) <= `${dayOf(now)}T${pad(now.getHours())}:${pad(now.getMinutes())}`).toBe(true);
});
