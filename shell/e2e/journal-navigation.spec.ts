import { test, expect, type Page } from "@playwright/test";
import { openPalette } from "./support/palette";
import { TEMPLATE, calendar, calendarTile, expectCalendarAt, linkHeadings, openDay, openPeriod, seedJournal, sidebar, titlesOf, workLocally } from "./support/journal";
import { CORE_URL } from "./support/seed";

/**
 * Journal navigation (spec #204, ADR 0088): getting about the Journal over
 * years of Days. Each ticket of the spec adds its own `describe` here; the
 * seeding and finding helpers are in `support/journal.ts`.
 */

test.describe("Journal navigation · the sidebar stays (#206)", () => {
  // The side column is a desk feature: hidden below `lg`.

  test("a date with no Day, and a period with no review, keep the calendar, Reviews and On this day, without Links or Backlinks", async ({ page }) => {
    await seedJournal(page, {
      persons: ["Ada Lovelace"],
      days: { "2000-02-14": "A year ago today.", "2001-02-13": "Lunch with [[Ada Lovelace]]." },
    });

    // A written Day: the sidebar leads with its links.
    await openDay(page, "2001-02-13");
    await expect(sidebar(page)).toBeVisible();
    await expect(sidebar(page).getByText("Backlinks · 0")).toBeVisible();

    await openDay(page, "2001-02-14");
    await expect(page.getByText("Nothing written on")).toBeVisible();
    const side = sidebar(page);
    await expect(side).toBeVisible();
    await expect(side.getByRole("button", { name: "2001-02-14" })).toHaveAttribute("aria-current", "date");
    await expect(side.getByRole("heading", { name: "Reviews" })).toBeVisible();
    await expect(side.getByRole("link", { name: /^Month February/ })).toBeVisible();
    await expect(side.getByRole("heading", { name: "On this day" })).toBeVisible();
    await expect(side.getByText("A year ago today.")).toBeVisible();
    await expect(linkHeadings(page)).toHaveCount(0);
    expect(await titlesOf(page, "daily")).not.toContain("2001-02-14");

    // A period with no review keeps its sidebar too, with its Reports: who came up in it.
    await openPeriod(page, "2001-02");
    await expect(page.getByText("No review of")).toBeVisible();
    await expect(side).toBeVisible();
    await expect(calendar(page).locator("[aria-current]")).toHaveCount(0);
    await expect(side.getByText("Ada Lovelace")).toBeVisible();
    await expect(linkHeadings(page)).toHaveCount(0);
    expect(await titlesOf(page, "month")).not.toContain("2001-02");
  });
});

/** The calendar pages by itself (#210): its arrows move the calendar, never the open Day. */
test.describe("Journal navigation · the calendar pages by itself (#210)", () => {

  const DAY = "/app/journal?d=2001-02-14";
  const atDay = (page: Page) => expect(page).toHaveURL((u) => u.pathname + u.search === DAY);

  test("the month and year arrows page the calendar and leave the Day, the URL and the sidebar put", async ({ page }) => {
    await seedJournal(page, { days: { "2001-02-14": "Valentine's.", "2001-04-02": "April showers." } });
    await openDay(page, "2001-02-14");
    await expectCalendarAt(page, "February 2001");

    // Each click waits for its month, so two quick clicks can't be read as one.
    await calendar(page).getByRole("button", { name: "Next month" }).click();
    await expectCalendarAt(page, "March 2001");
    await calendar(page).getByRole("button", { name: "Next month" }).click();
    await expectCalendarAt(page, "April 2001");
    // April's days are shown, its written Day marked; the open Day is still February's.
    await expect(calendarTile(calendar(page), "2001-04-02")).toHaveAccessibleName(/, written$/);
    await atDay(page);
    await expect(page.getByText("Valentine's.")).toBeVisible();

    await calendar(page).getByRole("button", { name: "Previous month" }).click();
    await expectCalendarAt(page, "March 2001");
    // A month with nothing written keeps the sidebar.
    await expect(sidebar(page)).toBeVisible();

    await calendar(page).getByRole("button", { name: "Previous year" }).click();
    await expectCalendarAt(page, "March 2000");
    await calendar(page).getByRole("button", { name: "Next year" }).click();
    await expectCalendarAt(page, "March 2001");
    await atDay(page);
  });

  test("clicking a day opens it, and the calendar comes back to the open Day's month", async ({ page }) => {
    await seedJournal(page, { days: { "2001-02-14": "Valentine's.", "2000-06-21": "Midsummer." } });
    await openDay(page, "2001-02-14");

    // Page away, then open a Day by other means: the calendar returns to its month.
    await calendar(page).getByRole("button", { name: "Previous year" }).click();
    await expectCalendarAt(page, "February 2000");
    await page.getByRole("button", { name: "Next day" }).click();
    await expect(page).toHaveURL(/d=2001-02-15/);
    await expectCalendarAt(page, "February 2001");
    await expect(calendarTile(calendar(page), "2001-02-15")).toHaveAttribute("aria-current", "date");

    // Picking a day in a paged-to month opens that Day, and the calendar stays on its month.
    for (let i = 0; i < 8; i++) {
      await calendar(page).getByRole("button", { name: "Previous month" }).click();
    }
    await expectCalendarAt(page, "June 2000");
    await calendarTile(calendar(page), "2000-06-21").click();
    await expect(page).toHaveURL(/d=2000-06-21/);
    await expect(page.getByText("Midsummer.")).toBeVisible();
    await expectCalendarAt(page, "June 2000");
    await expect(calendarTile(calendar(page), "2000-06-21")).toHaveAttribute("aria-current", "date");
  });
});

/**
 * The calendar zooms out (#211): the month's title shows the year's months,
 * the year's title the years from the earliest written Day's to this year;
 * picking zooms back in. Written months and years are marked; a Template-only
 * Day marks nothing. Which years are listed and marked is `calendarZoom.test.ts`'s.
 */
test.describe("Journal navigation · the calendar zooms out (#211)", () => {

  const DAYS = {
    "1997-06-02": "The earliest.",
    "1999-05-01": TEMPLATE, // made, never written in: marks neither May nor 1999
    "2001-02-14": "Valentine's.",
  };
  const DAY = "/app/journal?d=2001-02-14";
  const atDay = (page: Page) => expect(page).toHaveURL((u) => u.pathname + u.search === DAY);
  /** A month or year tile (named `2001-02`, `2001`) or a day cell, in the calendar. */
  const tile = (page: Page, name: string) => calendarTile(calendar(page), name);

  test("the month's title shows the year's months, written ones marked; picking one shows its days", async ({ page }) => {
    await seedJournal(page, { days: DAYS });
    await openDay(page, "2001-02-14");

    // The month title zooms out; it no longer opens the Month review.
    await expect(calendar(page).getByRole("link")).toHaveCount(0);
    await calendar(page).getByRole("button", { name: "February 2001" }).click();
    await expectCalendarAt(page, "2001");
    await atDay(page);
    await expect(tile(page, "2001-02")).toHaveAccessibleName(/, written$/);
    await expect(tile(page, "2001-02")).toHaveAttribute("aria-current", "date");
    await expect(tile(page, "2001-03")).not.toHaveAccessibleName(/written/);

    // The arrows page by years now.
    await calendar(page).getByRole("button", { name: "Previous year" }).click();
    await expectCalendarAt(page, "2000");
    await calendar(page).getByRole("button", { name: "Previous year" }).click();
    await expectCalendarAt(page, "1999");
    // A month holding only a Template-only Day isn't marked.
    await expect(tile(page, "1999-05")).not.toHaveAccessibleName(/written/);
    await calendar(page).getByRole("button", { name: "Next year" }).click();
    await calendar(page).getByRole("button", { name: "Next year" }).click();
    await expectCalendarAt(page, "2001");

    await tile(page, "2001-02").click();
    await expectCalendarAt(page, "February 2001");
    await expect(tile(page, "2001-02-14")).toHaveAttribute("aria-current", "date");
    await atDay(page);

    // Zoomed out, opening another Day brings the calendar back to its month's days.
    await calendar(page).getByRole("button", { name: "February 2001" }).click();
    await expectCalendarAt(page, "2001");
    await page.getByRole("button", { name: "Next day" }).click();
    await expectCalendarAt(page, "February 2001");
    await expect(tile(page, "2001-02-15")).toHaveAttribute("aria-current", "date");
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
});

/**
 * Skipping the gaps (#208): an unwritten date's page offers the nearest
 * written Day before and after it, each with its date; Template-only Days are
 * skipped, and a direction with no written Day offers nothing (`nearest.test.ts`).
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
});

/**
 * The palette's date row (ADR 0088, #207): typing a date or a period key puts
 * one row first, in human form; Enter opens that page and makes nothing. What
 * each form reads as, and what offers no row, is `periods.test.ts`'s (`journalPageOf`).
 */
test.describe("Journal navigation · a date typed in the palette (#207)", () => {
  // The palette is opened with Mod+K, on the desk only (ADR 0021).
  // Labels read as in the spec ("Tuesday 14 March 2023"), whatever this machine's locale.
  test.use({ locale: "en-GB" });

  async function typeInPalette(page: Page, query: string) {
    await openPalette(page);
    await page.getByRole("dialog").getByRole("combobox").fill(query);
  }

  const options = (page: Page) => page.getByRole("dialog").getByRole("option");

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
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(await titlesOf(page, "year")).not.toContain("2023");
  });
});

/**
 * "Go to date…" finds the date row by name, and every review is one Command
 * away (#212).
 */
test.describe("Journal navigation · Go to date and the review Commands (#212)", () => {
  test.use({ locale: "en-GB" });

  const palette = (page: Page) => page.getByRole("dialog");
  const query = (page: Page) => palette(page).getByRole("combobox");

  async function pickByName(page: Page, name: string) {
    await openPalette(page);
    await query(page).fill(name);
    await expect(palette(page).getByRole("option", { name: new RegExp(`^${name}`) })).toBeVisible();
    await expect(palette(page).getByRole("option").first()).toContainText(name);
    await page.keyboard.press("Enter");
  }

  test("picking Go to date… leaves the palette open, empty and focused, ready for a date", async ({ page }) => {
    await page.goto("/screens");
    await workLocally(page);
    // It is listed as soon as the palette opens.
    await openPalette(page);
    await expect(palette(page).getByRole("option", { name: /^Go to date…/ })).toBeAttached();
    await page.keyboard.press("Escape");
    await expect(palette(page)).toHaveCount(0);

    await pickByName(page, "Go to date…");
    await expect(palette(page)).toBeVisible();
    await expect(query(page)).toHaveValue("");
    await expect(query(page)).toBeFocused();
    await page.keyboard.type("2023-03-14");
    await expect(palette(page).getByRole("option").first()).toContainText("Tuesday 14 March 2023");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL((u) => u.pathname + u.search === "/app/journal?d=2023-03-14");
    await expect(palette(page)).toHaveCount(0);
  });

  // The review Commands are one flow, each a link to its stretch: the quarter's stands for the others.
  test("Open this quarter's review opens the current quarter", async ({ page }) => {
    const now = new Date();
    const quarter = `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`;
    await page.goto("/screens");
    await workLocally(page);
    await pickByName(page, "Open this quarter's review");
    await expect(page).toHaveURL((u) => u.pathname === `/app/journal/p/${quarter}`);
    await expect(palette(page)).toHaveCount(0);
  });
});

/**
 * Keyboard paging (#213): Alt+←/→ steps a Day by a calendar day and a period
 * by one of its kind; Alt+Shift+←/→ skips to the nearest written Day or the
 * nearest period with a review, and does nothing past the last one
 * (`paging.test.ts`). Never while typing: Esc leaves the editor first.
 */
test.describe("Journal navigation · keyboard paging (#213)", () => {
  // May–July 1997: a stretch nothing else in the store uses.
  const DAYS = {
    "1997-05-02": "Swifts are back.",
    "1997-05-09": TEMPLATE, // made, never written in: skipped
    "1997-05-20": "Hay in.",
  };
  const dayUrl = (date: string) => (u: URL) => u.searchParams.get("d") === date;

  test("on a Day, Alt+←/→ step a calendar day and Alt+Shift+←/→ skip to the nearest written Day", async ({ page }) => {
    await seedJournal(page, { days: DAYS });
    await openDay(page, "1997-05-12");
    await page.keyboard.press("Alt+ArrowRight");
    await expect(page).toHaveURL(dayUrl("1997-05-13"));
    await page.keyboard.press("Alt+ArrowLeft");
    await expect(page).toHaveURL(dayUrl("1997-05-12"));
    await page.keyboard.press("Alt+Shift+ArrowLeft"); // past the Template-only 9 May
    await expect(page).toHaveURL(dayUrl("1997-05-02"));
    await page.keyboard.press("Alt+Shift+ArrowRight");
    await expect(page).toHaveURL(dayUrl("1997-05-20"));
  });

  test("they do nothing in the editor or the date picker; Esc leaves the editor so they page", async ({ page }) => {
    await seedJournal(page, { days: DAYS });
    await openDay(page, "1997-05-20");
    await page.locator(".cm-content").click();
    await page.keyboard.press("Alt+ArrowRight");
    await page.keyboard.press("Alt+Shift+ArrowLeft");
    await expect(page.locator(".cm-content")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.locator(".cm-content")).not.toBeFocused();
    await page.keyboard.press("Alt+ArrowRight"); // one day on: the keys in the editor did nothing
    await expect(page).toHaveURL(dayUrl("1997-05-21"));

    // The Jump to date picker is a dialog: the keys stay the calendar's while it is open.
    await page.getByRole("button", { name: /^Jump to date/ }).click();
    const calendar = page.locator('[data-slot="popover-content"] [data-slot="calendar"]');
    await expect(calendar).toBeVisible();
    await page.keyboard.press("Alt+Shift+ArrowLeft");
    await page.keyboard.press("Escape");
    await expect(calendar).toBeHidden();
    await expect(page).toHaveURL(dayUrl("1997-05-21"));
    await page.keyboard.press("Alt+ArrowLeft"); // one day back: the keys in the picker did nothing
    await expect(page).toHaveURL(dayUrl("1997-05-20"));
  });
});
