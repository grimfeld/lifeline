import { test, expect, type Page } from "@playwright/test";
import { TEMPLATE, calendar, expectCalendarAt, hasSidebar, linkHeadings, openDay, openPeriod, seedJournal, sidebar, titlesOf, workLocally } from "./support/journal";
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

  test("a period with no review and nothing in it still shows the calendar, Reviews and On this day", async ({ page }) => {
    await seedJournal(page, { days: { "1999-07-01": "A year before." } });

    await openPeriod(page, "2000-07");
    await expect(page.getByText("No review of")).toBeVisible();
    const side = sidebar(page);
    // The calendar opens at the period's first month; no Day is open on a period page.
    await expectCalendarAt(page, "July 2000");
    await expect(calendar(page).locator("[aria-current]")).toHaveCount(0);
    await expect(side.getByRole("heading", { name: "Reviews" })).toBeVisible();
    await expect(side.getByRole("link", { name: /^Quarter Q3 2000/ })).toBeVisible();
    // On this day, for the period's first day.
    await expect(side.getByRole("heading", { name: "On this day" })).toBeVisible();
    await expect(side.getByText("A year before.")).toBeVisible();
    await expect(linkHeadings(page)).toHaveCount(0);
  });

  test("paging the calendar to a month with nothing written keeps the sidebar", async ({ page }) => {
    await seedJournal(page, { days: { "2001-02-14": "Valentine's." } });
    await openDay(page, "2001-02-14");
    expect(hasSidebar(page)).toBe(true);

    await calendar(page).getByRole("button", { name: "Previous month" }).click();
    await expectCalendarAt(page, "January 2001");
    // Each click waits for its month, so two quick clicks can't be read as one.
    await calendar(page).getByRole("button", { name: "Next month" }).click();
    await expectCalendarAt(page, "February 2001");
    await calendar(page).getByRole("button", { name: "Next month" }).click();
    await expectCalendarAt(page, "March 2001");
    await expect(sidebar(page)).toBeVisible();
  });
});

/** The calendar pages by itself (#210): its arrows move the calendar, never the open Day. */
test.describe("Journal navigation · the calendar pages by itself (#210)", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, "the Journal sidebar is hidden below lg");

  const DAY = "/app/journal?d=2001-02-14";
  const atDay = (page: Page) => expect(page).toHaveURL((u) => u.pathname + u.search === DAY);

  test("the month arrows page the calendar and leave the Day and the URL put", async ({ page }) => {
    await seedJournal(page, { days: { "2001-02-14": "Valentine's.", "2001-04-02": "April showers." } });
    await openDay(page, "2001-02-14");
    await expectCalendarAt(page, "February 2001");

    await calendar(page).getByRole("button", { name: "Next month" }).click();
    await expectCalendarAt(page, "March 2001");
    await calendar(page).getByRole("button", { name: "Next month" }).click();
    await expectCalendarAt(page, "April 2001");
    // April's days are shown, its written Day marked; the open Day is still February's.
    await expect(calendar(page).getByRole("button", { name: "2001-04-02", exact: true })).toHaveAttribute("title", /written$/);
    await atDay(page);
    await expect(page.getByText("Valentine's.")).toBeVisible();

    await calendar(page).getByRole("button", { name: "Previous month" }).click();
    await expectCalendarAt(page, "March 2001");
    await atDay(page);
  });

  test("the year arrows step a whole year, and the URL stays put", async ({ page }) => {
    await seedJournal(page, { days: { "2001-02-14": "Valentine's." } });
    await openDay(page, "2001-02-14");

    await calendar(page).getByRole("button", { name: "Previous year" }).click();
    await expectCalendarAt(page, "February 2000");
    await calendar(page).getByRole("button", { name: "Previous year" }).click();
    await expectCalendarAt(page, "February 1999");
    await calendar(page).getByRole("button", { name: "Next year" }).click();
    await expectCalendarAt(page, "February 2000");
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
    await expect(calendar(page).getByRole("button", { name: "2001-02-15", exact: true })).toHaveAttribute("aria-current", "date");

    // Picking a day in a paged-to month opens that Day, and the calendar stays on its month.
    for (let i = 0; i < 8; i++) {
      await calendar(page).getByRole("button", { name: "Previous month" }).click();
    }
    await expectCalendarAt(page, "June 2000");
    await calendar(page).getByRole("button", { name: "2000-06-21", exact: true }).click();
    await expect(page).toHaveURL(/d=2000-06-21/);
    await expect(page.getByText("Midsummer.")).toBeVisible();
    await expectCalendarAt(page, "June 2000");
    await expect(calendar(page).getByRole("button", { name: "2000-06-21", exact: true })).toHaveAttribute("aria-current", "date");
  });
});

/**
 * The calendar zooms out (#211): the month's title shows the year's months,
 * the year's title the years from the earliest written Day's to this year;
 * picking zooms back in. Written months and years are marked; a Template-only
 * Day marks nothing.
 */
test.describe("Journal navigation · the calendar zooms out (#211)", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, "the Journal sidebar is hidden below lg");

  const DAYS = {
    "1997-06-02": "The earliest.",
    "1999-05-01": TEMPLATE, // made, never written in: marks neither May nor 1999
    "2001-02-14": "Valentine's.",
  };
  const DAY = "/app/journal?d=2001-02-14";
  const atDay = (page: Page) => expect(page).toHaveURL((u) => u.pathname + u.search === DAY);
  /** A month or year tile (named `2001-02`, `2001`) or a day cell, in the calendar. */
  const tile = (page: Page, name: string) => calendar(page).getByRole("button", { name, exact: true });
  /** The years list's page holding `year`: pages of twelve end on this year, the first starts at 1997. */
  const pageOf = (year: number) => {
    const now = new Date().getFullYear();
    const end = now - Math.floor((now - year) / 12) * 12;
    return `${Math.max(1997, end - 11)}–${end}`;
  };

  test("the month's title shows the year's months, written ones marked; picking one shows its days", async ({ page }) => {
    await seedJournal(page, { days: DAYS });
    await openDay(page, "2001-02-14");

    await calendar(page).getByRole("button", { name: "February 2001" }).click();
    await expectCalendarAt(page, "2001");
    await expect(tile(page, "2001-02")).toHaveAttribute("title", /written$/);
    await expect(tile(page, "2001-02")).toHaveAttribute("aria-current", "date");
    await expect(tile(page, "2001-03")).not.toHaveAttribute("title", /written/);

    // The arrows page by years now.
    await calendar(page).getByRole("button", { name: "Previous year" }).click();
    await expectCalendarAt(page, "2000");
    await calendar(page).getByRole("button", { name: "Previous year" }).click();
    await expectCalendarAt(page, "1999");
    // A month holding only a Template-only Day isn't marked.
    await expect(tile(page, "1999-05")).not.toHaveAttribute("title", /written/);
    await calendar(page).getByRole("button", { name: "Next year" }).click();
    await calendar(page).getByRole("button", { name: "Next year" }).click();
    await expectCalendarAt(page, "2001");

    await tile(page, "2001-02").click();
    await expectCalendarAt(page, "February 2001");
    await expect(tile(page, "2001-02-14")).toHaveAttribute("aria-current", "date");
    await atDay(page);
  });

  test("the year's title lists the years from the earliest written one to this year; picking zooms back in", async ({ page }) => {
    await seedJournal(page, { days: DAYS });
    await openDay(page, "2001-02-14");

    await calendar(page).getByRole("button", { name: "February 2001" }).click();
    await calendar(page).getByRole("button", { name: "2001", exact: true }).click();
    await expectCalendarAt(page, pageOf(2001));
    await expect(tile(page, "1997")).toBeVisible();
    await expect(tile(page, "1996")).toHaveCount(0);
    await expect(tile(page, "1997")).toHaveAttribute("title", /written$/);
    await expect(tile(page, "2001")).toHaveAttribute("title", /written$/);
    await expect(tile(page, "2001")).toHaveAttribute("aria-current", "date");
    await expect(tile(page, "1998")).not.toHaveAttribute("title", /written/);
    await expect(tile(page, "1999")).not.toHaveAttribute("title", /written/); // its only Day is Template-only
    await expect(calendar(page).getByRole("button", { name: "Earlier years" })).toBeDisabled();

    // The arrows page by twelve years, up to this year.
    const thisYear = new Date().getFullYear();
    for (let shown = pageOf(2001); shown !== pageOf(thisYear); ) {
      await calendar(page).getByRole("button", { name: "Later years" }).click();
      shown = pageOf(Number(shown.slice(-4)) + 1);
      await expectCalendarAt(page, shown);
    }
    await expect(tile(page, String(thisYear))).toBeVisible();
    await expect(tile(page, String(thisYear + 1))).toHaveCount(0);
    await expect(calendar(page).getByRole("button", { name: "Later years" })).toBeDisabled();

    for (let shown = pageOf(thisYear); shown !== pageOf(1999); ) {
      await calendar(page).getByRole("button", { name: "Earlier years" }).click();
      shown = pageOf(Number(shown.slice(0, 4)) - 1);
      await expectCalendarAt(page, shown);
    }
    await tile(page, "1999").click();
    await expectCalendarAt(page, "1999");
    await tile(page, "1999-05").click();
    await expectCalendarAt(page, "May 1999");
    await atDay(page);
  });

  test("the month title no longer opens the Month review", async ({ page }) => {
    await seedJournal(page, { days: DAYS });
    await openDay(page, "2001-02-14");
    await expect(calendar(page).getByRole("link")).toHaveCount(0);
    await calendar(page).getByRole("button", { name: "February 2001" }).click();
    await atDay(page);
  });

  test("opening another Day brings the calendar back to its month's days", async ({ page }) => {
    await seedJournal(page, { days: DAYS });
    await openDay(page, "2001-02-14");
    await calendar(page).getByRole("button", { name: "February 2001" }).click();
    await calendar(page).getByRole("button", { name: "2001", exact: true }).click();
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

/**
 * "Go to date…" finds the date row by name, and every review is one Command
 * away (#212).
 */
test.describe("Journal navigation · Go to date and the review Commands (#212)", () => {
  test.skip(({ isMobile }) => isMobile, "the palette is not opened on a phone");
  test.use({ locale: "en-GB" });

  const palette = (page: Page) => page.getByRole("dialog");
  const query = (page: Page) => palette(page).getByRole("combobox");

  async function pickByName(page: Page, name: string, how: "enter" | "click") {
    await page.keyboard.press("Control+k");
    await query(page).fill(name);
    const row = palette(page).getByRole("option", { name: new RegExp(`^${name}`) });
    await expect(row).toBeVisible();
    if (how === "click") await row.click();
    else {
      await expect(palette(page).getByRole("option").first()).toContainText(name);
      await page.keyboard.press("Enter");
    }
  }

  for (const how of ["enter", "click"] as const) {
    test(`picking Go to date… (${how}) leaves the palette open, empty and focused, ready for a date`, async ({ page }) => {
      await page.goto("/screens");
      await workLocally(page);
      await pickByName(page, "Go to date…", how);
      await expect(palette(page)).toBeVisible();
      await expect(query(page)).toHaveValue("");
      await expect(query(page)).toBeFocused();
      await page.keyboard.type("2023-03-14");
      await expect(palette(page).getByRole("option").first()).toContainText("Tuesday 14 March 2023");
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL((u) => u.pathname + u.search === "/app/journal?d=2023-03-14");
      await expect(palette(page)).toHaveCount(0);
    });
  }

  test("Go to date… is listed when the palette opens", async ({ page }) => {
    await page.goto("/screens");
    await workLocally(page);
    await page.keyboard.press("Control+k");
    await expect(palette(page).getByRole("option", { name: /^Go to date…/ })).toBeAttached();
  });

  const now = new Date();
  const year = String(now.getFullYear());
  const quarter = `${year}-Q${Math.floor(now.getMonth() / 3) + 1}`;
  for (const { name, key } of [
    { name: "Open this quarter's review", key: quarter },
    { name: "Open this year's review", key: year },
  ]) {
    test(`${name} opens ${key}`, async ({ page }) => {
      await page.goto("/screens");
      await workLocally(page);
      await pickByName(page, name, "enter");
      await expect(page).toHaveURL((u) => u.pathname === `/app/journal/p/${key}`);
      await expect(palette(page)).toHaveCount(0);
    });
  }
});

/**
 * Keyboard paging (#213): Alt+←/→ steps a Day by a calendar day and a period
 * by one of its kind; Alt+Shift+←/→ skips to the nearest written Day or the
 * nearest period with a review, and does nothing past the last one. Never
 * while typing: Esc leaves the editor first.
 */
test.describe("Journal navigation · keyboard paging (#213)", () => {
  test.skip(({ isMobile }) => isMobile, "keyboard paging is the desk's: a phone pages with its dock");
  // May–July 1997: a stretch nothing else in the store uses.
  const DAYS = {
    "1997-05-02": "Swifts are back.",
    "1997-05-09": TEMPLATE, // made, never written in: skipped
    "1997-05-20": "Hay in.",
  };
  const REVIEWS = { "1997-02": "A cold month.", "1997-07": "" };
  const dayUrl = (date: string) => (u: URL) => u.searchParams.get("d") === date;
  const periodUrl = (key: string) => (u: URL) => u.pathname === `/app/journal/p/${key}`;

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

  test("Alt+Shift past the last written Day does nothing", async ({ page }) => {
    await seedJournal(page, { days: DAYS });
    // After May 1997 the next written Days are the layout seed's (dated today), so look from past them.
    await openDay(page, "2999-01-01");
    await page.keyboard.press("Alt+Shift+ArrowRight");
    await page.keyboard.press("Alt+ArrowRight"); // one day on from where it stayed
    await expect(page).toHaveURL(dayUrl("2999-01-02"));
  });

  test("on a period page, Alt+←/→ step a period and Alt+Shift+←/→ skip to the nearest review", async ({ page }) => {
    await seedJournal(page, { reviews: REVIEWS });
    await openPeriod(page, "1997-05");
    await page.keyboard.press("Alt+ArrowRight");
    await expect(page).toHaveURL(periodUrl("1997-06"));
    await page.keyboard.press("Alt+ArrowLeft");
    await expect(page).toHaveURL(periodUrl("1997-05"));
    await page.keyboard.press("Alt+Shift+ArrowLeft");
    await expect(page).toHaveURL(periodUrl("1997-02"));
    await page.keyboard.press("Alt+Shift+ArrowRight");
    await expect(page).toHaveURL(periodUrl("1997-07"));

    await openPeriod(page, "1997-Q2");
    await page.keyboard.press("Alt+ArrowLeft");
    await expect(page).toHaveURL(periodUrl("1997-Q1"));
  });

  test("Alt+Shift past the last review does nothing", async ({ page }) => {
    await seedJournal(page, { reviews: REVIEWS });
    await openPeriod(page, "2999-01");
    await page.keyboard.press("Alt+Shift+ArrowRight");
    await page.keyboard.press("Alt+ArrowRight");
    await expect(page).toHaveURL(periodUrl("2999-02"));
  });

  test("they do nothing in the editor or an input; Esc leaves the editor so they page", async ({ page }) => {
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

    const jump = page.getByLabel("Jump to date");
    await jump.focus();
    await page.keyboard.press("Alt+Shift+ArrowLeft");
    await jump.blur();
    await expect(jump).not.toBeFocused();
    await page.keyboard.press("Alt+ArrowLeft"); // one day back: the keys in the input did nothing
    await expect(page).toHaveURL(dayUrl("1997-05-20"));
  });
});
