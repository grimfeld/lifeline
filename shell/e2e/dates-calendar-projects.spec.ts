import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";
import { openCalendar } from "./support/date-picker";

/**
 * Projects' dates are picked from the kit's Date picker (ADR 0087): an optional
 * Deadline is cleared from it, and a to-date disables the days before its
 * from-date. An all-day Event's last day does the same: `date-picker.test.tsx`
 * pins down the disabled days.
 */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

/** Every load asks to sign in again; this one works locally. */
async function go(page: Page, path: string) {
  await page.goto(path);
  await workLocally(page);
}

const field = (page: Page, id: string, key: string) => inCore(page, async (core, a: { id: string; key: string }) => (await core.getDocument(a.id))?.[a.key], { id, key });

const DAY = "2026-11-12";
const day = (calendar: ReturnType<typeof openCalendar>, d: string) => calendar.locator(`[role="gridcell"][data-day="${d}"]:not([data-outside]) button`);

test("Projects: a Project's Deadline is cleared from its Date picker; its marker leaves the Calendar", async ({ page }) => {
  await page.goto("/calendar");
  await workLocally(page);
  const title = `Launch ${Date.now()}`;
  const id = await inCore(page, async (core, t: string) => (await core.putDocument({ type: "project", title: t, body: "", stage: "active", start: "2026-11-05", deadline: "2026-11-12" })).id as string, title);

  await go(page, `/calendar?view=day&d=${DAY}`);
  await expect(page.getByText(`⚑ ${title}`).first()).toBeVisible();

  await go(page, `/app/projects/p/${id}`);
  await page.getByRole("button", { name: "Edit" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit project" });
  // The Deadline disables the days before the start.
  await dialog.getByLabel("Deadline").click();
  const calendar = openCalendar(page);
  await expect(day(calendar, "2026-11-04")).toBeDisabled();
  await expect(day(calendar, "2026-11-06")).toBeEnabled();
  // Clear sits in the picker's footer, beside the calendar.
  await page.locator('[data-slot="popover-content"]').getByRole("button", { name: "Clear" }).click();
  await expect(calendar).toBeHidden();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect.poll(() => field(page, id, "deadline")).toBeNull();

  await go(page, `/calendar?view=day&d=${DAY}`);
  await expect(page.getByRole("heading").first()).toBeVisible();
  await expect(page.getByText(`⚑ ${title}`)).toHaveCount(0);
});

test("Projects: a Project opened from its Deadline marker shows one Deadline control and no shell Day picker (ADR 0124)", async ({ page }) => {
  await page.goto("/calendar");
  await workLocally(page);
  const title = `Peeked ${Date.now()}`;
  await inCore(page, async (core, t: string) => (await core.putDocument({ type: "project", title: t, body: "", stage: "active", start: "2026-11-05", deadline: "2026-11-12" })).id as string, title);

  await go(page, `/calendar?view=day&d=${DAY}`);
  await page.getByText(`⚑ ${title}`).first().click();
  const peek = page.getByRole("dialog").first();
  await expect(peek.getByLabel("Deadline")).toHaveCount(1);
  await expect(peek.getByLabel("Day", { exact: true })).toHaveCount(0);
  await expect(peek.getByRole("region", { name: "Timing" })).toHaveCount(0);
});
