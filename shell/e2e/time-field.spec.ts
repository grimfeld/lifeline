import { test, expect, type Page } from "@playwright/test";
import { CORE_URL } from "./support/seed";
import { setTime } from "./support/time-field";

/**
 * Times typed or picked from the kit's Time field, never the browser's time
 * input: the Time blocker dialog's From and To, an Event template's usual start
 * and the Hours editor's Start.
 */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

/** A weekly blocker, 09:00–17:00, put straight into the store; its id. */
async function seedBlocker(page: Page, title: string): Promise<string> {
  return page.evaluate(
    async ({ coreUrl, title }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      const row = await core.putDocument({ type: "time_blocker", title, date: null, weekdays: [1, 2, 3, 4, 5], start: "09:00", end: "17:00", color: null, active: true, tags: [] });
      return row.id as string;
    },
    { coreUrl: CORE_URL, title },
  );
}

const storedBlocker = (page: Page, id: string) =>
  page.evaluate(
    async ({ coreUrl, id }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      const b = (await core.documentsOf("time_blocker")).find((x: { id: string }) => x.id === id);
      return b ? `${b.start}–${b.end}` : null;
    },
    { coreUrl: CORE_URL, id },
  );

async function editBlocker(page: Page, title: string) {
  await page.goto("/app/events?tab=blockers");
  await workLocally(page);
  const id = await seedBlocker(page, title);
  const row = page.locator('[data-slot="card"]').filter({ hasText: title });
  await row.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  return { id, dialog: page.getByRole("dialog", { name: "Edit time blocker" }) };
}

test("a Time blocker's start is typed into its Time field", async ({ page }) => {
  const title = `Office ${Date.now()}`;
  const { id, dialog } = await editBlocker(page, title);
  const start = dialog.getByRole("combobox", { name: "From" });
  await expect(dialog.locator('input[type="time"]'), "no native time input left").toHaveCount(0);

  await setTime(start, "930");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect.poll(() => storedBlocker(page, id)).toBe("09:30–17:00");
});

test("text that isn't a time reverts; arrows step a quarter hour; the list picks", async ({ page }) => {
  const title = `Studio ${Date.now()}`;
  const { id, dialog } = await editBlocker(page, title);
  const end = dialog.getByRole("combobox", { name: "To" });
  const shown = await end.inputValue();

  await end.fill("lunchtime");
  await end.press("Enter");
  await expect(end).toHaveValue(shown);

  await end.press("ArrowUp");
  await end.press("ArrowUp");
  await expect(end).not.toHaveValue(shown);

  await end.click();
  const list = page.getByRole("listbox", { name: "Times" });
  await expect(list.getByRole("option", { selected: true })).toBeInViewport();
  await list.locator('[data-time="18:45"]').click();
  await expect(list).toBeHidden();
  await expect(dialog, "picking a time leaves the dialog open").toBeVisible();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect.poll(() => storedBlocker(page, id)).toBe("09:00–18:45");
});

test("an Event template's usual start is typed into its Time field", async ({ page }) => {
  const title = `Standup ${Date.now()}`;
  await page.goto("/app/events?tab=templates");
  await workLocally(page);
  await page.getByRole("button", { name: "New event template" }).click();
  const dialog = page.getByRole("dialog", { name: "New event template" });
  await dialog.getByRole("textbox", { name: "Title" }).fill(title);
  await expect(dialog.locator('input[type="time"]'), "no native time input left").toHaveCount(0);
  await setTime(dialog.getByRole("combobox", { name: "Usual start (optional)" }), "9:15am");
  await dialog.getByRole("button", { name: "Add template" }).click();
  await expect
    .poll(() =>
      page.evaluate(
        async ({ coreUrl, title }) => {
          const core = await import(/* @vite-ignore */ coreUrl);
          return (await core.documentsOf("event_template")).find((t: { title: string }) => t.title === title)?.defaultStart ?? null;
        },
        { coreUrl: CORE_URL, title },
      ),
    )
    .toBe("09:15");
});

test("an Event's start is typed into the Hours editor's Time field and written at once", async ({ page }) => {
  const title = `Nudge me ${Date.now()}`;
  await page.goto("/calendar?view=upcoming");
  await workLocally(page);
  const id = await page.evaluate(
    async ({ coreUrl, title }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      const d = new Date();
      const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return (await core.putDocument({ type: "event", title, date: day, endDate: null, start: "23:00", end: "23:30", notes: "", tags: [] })).id as string;
    },
    { coreUrl: CORE_URL, title },
  );
  await page.getByText(title).click();
  const start = page.getByRole("combobox", { name: "Start" });
  await expect(page.locator('input[type="time"]'), "no native time input left").toHaveCount(0);
  await setTime(start, "2230");
  await expect
    .poll(() =>
      page.evaluate(
        async ({ coreUrl, id }) => {
          const core = await import(/* @vite-ignore */ coreUrl);
          const e = await core.getDocument(id);
          return `${e.start}–${e.end}`;
        },
        { coreUrl: CORE_URL, id },
      ),
    )
    .toBe("22:30–23:00");
});
