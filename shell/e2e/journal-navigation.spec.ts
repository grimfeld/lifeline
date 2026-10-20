import { test, expect, type Page } from "@playwright/test";
import { CORE_URL } from "./support/seed";

/**
 * Journal navigation (spec #204): getting years back in the Journal — written
 * Days (CONTEXT.md "Day"), the sidebar calendar, typed dates, skipping gaps.
 * Seeds its Days in March 1999, a month nothing else in the store uses.
 */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

/** The Day's own Template, nothing typed into it (DAILY_TEMPLATE). */
const TEMPLATE = "```daylog\n```\n\n### Histoire du jour\n\n---\n### Citation du jour\n\n---\n### Quoi de neuf ?\n\n---\n### Et maintenant ?\n\n";

/** Make a Day for each `date → body`, straight in the store. */
async function seedDays(page: Page, days: Record<string, string>) {
  await page.goto("/app/journal");
  await workLocally(page);
  await page.evaluate(
    async ({ coreUrl, days }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      for (const [title, body] of Object.entries(days)) await core.createDocument({ type: "daily", title, body });
    },
    { coreUrl: CORE_URL, days },
  );
}

test.describe("Written Days", () => {
  const DAYS = {
    "1999-03-03": TEMPLATE, // made, never written in
    "1999-03-04": "```daylog\n```\n", // its daylog block alone
    "1999-03-05": `${TEMPLATE}A walk by the river.`,
    "1999-03-07": `${TEMPLATE}Rain.`,
  };

  test("a period's Day list calls a Template-only Day not written", async ({ page }) => {
    await seedDays(page, DAYS);
    await page.goto("/app/journal/p/1999-03");
    await workLocally(page);
    const row = (date: string) => page.locator(`a[href="/app/journal?d=${date}"]`).filter({ hasText: "1999" });
    await expect(row("1999-03-05")).toBeVisible();
    await expect(row("1999-03-03")).toContainText("not written");
    await expect(row("1999-03-04")).toContainText("not written");
    await expect(row("1999-03-05")).not.toContainText("not written");
    await expect(row("1999-03-05")).toContainText("A walk by the river.");
  });

  test("the sidebar calendar marks only written Days", async ({ page, isMobile }) => {
    test.skip(isMobile, "the Journal's sidebar is a desk thing (hidden below lg)");
    await seedDays(page, DAYS);
    await page.goto("/app/journal?d=1999-03-05");
    await workLocally(page);
    const calendar = page.getByRole("complementary", { name: "Journal" });
    const cell = (date: string) => calendar.getByRole("button", { name: date, exact: true });
    await expect(cell("1999-03-07")).toHaveAttribute("title", /written$/);
    await expect(cell("1999-03-05")).toHaveAttribute("title", /written$/);
    await expect(cell("1999-03-03")).not.toHaveAttribute("title", /written/);
    await expect(cell("1999-03-04")).not.toHaveAttribute("title", /written/);
    await expect(cell("1999-03-06")).not.toHaveAttribute("title", /written/);
  });
});
