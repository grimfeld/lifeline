import { test, expect, type Page } from "@playwright/test";
import { CORE_URL } from "./support/seed";
import { setTime } from "./support/time-field";

/**
 * Times typed into the kit's Time field, never the browser's time input, at the
 * one call site nothing else covers: an Event template's usual start. The Time
 * blocker dialog's Start and End and the Peek's Start and End are covered in
 * event-span.spec.ts; typing, the arrows and the list in the Time field's own
 * tests (`packages/ui`).
 */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

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
