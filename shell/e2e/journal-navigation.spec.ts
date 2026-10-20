import { test, expect } from "@playwright/test";
import { hasSidebar, linkHeadings, openDay, openPeriod, seedJournal, sidebar, titlesOf } from "./support/journal";

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
