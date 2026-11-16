import { test, expect, type Page } from "@playwright/test";
import { CORE_URL } from "./support/seed";

/**
 * The Schedule and Month by keyboard (#284): an item that takes the focus
 * opens on Enter and moves on the arrow keys, and the focus stays on it.
 * An Event opens its Peek (#536), and closing a Peek that changed its timing
 * leaves one Undo. Mon 9 Nov 2026's week, an Event on the Tuesday at 10:00–11:00.
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

async function addEvent(page: Page, title: string): Promise<string> {
  await page.goto("/calendar?view=week&d=2026-11-09");
  await workLocally(page);
  return page.evaluate(
    async ({ coreUrl, title }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      return (await core.putDocument({ type: "event", title, notes: "", date: "2026-11-10", endDate: null, start: "10:00", end: "11:00", tags: [] })).id as string;
    },
    { coreUrl: CORE_URL, title },
  );
}

/** The Event's Peek: the Calendar's Form, editing, with every Field. */
async function expectEventPeek(page: Page, title: string) {
  const peek = page.getByRole("dialog", { name: title, exact: true });
  await expect(peek).toBeVisible();
  await expect(peek.getByRole("combobox", { name: "Start" })).toBeVisible();
  await expect(peek.getByText("Notes", { exact: true })).toBeVisible();
  await expect(peek.getByText("With", { exact: true })).toBeVisible();
  await expect(peek.getByText("Tags", { exact: true })).toBeVisible();
  return peek;
}

test("an Event on the hours opens on Enter, hands the focus back on close, and moves on the arrow keys", async ({ page }) => {
  const title = `Dentist ${Date.now()}`;
  await addEvent(page, title);
  const item = page.locator("[data-focus-key]", { hasText: title });
  await expect(page.locator('[data-col="2026-11-10"]').getByText(title)).toBeVisible();
  await expect(item).toHaveAccessibleDescription(/Enter to open it/);

  await item.focus();
  await page.keyboard.press("Enter");
  const peek = await expectEventPeek(page, title);
  await page.keyboard.press("Escape");
  await expect(peek).toBeHidden();
  await expect(page.getByText(`${title} updated`), "nothing changed: no Undo").toHaveCount(0);
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
  const peek = await expectEventPeek(page, title);
  await page.keyboard.press("Escape");
  await expect(peek).toBeHidden();
  await expect(item).toBeFocused();

  await page.keyboard.press("ArrowDown");
  await expect.poll(() => storedEvent(page, title)).toEqual({ date: "2026-11-17", start: "10:00", end: "11:00" });
  await expect(item).toBeFocused();
});

test("an Event clicked on the hours is retimed in its Peek; closing leaves one Undo that puts it back, and the focus on it", async ({ page }) => {
  const title = `Physio ${Date.now()}`;
  await addEvent(page, title);
  const item = page.locator("[data-focus-key]", { hasText: title });
  await item.click();
  const peek = await expectEventPeek(page, title);

  await peek.getByRole("button", { name: "15 minutes later" }).click();
  await peek.getByRole("button", { name: "15 minutes later" }).click();
  await expect.poll(() => storedEvent(page, title)).toEqual({ date: "2026-11-10", start: "10:30", end: "11:30" });
  await page.keyboard.press("Escape");
  await expect(peek).toBeHidden();
  await expect(item, "the focus is back on the Event").toBeFocused();

  const toast = page.locator("[data-sonner-toast]", { hasText: `${title} updated` });
  await expect(toast, "one Undo for the whole visit").toHaveCount(1);
  await toast.getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => storedEvent(page, title)).toEqual({ date: "2026-11-10", start: "10:00", end: "11:00" });
});

test("an Event in Upcoming opens its Peek", async ({ page }) => {
  const title = `Upcoming dentist ${Date.now()}`;
  await addEvent(page, title);
  await page.goto("/calendar?view=upcoming&d=2026-11-09");
  await workLocally(page);
  await page.getByRole("button", { name: title, exact: true }).click();
  await expectEventPeek(page, title);
});

test("a Peek opened from the Vault leaves the same timing Undo on close", async ({ page }) => {
  const title = `Vault concert ${Date.now()}`;
  const id = await addEvent(page, title);
  await page.goto("/vault");
  await workLocally(page);
  await page.evaluate(
    async ({ coreUrl, id }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      core.openPeek(id);
    },
    { coreUrl: CORE_URL, id },
  );
  const peek = await expectEventPeek(page, title);
  await peek.getByRole("button", { name: "15 minutes earlier" }).click();
  await expect.poll(() => storedEvent(page, title)).toEqual({ date: "2026-11-10", start: "09:45", end: "10:45" });
  await peek.getByRole("button", { name: "Close" }).click();
  const toast = page.locator("[data-sonner-toast]", { hasText: `${title} updated` });
  await toast.getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => storedEvent(page, title)).toEqual({ date: "2026-11-10", start: "10:00", end: "11:00" });
});

test("deleting an Event from its Peek acts at once, with its own Undo", async ({ page }) => {
  const title = `Cancelled ${Date.now()}`;
  await addEvent(page, title);
  await page.locator("[data-focus-key]", { hasText: title }).click();
  const peek = await expectEventPeek(page, title);
  await peek.getByRole("button", { name: "Delete event" }).click();
  await expect(peek).toBeHidden();
  await expect.poll(() => storedEvent(page, title)).toBeNull();
  await page.locator("[data-sonner-toast]", { hasText: `${title} deleted` }).getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => storedEvent(page, title)).toEqual({ date: "2026-11-10", start: "10:00", end: "11:00" });
});
