import { test, expect, type Page } from "@playwright/test";
import { CORE_URL } from "./support/seed";
import { pickDate } from "./support/date-picker";

/**
 * A Date and time field (ADR 0087): the day from the kit's calendar, the time
 * typed beside it. Picking a day with no time yet fills in the time now, a
 * field capped at now never takes a later time, and changing only the day
 * keeps the time. Driven through a Swear Jar fine's "When it happened".
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

const pad = (n: number) => String(n).padStart(2, "0");
const dayOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dayOf(d);
};

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
  return { dialog, offenceId, day: dialog.getByLabel("When it happened"), time: dialog.getByLabel("Time") };
}

test("a Fine's 'When it happened': picking a day fills in the time now, and changing the day keeps it", async ({ page }) => {
  const { dialog, offenceId, day, time } = await openFineDialog(page);
  await time.fill("");
  await pickDate(page, day, daysAgo(10));
  await expect(time).toHaveValue(/^\d{2}:\d{2}$/);

  await time.fill("09:05");
  await pickDate(page, day, daysAgo(12));
  await expect(time).toHaveValue("09:05");

  await dialog.getByRole("button", { name: "Fine me" }).click();
  await expect(dialog).toBeHidden();
  const stored = await inCore(
    page,
    async (core, id: string) => {
      const fine = (await core.documentsOf("swearjar_fine")).find((f: any) => f.offenceId === id);
      const d = new Date(fine.occurredAt);
      const p = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
    },
    offenceId,
  );
  expect(stored).toBe(`${daysAgo(12)}T09:05`);
});

test("a Fine's 'When it happened': today stays capped at now", async ({ page }) => {
  const { day, time } = await openFineDialog(page);
  await pickDate(page, day, daysAgo(1));
  await time.fill("23:59");
  await pickDate(page, day, daysAgo(0));
  const shown = await time.inputValue();
  const now = new Date();
  expect(shown <= `${pad(now.getHours())}:${pad(now.getMinutes())}`).toBe(true);

  // Tomorrow can't be picked at all.
  await day.click();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const cell = page.locator(`[data-slot="calendar"] [role="gridcell"][data-day="${dayOf(tomorrow)}"]:not([data-outside])`);
  if (await cell.count()) await expect(cell.getByRole("button")).toBeDisabled();
});
