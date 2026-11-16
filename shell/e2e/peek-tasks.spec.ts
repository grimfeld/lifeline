import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";
import { openCalendar, pickDate, pickInCalendar } from "./support/date-picker";
import { setTime } from "./support/time-field";

/**
 * Tasks and the Calendar App edit their Documents in a Peek (ADR 0085): each
 * through its own controls, the guarded Fields through its own operations,
 * from wherever the Document was peeked.
 */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

async function peek(page: Page, id: string) {
  await inCore(page, async (core, docId: string) => core.openPeek(docId), id);
  // The first dialog: a Date picker's popover is a later one.
  return page.getByRole("dialog").first();
}

const field = (page: Page, id: string) => inCore(page, async (core, docId: string) => (await core.getDocument(docId))!, id);

test("a Task peeked from the Vault is moved to another day and given notes there", async ({ page }) => {
  const stamp = Date.now();
  await page.goto("/vault");
  await workLocally(page);
  const id = await inCore(
    page,
    async (core, title: string) =>
      (await core.putDocument({ type: "task", title, status: "active", date: "2026-03-02", completedOn: null, recurrence: null, notes: "", tags: [] })).id as string,
    `Call the dentist ${stamp}`,
  );

  const dialog = await peek(page, id);
  await pickDate(page, dialog.getByLabel("Day"), "2026-03-05");
  await dialog.getByLabel("Notes").fill("Ask about the crown");
  await expect.poll(async () => { const d = await field(page, id); return { date: d.date, notes: d.notes }; }).toEqual({ date: "2026-03-05", notes: "Ask about the crown" });

  // The day is optional: Clear puts the Task back in the Unassigned pool, and back.
  await dialog.getByLabel("Day").click();
  await page.getByRole("button", { name: "Clear" }).click();
  await expect(openCalendar(page)).toBeHidden();
  await expect.poll(async () => (await field(page, id)).date).toBeNull();
  await expect(dialog.getByLabel("Day")).toHaveText(/Unassigned/);
  await pickDate(page, dialog.getByLabel("Day"), "2026-03-05");
  await expect.poll(async () => (await field(page, id)).date).toBe("2026-03-05");

  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect.poll(async () => Boolean((await field(page, id)).completedOn)).toBe(true);
  await expect(dialog.getByRole("button", { name: "Not done" })).toBeVisible();
});

test("a Task's Estimate is picked, typed and cleared back to none in its Peek", async ({ page }) => {
  const stamp = Date.now();
  await page.goto("/vault");
  await workLocally(page);
  const id = await inCore(
    page,
    async (core, title: string) =>
      (await core.putDocument({ type: "task", title, status: "active", date: null, completedOn: null, recurrence: null, notes: "", tags: [] })).id as string,
    `Write the report ${stamp}`,
  );

  const dialog = await peek(page, id);
  const estimate = dialog.getByRole("group", { name: "Estimate" });
  await expect(estimate.getByRole("button", { name: "None" })).toHaveAttribute("aria-pressed", "true");

  await estimate.getByRole("button", { name: "1h 30m" }).click();
  await expect.poll(async () => (await field(page, id)).estimate).toBe(90);

  // Any other length is typed, the way it reads.
  const other = estimate.getByRole("textbox");
  await other.fill("2d 8h");
  await other.press("Enter");
  await expect.poll(async () => (await field(page, id)).estimate).toBe(56 * 60);
  await expect(other).toHaveValue("2d 8h");

  // None leaves the Task with no Estimate at all.
  await estimate.getByRole("button", { name: "None" }).click();
  await expect.poll(async () => (await field(page, id)).estimate).toBeNull();
  await expect(other).toHaveValue("");
});

test("a Task is moved by tapping a day in the Move dialog, and Cancel backs out", async ({ page }) => {
  const stamp = Date.now();
  const title = `Renew the passport ${stamp}`;
  await page.goto("/app/tasks");
  await workLocally(page);
  const id = await inCore(
    page,
    async (core, t: string) =>
      (await core.putDocument({ type: "task", title: t, status: "active", date: "2026-03-02", completedOn: null, recurrence: null, notes: "", tags: [] })).id as string,
    title,
  );
  const openMove = async () => {
    const row = page.locator("div").filter({ hasText: title, has: page.getByRole("button", { name: "More" }) }).last();
    await row.getByRole("button", { name: "More" }).click();
    await page.getByRole("menuitem", { name: "Move to day…" }).click();
    const dialog = page.getByRole("dialog", { name: `Move "${title}"` });
    await expect(dialog).toBeVisible();
    return dialog;
  };

  // Cancel backs out with the day unchanged.
  let dialog = await openMove();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  expect((await field(page, id)).date).toBe("2026-03-02");

  // The calendar sits in the dialog itself: no native date input, no Move button.
  dialog = await openMove();
  await expect(dialog.locator('input[type="date"]')).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Move", exact: true })).toHaveCount(0);
  await pickInCalendar(dialog.locator('[data-slot="calendar"]'), "2026-03-09");
  await expect(dialog).toBeHidden();
  await expect(page.getByText(/Moved to .*(9 Mar|Mar 9)/)).toBeVisible();
  await expect.poll(async () => (await field(page, id)).date).toBe("2026-03-09");
});

test("an Event peeked from the Vault gets a time there; an end before its start is the next day's, one equal to it refused", async ({ page }) => {
  const stamp = Date.now();
  await page.goto("/vault");
  await workLocally(page);
  const id = await inCore(
    page,
    async (core, title: string) =>
      (await core.putDocument({ type: "event", title, date: "2026-03-02", endDate: null, start: null, end: null, notes: "", tags: [] })).id as string,
    `Standup ${stamp}`,
  );

  const dialog = await peek(page, id);
  await dialog.getByRole("checkbox", { name: "All day" }).click();
  const start = dialog.getByRole("combobox", { name: "Start" });
  const end = dialog.getByRole("combobox", { name: "End" });
  // Moving the start keeps the length: 09:00–10:00 becomes 10:30–11:30.
  await setTime(start, "10:30");
  await expect.poll(async () => { const d = await field(page, id); return { date: d.date, start: d.start, end: d.end }; }).toEqual({ date: "2026-03-02", start: "10:30", end: "11:30" });
  await expect(dialog.getByText(/^until .+ · 1h$/)).toBeVisible();
  await setTime(end, "11:00");
  await expect.poll(async () => { const d = await field(page, id); return { date: d.date, start: d.start, end: d.end }; }).toEqual({ date: "2026-03-02", start: "10:30", end: "11:00" });
  await expect(dialog.getByText(/^until .+ · 30m$/)).toBeVisible();

  // An End earlier than the Start rolls to the next day (ADR 0090), and the end day shows beside it.
  await setTime(end, "09:00");
  await expect(dialog.getByText(/^until Tue.* · 22h 30m$/)).toBeVisible();
  await expect.poll(async () => { const d = await field(page, id); return { endDate: d.endDate, end: d.end }; }).toEqual({ endDate: "2026-03-03", end: "09:00" });

  await setTime(end, "10:30");
  await expect(dialog.getByText("End must be after start")).toBeVisible();
  await page.waitForTimeout(800);
  expect((await field(page, id)).end).toBe("09:00");
});

test("an Event peeked from the Vault takes Notes and Tags through the Event Form, written as they change", async ({ page }) => {
  const stamp = Date.now();
  await page.goto("/vault");
  await workLocally(page);
  const id = await inCore(
    page,
    async (core, title: string) =>
      (await core.putDocument({ type: "event", title, date: "2026-03-02", endDate: null, start: null, end: null, notes: "", tags: [] })).id as string,
    `Review ${stamp}`,
  );
  const dialog = await peek(page, id);
  const form = dialog.getByRole("group", { name: "Event" });
  await form.getByLabel("Notes").fill("Room 4");
  await form.getByPlaceholder("Add tag…").fill("work");
  await form.getByPlaceholder("Add tag…").press("Enter");
  await expect.poll(async () => { const d = await field(page, id); return { notes: d.notes, tags: d.tags }; }).toEqual({ notes: "Room 4", tags: ["work"] });
});

/**
 * A People field in a Peek (#446, #447): a Person picked by alias is stored at
 * once, removed, picked again, and then shows on their Timeline via the field.
 */
async function pickAndRemovePerson(page: Page, id: string, title: string, label: "With" | "For", key: "with" | "for") {
  const anne = await inCore(page, async (core) => (await core.createDocument({ type: "contacts_person", title: "Anne Verhoeven", fields: { aliases: ["Annie"] } })).id as string, null);
  const stored = async () => ((await field(page, id))[key] as string[] | undefined) ?? [];
  const dialog = await peek(page, id);
  const input = dialog.getByRole("combobox", { name: label });
  // Between Notes and Tags, as in the dialogs.
  const top = async (loc: ReturnType<typeof dialog.getByLabel>) => (await loc.boundingBox())!.y;
  const [notesY, fieldY, tagsY] = [await top(dialog.getByLabel("Notes")), await top(input), await top(dialog.getByPlaceholder("Add tag…"))];
  expect(notesY).toBeLessThan(fieldY);
  expect(fieldY).toBeLessThan(tagsY);
  const pick = async () => {
    await input.fill("Annie");
    await page.getByRole("option", { name: /Anne Verhoeven/ }).click();
    await expect.poll(stored).toEqual([anne]);
  };

  await pick();
  await expect(dialog.getByText("Anne Verhoeven")).toBeVisible();
  await dialog.getByRole("button", { name: "Remove Anne Verhoeven" }).click();
  await expect.poll(stored).toEqual([]);
  await pick();

  await page.goto(`/app/people/person/${anne}`);
  await workLocally(page);
  const timeline = page.getByRole("region", { name: "Timeline" });
  await expect(timeline).toContainText(title);
  await expect(timeline).toContainText(`via ${label}`);
}

test("an Event peeked from the Vault gets People in With by alias, saved at once, and shows on their Timeline", async ({ page }) => {
  const title = `Dinner ${Date.now()}`;
  await page.goto("/vault");
  await workLocally(page);
  const id = await inCore(
    page,
    async (core, t: string) => (await core.putDocument({ type: "event", title: t, date: "2026-03-02", endDate: null, start: null, end: null, notes: "", tags: [] })).id as string,
    title,
  );
  await pickAndRemovePerson(page, id, title, "With", "with");
});

test("a Task's For is edited in its Peek: a Person picked by alias is stored at once, removed, and added again onto their Timeline", async ({ page }) => {
  const title = `Buy a present ${Date.now()}`;
  await page.goto("/vault");
  await workLocally(page);
  const id = await inCore(
    page,
    async (core, t: string) => (await core.putDocument({ type: "task", title: t, status: "active", date: null, completedOn: null, recurrence: null, notes: "", tags: [] })).id as string,
    title,
  );
  await pickAndRemovePerson(page, id, title, "For", "for");
});

test("an Event's Peek nudges the Start, sets a length and moves to Tomorrow, written at once, an overnight End on the next day", async ({ page }) => {
  const stamp = Date.now();
  await page.goto("/vault");
  await workLocally(page);
  const id = await inCore(
    page,
    async (core, title: string) =>
      (await core.putDocument({ type: "event", title, date: "2099-03-02", endDate: null, start: "09:00", end: "10:00", notes: "", tags: [] })).id as string,
    `Quick timing ${stamp}`,
  );
  const dialog = await peek(page, id);
  const stored = async () => { const d = await field(page, id); return { date: d.date, endDate: d.endDate, start: d.start, end: d.end }; };

  await dialog.getByRole("button", { name: "15 minutes later" }).click();
  await expect.poll(stored).toEqual({ date: "2099-03-02", endDate: null, start: "09:15", end: "10:15" });
  await dialog.getByRole("button", { name: "15 minutes earlier" }).click();
  await dialog.getByRole("button", { name: "15 minutes earlier" }).click();
  await expect.poll(stored).toEqual({ date: "2099-03-02", endDate: null, start: "08:45", end: "09:45" });

  await dialog.getByRole("group", { name: "Length", exact: true }).getByRole("button", { name: "2h", exact: true }).click();
  await expect.poll(stored).toEqual({ date: "2099-03-02", endDate: null, start: "08:45", end: "10:45" });

  await dialog.getByRole("button", { name: "Tomorrow" }).click();
  await expect.poll(async () => (await stored()).date).not.toBe("2099-03-02");
  expect(await stored()).toMatchObject({ start: "08:45", end: "10:45" });

  // An End earlier than the Start lands on the next day (ADR 0090).
  await setTime(dialog.getByRole("combobox", { name: "End" }), "07:00");
  await expect.poll(async () => (await stored()).endDate).not.toBeNull();

  // There is one set of day and time controls, never two.
  await expect(dialog.getByRole("combobox", { name: "Start" })).toHaveCount(1);
  await expect(dialog.getByRole("button", { name: "15 minutes earlier" })).toHaveCount(1);
});

// --- On a phone the Peek is a bottom sheet, and what was tapped is scrolled above it (ADR 0124) ---

test.describe("on a phone, what was tapped on the hours is scrolled above the Peek's sheet", () => {
  test.skip(({ isMobile }) => !isMobile, "the bottom sheet is the phone's");

  /** Events titled `title` on each day from `from` for `days` days, 10:00–11:00. */
  const addEvents = (page: Page, title: string, from: string, days: number) =>
    inCore(
      page,
      async (core, a: { title: string; from: string; days: number }) => {
        for (let i = 0; i < a.days; i++) await core.putDocument({ type: "event", title: `${a.title} ${i}`, notes: "", date: core.addDays(a.from, i), endDate: null, start: "10:00", end: "11:00", tags: [] });
      },
      { title, from, days },
    );

  /** Tapped from low on the screen, the item ends up above the sheet once it has settled: wholly, or (one taller than the room above the sheet) from its start. */
  async function tapAndExpectAboveSheet(page: Page, item: ReturnType<Page["locator"]>, title: string) {
    await item.evaluate((el) => el.scrollIntoView({ block: "end" }));
    const before = (await item.boundingBox())!;
    expect(before.y, "the item starts low on the screen, where the sheet will cover it").toBeGreaterThan(780 / 2);
    // Held before the tap: once the sheet is up, the page behind it is hidden from role queries.
    const held = (await item.elementHandle())!;
    await item.tap();
    const sheet = page.getByRole("dialog", { name: title, exact: true });
    await expect(sheet.getByRole("combobox", { name: "Start" })).toBeVisible();
    await expect
      .poll(async () => {
        const [a, s] = [await held.boundingBox(), await sheet.boundingBox()];
        return !!a && !!s && a.y >= 0 && a.y + Math.min(a.height, 24) <= s.y + 1 ? true : JSON.stringify({ a, s });
      })
      .toBe(true);
  }

  test("from Upcoming", async ({ page }) => {
    const stamp = `Upcoming filler ${Date.now()}`;
    await page.goto("/calendar?view=upcoming&d=2026-11-09");
    await workLocally(page);
    await addEvents(page, stamp, "2026-11-09", 21);
    await tapAndExpectAboveSheet(page, page.getByRole("button", { name: `${stamp} 20`, exact: true }), `${stamp} 20`);
  });

  test("from the Month", async ({ page }) => {
    const stamp = `Month late ${Date.now()}`;
    await page.goto("/calendar?view=month&d=2026-11-09");
    await workLocally(page);
    await addEvents(page, stamp, "2026-11-30", 1);
    await tapAndExpectAboveSheet(page, page.locator("[data-focus-key]", { hasText: `${stamp} 0` }), `${stamp} 0`);
  });

  test("from the Agenda Card", async ({ page }) => {
    const stamp = `Agenda late ${Date.now()}`;
    await page.goto("/screen/e2elongcontent1");
    await workLocally(page);
    const today = await inCore(page, async (core) => core.todayStr(), null);
    await addEvents(page, stamp, today, 1);
    const card = page.locator('[data-slot="card"]').filter({ has: page.getByText("Today's agenda", { exact: true }) });
    await tapAndExpectAboveSheet(page, card.getByRole("button").filter({ hasText: `${stamp} 0` }), `${stamp} 0`);
  });

  test("from the Week", async ({ page }) => {
    const stamp = `Week late ${Date.now()}`;
    await page.goto("/calendar?view=week&d=2026-11-09");
    await workLocally(page);
    await inCore(page, async (core, title: string) => void (await core.putDocument({ type: "event", title, notes: "", date: "2026-11-10", endDate: null, start: "21:00", end: "22:00", tags: [] })), stamp);
    await tapAndExpectAboveSheet(page, page.locator('[data-col="2026-11-10"] [data-focus-key]', { hasText: stamp }), stamp);
  });
});
