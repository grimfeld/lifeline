import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";
import { workLocally } from "./support/journal";

/**
 * An attached blocker (CONTEXT.md, #497): picked from a timed Event's Peek,
 * flush against the Event, and moved with it when the Event is dragged on the
 * Schedule.
 */

// The week of Mon 10 Nov 2025, a year before any run's seed (as in event-span.spec.ts):
// the seed's Events and Blockers sit around the real today.
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2025-11-10T08:00:00"));
});

const HOUR_PX = 56;

const stored = (page: Page, id: string) =>
  inCore(
    page,
    async (core, docId: string) => {
      const d = (await core.getDocument(docId)) as { date: string; endDate: string | null; start: string; end: string } | undefined;
      return d ? { date: d.date, start: d.start, end: d.end } : null;
    },
    id,
  );

/** The one-off blockers attached to an Event, as stored. */
const attached = (page: Page, eventId: string) =>
  inCore(
    page,
    async (core, id: string) =>
      (await core.documentsOf("time_blocker"))
        .filter((b) => b.attachedTo === id)
        .map((b) => ({ title: b.title, side: b.side, date: b.date, start: b.start, end: b.end })),
    eventId,
  );

test("Travel 30 attached before an Event from its Peek follows the Event when it is dragged on the Schedule", async ({ page, isMobile }) => {
  test.skip(isMobile, "a mouse drag; a phone drags after a long press, through the same drop");
  const stamp = Date.now();
  const title = `Dentist ${stamp}`;
  const travel = `Travel 30 ${stamp}`;
  await page.goto("/calendar?view=week&d=2025-11-10");
  await workLocally(page);
  const id = await inCore(
    page,
    async (core, t: { title: string; travel: string }) => {
      await core.putDocument({ type: "blocker_template", title: t.travel, durationMin: 30, color: null, tags: [] });
      return (await core.putDocument({ type: "event", title: t.title, date: "2025-11-10", endDate: null, start: "11:00", end: "12:00", notes: "", tags: [] })).id as string;
    },
    { title, travel },
  );

  // Before… on the Event's Peek lists the Blocker templates.
  await inCore(page, async (core, docId: string) => core.openPeek(docId), id);
  const peek = page.getByRole("dialog").first();
  await peek.getByRole("button", { name: "Before…", exact: true }).click();
  await page.getByRole("menuitem", { name: new RegExp(`^${travel}`) }).click();
  await expect.poll(() => attached(page, id)).toEqual([{ title: travel, side: "before", date: "2025-11-10", start: "10:30", end: "11:00" }]);
  await page.keyboard.press("Escape");
  await expect(peek).toBeHidden();

  // Dragged an hour later on the Schedule, the band follows: still flush before it.
  const monday = page.locator('[data-col="2025-11-10"]');
  const event = monday.getByTitle(title, { exact: false });
  const band = monday.getByText(travel, { exact: true });
  await expect(band).toBeAttached();
  await event.scrollIntoViewIfNeeded();
  const box = (await event.boundingBox())!;
  const x = box.x + box.width / 2;
  await page.mouse.move(x, box.y + 10);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(x, box.y + 10 + (HOUR_PX * i) / 8);
  await page.mouse.up();
  await expect.poll(() => stored(page, id)).toEqual({ date: "2025-11-10", start: "12:00", end: "13:00" });
  await expect.poll(() => attached(page, id)).toEqual([{ title: travel, side: "before", date: "2025-11-10", start: "11:30", end: "12:00" }]);
  // And the Schedule paints it there: its band ends where the Event now starts.
  await expect.poll(async () => Math.round(((await event.boundingBox())!.y - (await band.locator("..").boundingBox())!.y) / HOUR_PX * 2) / 2).toBe(0.5);
});

test("an all-day Event's Peek offers no Before… or After…", async ({ page }) => {
  await page.goto("/vault");
  await workLocally(page);
  const id = await inCore(
    page,
    async (core, title: string) => (await core.putDocument({ type: "event", title, date: "2025-11-10", endDate: null, start: null, end: null, notes: "", tags: [] })).id as string,
    `Fair ${Date.now()}`,
  );
  await inCore(page, async (core, docId: string) => core.openPeek(docId), id);
  const peek = page.getByRole("dialog").first();
  await expect(peek.getByRole("checkbox", { name: "All day" })).toBeChecked();
  await expect(peek.getByRole("button", { name: "Before…", exact: true })).toHaveCount(0);
  await expect(peek.getByRole("button", { name: "After…", exact: true })).toHaveCount(0);
});
