import { test, expect, type Page } from "@playwright/test";
import { CORE_URL } from "./support/seed";

/**
 * The Schedule and Month by keyboard (#284): an item that takes the focus
 * opens on Enter and moves on the arrow keys, and the focus stays on it.
 * Mon 9 Nov 2026's week, an Event on the Tuesday at 10:00–11:00.
 */

test.skip(({ isMobile }) => isMobile, "keyboard cases: the desk");

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

const storedEvent = (page: Page, title: string) =>
  page.evaluate(
    async ({ coreUrl, title }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      const ev = (await core.documentsOf("event")).find((d: { title: string }) => d.title === title);
      return ev ? { date: ev.date, start: ev.start, end: ev.end } : null;
    },
    { coreUrl: CORE_URL, title },
  );

async function addEvent(page: Page, title: string) {
  await page.goto("/calendar?view=week&d=2026-11-09");
  await workLocally(page);
  await page.evaluate(
    async ({ coreUrl, title }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      await core.putDocument({ type: "event", title, notes: "", date: "2026-11-10", endDate: null, start: "10:00", end: "11:00", tags: [] });
    },
    { coreUrl: CORE_URL, title },
  );
}

test("an Event on the hours opens on Enter, hands the focus back on close, and moves on the arrow keys", async ({ page }) => {
  const title = `Dentist ${Date.now()}`;
  await addEvent(page, title);
  const item = page.locator("[data-focus-key]", { hasText: title });
  await expect(page.locator('[data-col="2026-11-10"]').getByText(title)).toBeVisible();
  await expect(item).toHaveAccessibleDescription(/Enter to open it/);

  await item.focus();
  await page.keyboard.press("Enter");
  const editor = page.locator('[data-slot="popover-content"]');
  await expect(editor).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(editor).toBeHidden();
  await expect(item, "the focus is back on the Event").toBeFocused();

  await page.keyboard.press("ArrowDown");
  await expect.poll(() => storedEvent(page, title)).toEqual({ date: "2026-11-10", start: "10:15", end: "11:15" });
  await page.keyboard.press("Shift+ArrowUp");
  await expect.poll(() => storedEvent(page, title)).toEqual({ date: "2026-11-10", start: "09:15", end: "10:15" });

  await page.keyboard.press("ArrowRight");
  await expect.poll(() => storedEvent(page, title)).toEqual({ date: "2026-11-11", start: "09:15", end: "10:15" });
  await expect(page.locator('[data-col="2026-11-11"]').getByText(title)).toBeVisible();
  await expect(item, "the focus follows it into Wednesday").toBeFocused();
});

test("an Event on the Month opens on Enter and moves a week on the down arrow", async ({ page }) => {
  const title = `Recital ${Date.now()}`;
  await addEvent(page, title);
  await page.goto("/calendar?view=month&d=2026-11-09");
  await workLocally(page);
  const item = page.locator("[data-focus-key]", { hasText: title });

  await item.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-slot="popover-content"]')).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(item).toBeFocused();

  await page.keyboard.press("ArrowDown");
  await expect.poll(() => storedEvent(page, title)).toEqual({ date: "2026-11-17", start: "10:00", end: "11:00" });
  await expect(item).toBeFocused();
});
