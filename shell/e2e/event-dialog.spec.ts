import { test, expect, type Page } from "@playwright/test";
import { CORE_URL } from "./support/seed";
import { pickDate } from "./support/date-picker";
import { setTime } from "./support/time-field";
import { encodeHandoff } from "@lifeline/handoff";

/**
 * The Event dialog: one Form with the Event's Peek, an Intake that opens it
 * prefilled, its quick controls, and its Event templates. Its typed Start and
 * End are event-span.spec.ts's first case; the defaults and the kept length
 * are `eventForm.test.ts`'s.
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
  expect(adding).toEqual(["Day", "Start", "End", "All day", "Notes", "With", "At", "Tags"]);
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

test("the Event dialog's quick controls change its draft: earlier/later, a length, Tomorrow; nothing is stored until Add", async ({ page }) => {
  const title = `Quick draft ${Date.now()}`;
  await page.goto("/app/events");
  await workLocally(page);
  await page.getByRole("button", { name: "New event" }).click();
  const dialog = page.getByRole("dialog", { name: "New event" });
  await dialog.getByLabel("Title").fill(title);
  await pickDate(page, dialog.getByLabel("Day", { exact: true }), "2026-11-10");
  await setTime(dialog.getByRole("combobox", { name: "Start" }), "14:00");

  await dialog.getByRole("button", { name: "15 minutes later" }).click();
  await expect(dialog.getByText(/^until .+ · 1h$/), "the length is kept").toBeVisible();
  await dialog.getByRole("group", { name: "Length", exact: true }).getByRole("button", { name: "1h 30m", exact: true }).click();
  await expect(dialog.getByText(/^until .+ · 1h 30m$/)).toBeVisible();
  await dialog.getByRole("button", { name: "Tomorrow" }).click();
  expect(await storedEvent(page, title), "a draft is not written").toBeNull();

  await dialog.getByRole("button", { name: "Add event" }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(async () => { const e = await storedEvent(page, title); return e && { start: e.start, end: e.end }; }).toEqual({ start: "14:15", end: "15:45" });
  expect((await storedEvent(page, title))!.date).not.toBe("2026-11-10");
});

const addTemplate = (page: Page, title: string, over: Record<string, unknown> = {}) =>
  page.evaluate(
    async ({ coreUrl, title, over }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      await core.putDocument({ type: "event_template", title, notes: "Bring a towel", defaultStart: "18:00", durationMin: 90, allDay: false, tags: ["health"], ...over });
    },
    { coreUrl: CORE_URL, title, over },
  );

test("the Event dialog lists Event templates above the Form, and picking one fills it without saving (#535)", async ({ page }) => {
  const template = `Gym ${Date.now()}`;
  await page.goto("/app/events");
  await workLocally(page);
  // A fresh store may come with templates: clear them to see the empty case.
  await page.evaluate(async (coreUrl) => {
    const core = await import(/* @vite-ignore */ coreUrl);
    for (const t of await core.documentsOf("event_template")) await core.removeDocument(t.id);
  }, CORE_URL);

  await page.getByRole("button", { name: "New event" }).click();
  const dialog = page.getByRole("dialog", { name: "New event" });
  await expect(dialog.getByRole("textbox", { name: "Title" })).toBeVisible();
  await expect(dialog.getByRole("group", { name: "Event templates" }), "none: nothing shown").toHaveCount(0);
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();

  await addTemplate(page, template);
  await page.getByRole("button", { name: "New event" }).click();
  const templates = dialog.getByRole("group", { name: "Event templates" });
  await expect(templates).toBeVisible();
  const above = await templates.evaluate((el) => el.compareDocumentPosition(el.closest('[role="dialog"]')!.querySelector('[role="group"][aria-label="Event"]')!) & Node.DOCUMENT_POSITION_FOLLOWING);
  expect(above, "above the Form").toBeTruthy();

  await templates.getByRole("button", { name: template }).click();
  await expect(dialog.getByLabel("Title")).toHaveValue(template);
  await expect(dialog.getByRole("combobox", { name: "Start" })).toHaveValue(/^6:00|^18:00/);
  await expect(dialog.getByText(/· 1h 30m$/)).toBeVisible();
  await expect(dialog.getByLabel("Notes")).toHaveValue("Bring a towel");
  expect(await storedEvent(page, template), "nothing saved before Add").toBeNull();

  await setTime(dialog.getByRole("combobox", { name: "Start" }), "19:00");
  await dialog.getByRole("button", { name: "Add event" }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => storedEvent(page, template)).toMatchObject({ start: "19:00", end: "20:30" });
});
// timing run for #633; not to merge
