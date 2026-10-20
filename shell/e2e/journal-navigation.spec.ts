import { test, expect, type Page } from "@playwright/test";
import { TEMPLATE, hasSidebar, linkHeadings, openDay, openPeriod, seedJournal, sidebar, titlesOf, workLocally } from "./support/journal";
import { CORE_URL } from "./support/seed";

/**
 * Journal navigation (spec #204, ADR 0088): getting about the Journal over
 * years of Days. Each ticket of the spec adds its own `describe` here; the
 * seeding and finding helpers are in `support/journal.ts`.
 */

test.describe("Journal navigation · the sidebar stays (#206)", () => {
  // The side column is a desk feature: hidden below `lg`.
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, "the Journal sidebar is hidden below lg");

  test("a date with no Day keeps the calendar, Reviews and On this day, without Links or Backlinks", async ({ page }) => {
    await seedJournal(page, { days: { "2000-02-14": "A year ago today.", "2001-02-13": "The day before." } });

    // A written Day: the sidebar leads with its links.
    await openDay(page, "2001-02-13");
    await expect(sidebar(page)).toBeVisible();
    await expect(sidebar(page).getByText("Backlinks · 0")).toBeVisible();

    await openDay(page, "2001-02-14");
    await expect(page.getByText("No entry for")).toBeVisible();
    const side = sidebar(page);
    await expect(side).toBeVisible();
    await expect(side.getByRole("button", { name: "2001-02-14" })).toHaveAttribute("aria-current", "date");
    await expect(side.getByRole("heading", { name: "Reviews" })).toBeVisible();
    await expect(side.getByRole("link", { name: /^Month February/ })).toBeVisible();
    await expect(side.getByRole("heading", { name: "On this day" })).toBeVisible();
    await expect(side.getByText("A year ago today.")).toBeVisible();
    await expect(linkHeadings(page)).toHaveCount(0);
    expect(await titlesOf(page, "daily")).not.toContain("2001-02-14");
  });

  test("a period with no review keeps its sidebar, without Links or Backlinks", async ({ page }) => {
    await seedJournal(page, { persons: ["Ada Lovelace"], days: { "2001-02-14": "Lunch with [[Ada Lovelace]]." } });

    await openPeriod(page, "2001-02");
    await expect(page.getByText("No review of")).toBeVisible();
    const side = sidebar(page);
    await expect(side).toBeVisible();
    // The period's Reports: who came up in it.
    await expect(side.getByText("Ada Lovelace")).toBeVisible();
    await expect(linkHeadings(page)).toHaveCount(0);
    expect(await titlesOf(page, "month")).not.toContain("2001-02");
  });

  test("paging the calendar to a month whose landing day is unwritten keeps the sidebar", async ({ page }) => {
    await seedJournal(page, { days: { "2001-02-14": "Valentine's." } });
    await openDay(page, "2001-02-14");
    expect(hasSidebar(page)).toBe(true);

    await sidebar(page).getByRole("button", { name: "Previous month" }).click();
    await expect(sidebar(page)).toBeVisible();
    await expect(sidebar(page).getByText(/January 2001/).first()).toBeVisible();

    await sidebar(page).getByRole("button", { name: "Next month" }).click();
    await sidebar(page).getByRole("button", { name: "Next month" }).click();
    await expect(sidebar(page)).toBeVisible();
    await expect(sidebar(page).getByText(/March 2001/).first()).toBeVisible();
  });
});

test.describe("Journal navigation · written Days (#205)", () => {
  // March 1999: a month nothing else in the store uses.
  const DAYS = {
    "1999-03-03": TEMPLATE, // made, never written in
    "1999-03-04": "```daylog\n```\n", // its daylog block alone
    "1999-03-05": `${TEMPLATE}A walk by the river.`,
    "1999-03-07": `${TEMPLATE}Rain.`,
  };

  test("a period's Day list calls a Template-only Day not written", async ({ page }) => {
    await seedJournal(page, { days: DAYS });
    await openPeriod(page, "1999-03");
    const row = (date: string) => page.locator(`a[href="/app/journal?d=${date}"]`).filter({ hasText: "1999" });
    await expect(row("1999-03-05")).toBeVisible();
    await expect(row("1999-03-03")).toContainText("not written");
    await expect(row("1999-03-04")).toContainText("not written");
    await expect(row("1999-03-05")).not.toContainText("not written");
    await expect(row("1999-03-05")).toContainText("A walk by the river.");
  });

  test("the sidebar calendar marks only written Days", async ({ page }) => {
    test.skip(!hasSidebar(page), "the Journal sidebar is hidden below lg");
    await seedJournal(page, { days: DAYS });
    await openDay(page, "1999-03-05");
    // The day cells keep the date as their name; a written Day's title ends "· written".
    const cell = (date: string) => sidebar(page).getByRole("button", { name: date, exact: true });
    await expect(cell("1999-03-07")).toHaveAttribute("title", /written$/);
    await expect(cell("1999-03-05")).toHaveAttribute("title", /written$/);
    await expect(cell("1999-03-03")).not.toHaveAttribute("title", /written/);
    await expect(cell("1999-03-04")).not.toHaveAttribute("title", /written/);
    await expect(cell("1999-03-06")).not.toHaveAttribute("title", /written/);
  });
});

/**
 * Skipping the gaps (#208): an unwritten date's page offers the nearest
 * written Day before and after it, each with its date; Template-only Days are
 * skipped, and a direction with no written Day offers nothing.
 */
test.describe("Journal navigation · the nearest written Days (#208)", () => {
  // February–March 1998: a stretch nothing else in the store uses.
  const DAYS = {
    "1998-02-04": "Marie wrote back.",
    "1998-02-20": TEMPLATE, // made, never written in: skipped
    "1998-03-13": `${TEMPLATE}Rain.`,
  };
  const before = (page: Page) => page.getByRole("link", { name: /^Previous written Day/ });
  const after = (page: Page) => page.getByRole("link", { name: /^Next written Day/ });

  test("an unwritten date between two written Days offers both, and each opens its Day", async ({ page }) => {
    await seedJournal(page, { days: DAYS });
    await openDay(page, "1998-02-25");
    await expect(page.getByRole("button", { name: "Start writing" })).toBeVisible();
    await expect(before(page)).toContainText("1998");
    await expect(after(page)).toContainText("1998");
    await before(page).click();
    await expect(page).toHaveURL(/\?d=1998-02-04$/);
    await expect(page.locator(".cm-content")).toContainText("Marie wrote back.");

    await openDay(page, "1998-02-25");
    await after(page).click();
    await expect(page).toHaveURL(/\?d=1998-03-13$/);
    await expect(page.locator(".cm-content")).toContainText("Rain.");
  });

  test("Template-only Days are skipped", async ({ page }) => {
    await seedJournal(page, { days: DAYS });
    await openDay(page, "1998-02-10");
    await after(page).click();
    await expect(page).toHaveURL(/\?d=1998-03-13$/);
  });

  test("no before ahead of the first written Day, no after past the last", async ({ page }) => {
    await seedJournal(page, { days: DAYS });
    await openDay(page, "1998-01-01");
    await expect(after(page)).toBeVisible();
    await expect(before(page)).toHaveCount(0);

    // After 13 March 1998 the next written Days are the layout seed's (dated today), so look from past them.
    await openDay(page, "2999-01-01");
    await expect(page.getByRole("button", { name: "Start writing" })).toBeVisible();
    await expect(before(page)).toBeVisible();
    await expect(after(page)).toHaveCount(0);
  });
});

/**
 * The palette's date row (ADR 0088, #207): typing a date or a period key puts
 * one row first, in human form; Enter opens that page and makes nothing.
 */
test.describe("Journal navigation · a date typed in the palette (#207)", () => {
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
