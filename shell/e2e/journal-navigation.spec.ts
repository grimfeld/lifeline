import { test, expect, type Page } from "@playwright/test";
import { CORE_URL } from "./support/seed";

/**
 * Journal navigation (spec #204): getting years back in the Journal.
 */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

/** Titles of every stored Document of `type`. */
async function titlesOf(page: Page, type: string): Promise<string[]> {
  return page.evaluate(
    async ({ coreUrl, type }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      return ((await core.documentsOf(type)) as { title: string }[]).map((d) => d.title);
    },
    { coreUrl: CORE_URL, type },
  );
}

/**
 * The palette's date row (ADR 0088, #207): typing a date or a period key puts
 * one row first, in human form; Enter opens that page and makes nothing.
 */
test.describe("Journal navigation: a date typed in the palette", () => {
  // The palette is opened with Mod+K, on the desk only (ADR 0021).
  test.skip(({ isMobile }) => isMobile, "the palette is not opened on a phone");
  // Labels read as in the spec ("Tuesday 14 March 2023"), whatever this machine's locale.
  test.use({ locale: "en-GB" });

  async function typeInPalette(page: Page, query: string) {
    await page.keyboard.press("Control+k");
    await page.getByRole("dialog").getByRole("combobox").fill(query);
  }

  const options = (page: Page) => page.getByRole("dialog").getByRole("option");
  /** What a date row reads as: a weekday and date, a Week, a Month, a Quarter or a Year — then the Journal. */
  const DATE_ROW = /^\s*(\w+day \d+ \w+ \d{4}|Week \d+, \d{4}|\w+ \d{4}|Q\d \d{4}|\d{4})\s*Journal\s*$/;

  const FORMS = [
    { query: "2023-03-14", label: "Tuesday 14 March 2023", url: "/app/journal?d=2023-03-14", type: "daily" },
    { query: "2023-W11", label: "Week 11, 2023", url: "/app/journal/p/2023-W11", type: "week" },
    { query: "2023-03", label: "March 2023", url: "/app/journal/p/2023-03", type: "month" },
    { query: "2023-Q1", label: "Q1 2023", url: "/app/journal/p/2023-Q1", type: "quarter" },
    { query: "2023", label: "2023", url: "/app/journal/p/2023", type: "year" },
  ];

  for (const form of FORMS) {
    test(`${form.query} offers ${form.label} first, and Enter opens it from any page without making a Document`, async ({ page }) => {
      await page.goto("/screens");
      await workLocally(page);
      await typeInPalette(page, form.query);
      await expect(options(page).first()).toContainText(form.label);
      await expect(options(page).first()).toHaveAttribute("aria-selected", "true");
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL((u) => u.pathname + u.search === form.url);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(await titlesOf(page, form.type)).not.toContain(form.query);
    });
  }

  test("2023 ranks above a Document and a Screen called 2023", async ({ page }) => {
    await page.goto("/screens");
    await workLocally(page);
    await page.evaluate(
      async ({ coreUrl }) => {
        const core = await import(/* @vite-ignore */ coreUrl);
        await core.createDocument({ type: "thought", title: "2023", body: "A thought called 2023." });
        await core.put("screens", { id: "e2e-jn-2023", name: "2023", layout: [], sort: 1, workspace: core.currentWorkspaceId() });
      },
      { coreUrl: CORE_URL },
    );
    await typeInPalette(page, "2023");
    // The Screen called 2023 is matched too: the Year's row still comes first.
    await expect(page.getByRole("option", { name: "2023", exact: true })).toBeVisible();
    await expect(options(page).first()).toHaveAccessibleName("2023 Journal");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL((u) => u.pathname === "/app/journal/p/2023");
  });

  test("what the calendar doesn't have, and words, offer no date row", async ({ page }) => {
    await page.goto("/screens");
    await workLocally(page);
    await page.keyboard.press("Control+k");
    const query = page.getByRole("dialog").getByRole("combobox");
    for (const junk of ["2023-13", "2023-02-30", "2023-W60", "2023-Q5", "hello", "2023-W53"]) {
      await query.fill(junk);
      // Other rows may still match the text loosely; none is a Journal page in human form.
      await expect(options(page).filter({ hasText: DATE_ROW })).toHaveCount(0);
    }
    // 2020 had a 53rd ISO week.
    await query.fill("2020-W53");
    await expect(options(page).first()).toContainText("Week 53, 2020");
  });
});
