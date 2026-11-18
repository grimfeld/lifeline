import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";
import { workLocally } from "./support/journal";
import { openPalette } from "./support/palette";
import { setTime } from "./support/time-field";

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
  // The Event's Peek lists the band; its own Peek says "Before <Event>" and offers Detach.
  const bandId = await inCore(page, async (core, e: string) => ((await core.documentsOf("time_blocker")).find((b) => b.attachedTo === e)!.id as string), id);
  await inCore(page, async (core, docId: string) => core.openPeek(docId), id);
  await page.getByRole("dialog").first().getByRole("link", { name: travel, exact: true }).click();
  const bandPeek = page.getByRole("dialog").first();
  await expect(bandPeek.getByRole("link", { name: title, exact: true })).toBeVisible();
  await expect(bandPeek.getByText(new RegExp(`^Before ${title}$`))).toBeVisible();
  await bandPeek.getByRole("button", { name: "Detach", exact: true }).click();
  await expect.poll(() => attached(page, id)).toEqual([]);
  await expect(bandPeek.getByRole("button", { name: "Detach" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(bandPeek).toBeHidden();

  // Dragged another hour later, the detached band stays where it was.
  const y = (await event.boundingBox())!;
  await page.mouse.move(x, y.y + 10);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(x, y.y + 10 + (HOUR_PX * i) / 8);
  await page.mouse.up();
  await expect.poll(() => stored(page, id)).toEqual({ date: "2025-11-10", start: "13:00", end: "14:00" });
  expect(await stored(page, bandId)).toEqual({ date: "2025-11-10", start: "11:30", end: "12:00" });

  // And the Schedule paints it there: the detached band ends an hour and a half above the Event.
  await expect.poll(async () => Math.round(((await event.boundingBox())!.y - (await band.locator("..").boundingBox())!.y) / HOUR_PX * 2) / 2).toBe(1.5);
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

test("a new Event's dialog attaches the blockers picked from Before… and After… as it is added", async ({ page }) => {
  const stamp = Date.now();
  const title = `Interview ${stamp}`;
  const travel = `Travel 30 ${stamp}`;
  await page.goto("/app/events");
  await workLocally(page);
  await inCore(page, async (core, t: string) => core.putDocument({ type: "blocker_template", title: t, durationMin: 30, color: null, tags: [] }), travel);
  await openPalette(page);
  await page.getByPlaceholder("Type a command or search…").fill("Add event");
  await page.getByRole("option", { name: "Add event Calendar", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "New event" });
  await dialog.getByLabel("Title").fill(title);
  await setTime(dialog.getByRole("combobox", { name: "Start" }), "14:00");
  for (const side of ["Before…", "After…"]) {
    await dialog.getByRole("button", { name: side, exact: true }).click();
    await page.getByRole("menuitem", { name: new RegExp(`^${travel}`) }).click();
  }
  await expect(dialog.getByRole("list", { name: "Blockers to attach" }).getByRole("listitem")).toHaveCount(2);
  await dialog.getByRole("button", { name: "Add event" }).click();
  await expect(dialog).toBeHidden();

  const id = await inCore(page, async (core, t: string) => ((await core.documentsOf("event")).find((d) => d.title === t)?.id as string | undefined) ?? "", title);
  await expect
    .poll(async () => (await attached(page, id)).map((b) => [b.side, b.start, b.end]).sort())
    .toEqual([
      ["after", "15:00", "15:30"],
      ["before", "13:30", "14:00"],
    ]);
});
