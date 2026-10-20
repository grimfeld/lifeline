import { test, expect, type Locator, type Page } from "@playwright/test";
import { layoutProblems } from "./support/layout";
import type {} from "../src/demo/inspect"; // window.lifelineDemo

/**
 * The Demo (CONTEXT.md "Demo", ADR 0077): the build with `VITE_DEMO=1`, as a
 * stranger opening the link meets it — no backend, at phone and desktop width.
 * Run by the `demo` project, against a production build of the Demo.
 *
 * Cases start from the life demo.setup.ts seeded once, saved with the store.
 * Those about a first open, a pinned clock, a reload or Reset start from an
 * empty store (`test.use({ storageState: EMPTY })`) and seed it themselves.
 */
const WIDTHS = [
  { name: "phone", viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true },
  { name: "desktop", viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false },
] as const;

/** A browser that has never opened the Demo: the app seeds the life on first open. */
const EMPTY = { cookies: [], origins: [] };

/**
 * Writing the life behind the first screen takes about ten seconds here, but two
 * to three times that on a 2-core CI runner. WRITTEN is the wait for it to end;
 * SEEDING, the time a case that seeds the life itself may take (the project's
 * 30 seconds is for cases that start from the seeded life).
 */
const WRITTEN = process.env.CI ? 70_000 : 40_000;
const SEEDING = process.env.CI ? 90_000 : 60_000;

/** The line the shell shows while the rest of the Demo life is written behind the first screen. */
function filling(page: Page) {
  return page.getByRole("status").filter({ hasText: /^Filling in the rest of the Demo/ });
}

/**
 * Wait until the app is up and the whole Demo life is written. A first open
 * writes today's agenda behind "Loading…", shows the first screen, then writes
 * the rest; leaving before it ends would start it over.
 */
async function settle(page: Page): Promise<void> {
  await expect(page.getByRole("status").filter({ hasText: /^Loading…$/ })).toHaveCount(0, { timeout: 20_000 });
  await expect(page.locator("main").first()).toBeVisible();
  await expect(filling(page)).toHaveCount(0, { timeout: WRITTEN });
}

/** Open a page and let it settle. */
async function open(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await settle(page);
}

/**
 * Today on the Calendar's Upcoming list — the day-by-day agenda a fresh phone
 * opens on. Its label is the browser's own human date for today, so it follows
 * a pinned clock.
 */
async function todayOnUpcoming(page: Page) {
  const label = await page.evaluate(() => {
    const n = new Date();
    return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  });
  return page.getByRole("region", { name: label, exact: true });
}

/** Today's agenda holds an Event (a timed or all-day row) and work to tick (Tasks, Chores). */
async function expectBusyToday(page: Page): Promise<void> {
  await open(page, "/calendar?view=upcoming");
  const today = await todayOnUpcoming(page);
  await expect(today).toBeVisible();
  await expect(today.getByText(/^(All day|\d{1,2}:\d{2}.*)$/).first()).toBeVisible();
  await expect(today.getByRole("button", { name: /^Complete / })).not.toHaveCount(0);
  expect(await today.getByRole("button", { name: /^Complete / }).count(), "work to tick today").toBeGreaterThanOrEqual(2);
}

/** Every trace a SyncBadge leaves: the sign-in prompt, the sync states, the erase row. */
function syncBadges(page: Page) {
  return page.getByText(/Sign in to sync|Erase local data|^Synced$|Sync error|Not signed in/);
}

for (const w of WIDTHS) {
  test.describe(`Demo at ${w.name} width`, () => {
    test.use({ viewport: w.viewport, isMobile: w.isMobile, hasTouch: w.hasTouch });

    test("opens with no sign-in dialog", async ({ page }) => {
      await open(page, "/");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.getByText("You're signed out")).toHaveCount(0);
    });

    test("shows no SyncBadge on the Rail, the Phone header or Settings", async ({ page }) => {
      await open(page, "/calendar");
      await expect(syncBadges(page)).toHaveCount(0);
      await expect(page.getByTitle(/sync/i)).toHaveCount(0);
      if (w.isMobile) {
        // The Phone header's drawer, where the badge sat under the Rail.
        await page.getByTitle("Menu").click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await expect(syncBadges(page)).toHaveCount(0);
        await page.keyboard.press("Escape");
      }
      await open(page, "/settings");
      await expect(syncBadges(page)).toHaveCount(0);
    });

    test("never sends a request to PocketBase, even with a session left in the browser", async ({ page }) => {
      // A live-looking PocketBase session: the real build would sync with it at once.
      await page.addInitScript(() => {
        const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, "");
        const token = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ id: "u1", type: "auth", exp: 4102444800 })}.sig`;
        localStorage.setItem("pocketbase_auth", JSON.stringify({ token, record: { id: "u1", email: "someone@example.com" } }));
      });
      const backend: string[] = [];
      page.on("request", (r) => {
        const u = new URL(r.url());
        if (u.pathname.startsWith("/api/") || u.port === "8090") backend.push(r.url());
      });
      await open(page, "/");
      await open(page, "/settings");
      await open(page, "/calendar");
      expect(backend, "requests to a backend").toEqual([]);
    });

    test("Settings shows the Demo section instead of Account and sync", async ({ page }) => {
      await open(page, "/settings");
      await expect(page.getByRole("heading", { name: "Demo", exact: true })).toBeVisible();
      await expect(page.getByText(/stays in this browser/i)).toBeVisible();
      await expect(page.getByRole("heading", { name: "Account and sync" })).toHaveCount(0);
    });

    test.describe("from an empty store", () => {
      test.use({ storageState: EMPTY });
      // Writing the life takes seconds of its own, behind the first screen.
      test.describe.configure({ timeout: SEEDING });

      test("first open puts tasks, chores and events on today", async ({ page }) => {
        await expectBusyToday(page);

        await open(page, "/app/tasks");
        await expect(page.getByRole("heading", { name: /^Today/ })).toBeVisible();
        await open(page, "/app/chores");
        await expect(page.getByRole("heading", { name: "Due today", exact: true })).toBeVisible();

        await open(page, "/calendar?view=day");
        const day = await page.evaluate(() => {
          const n = new Date();
          return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
        });
        await expect(page.locator(`[data-col="${day}"]`)).not.toHaveText("");
      });

      test("an edit survives a reload, and the reload does not re-seed", async ({ page }) => {
        await open(page, "/app/tasks");
        // One tick per open Task on the Open list: a re-seed would add a second set.
        const ticks = page.getByTitle("Mark done");
        await expect(ticks).not.toHaveCount(0);
        const seeded = await ticks.count();
        await page.getByPlaceholder(/^Quick add/).fill("Return the library card");
        await page.keyboard.press("Enter");
        await expect(page.getByText("Return the library card", { exact: true })).toBeVisible();
        await expect(ticks).toHaveCount(seeded + 1);

        await page.reload();
        await settle(page);
        await expect(page.getByText("Return the library card", { exact: true })).toBeVisible();
        await expect(ticks).toHaveCount(seeded + 1);
      });

      test("with the clock pinned to another day, that day's agenda is full", async ({ page }) => {
        await page.clock.setFixedTime(new Date("2027-03-10T09:30:00"));
        await expectBusyToday(page);
      });
    });
  });
}

// ---- Demo life: tracking (#110) ----------------------------------------------

/** A day's local key `offset` days from the page's own (possibly pinned) clock. */
async function pageDay(page: Page, offset = 0): Promise<string> {
  return page.evaluate((n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, offset);
}

/** Open a Stat's detail page from the Stats list. */
async function openStat(page: Page, name: string): Promise<void> {
  await open(page, "/app/stats");
  await page.getByText(name, { exact: true }).first().click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
}

/** A boolean Stat's streak is live on the visit day, and its heatmap is marked for weeks back. */
async function expectLiveStreak(page: Page): Promise<void> {
  await open(page, "/app/stats");
  const streaks = page.getByTitle("Current streak");
  await expect(streaks.first()).toBeVisible();
  // Polled, not read once: a streak shows 0 until the Stat's entries are read.
  await expect
    .poll(async () => Math.max(...(await streaks.allInnerTexts()).map((t) => Number(t.trim()))), {
      message: "a streak on the Stats list",
    })
    .toBeGreaterThanOrEqual(7);

  await openStat(page, "Stretching");
  const run = page.getByText(/day streak/);
  await expect
    .poll(async () => Number((await run.innerText()).match(/(\d+)\s*day streak/)?.[1]), { message: "streak on the visit day" })
    .toBeGreaterThanOrEqual(7);
  // The 30-day heatmap: yesterday marked, and most of the month too.
  await expect(page.locator(`[title="${await pageDay(page, -1)}"][style*="background"]`)).toHaveCount(1);
  expect(await page.locator('[title^="20"][style*="background"]').count(), "days marked over 30 days").toBeGreaterThanOrEqual(18);
}

/** A Mood grid cell with a mood recorded ("Tue, Oct 6 — 🙂 Good"), not "— no mood". */
const MOOD_CELL = /— \S+ (Rough|Meh|Okay|Good|Great)$/;

for (const w of WIDTHS) {
  test.describe(`Demo life: tracking at ${w.name} width`, () => {
    test.use({ viewport: w.viewport, isMobile: w.isMobile, hasTouch: w.hasTouch });

    test("a boolean Stat has a live streak and weeks of marks", async ({ page }) => {
      await expectLiveStreak(page);
    });

    test("an additive Stat charts weeks of entries", async ({ page }) => {
      await openStat(page, "Water");
      await expect(page.getByText("No entries in this period.")).toHaveCount(0);
      await expect(page.locator(".recharts-bar-rectangle").first()).toBeVisible();
      expect(await page.locator(".recharts-bar-rectangle").count(), "days with water in 30 days").toBeGreaterThanOrEqual(20);
    });

    test("Life Level, Mood, Workout and Swear jar open with believable content", async ({ page }) => {
      await open(page, "/app/lifelevel");
      for (const h of ["Morning mobility", "Read before bed", "Strength training"]) {
        await expect(page.getByText(h, { exact: true }).first()).toBeVisible();
      }
      await expect(page.getByText(/Doomscrolling/).first()).toBeVisible();

      await open(page, "/app/mood");
      expect(await page.getByRole("button", { name: MOOD_CELL }).count(), "moods this month").toBeGreaterThanOrEqual(1);

      await open(page, "/app/workout?tab=sessions");
      // A Session row: the Workout's name over "Sat, Oct 17 · 08:00–08:24 · 24 min".
      await expect(page.getByText("Saturday AMRAP", { exact: true }).first()).toBeVisible();
      expect(await page.getByText(/ · \d+ min$/).count(), "sessions in three weeks").toBeGreaterThanOrEqual(4);

      await open(page, "/app/swearjar");
      await expect(page.getByText("The jar is empty this month. Keep it that way.")).toHaveCount(0);
      await expect(page.getByText("Doomscrolling past midnight").first()).toBeVisible();
    });

    test.describe("from an empty store", () => {
      test.use({ storageState: EMPTY });
      // Writing the life takes seconds of its own, behind the first screen.
      test.describe.configure({ timeout: SEEDING });
      test("with the clock pinned to another day, streaks and moods run up to it", async ({ page }) => {
        await page.clock.setFixedTime(new Date("2027-03-10T09:30:00"));
        await expectLiveStreak(page);
        await open(page, "/app/mood");
        await expect
          .poll(() => page.getByRole("button", { name: MOOD_CELL }).count(), { message: "moods in March" })
          .toBeGreaterThanOrEqual(6);
      });
    });
  });
}

// ---- Demo life: money and household (#113) ----

for (const w of WIDTHS) {
  test.describe(`Demo money and household at ${w.name} width`, () => {
    test.use({ viewport: w.viewport, isMobile: w.isMobile, hasTouch: w.hasTouch });

    test("the Ledger holds a few weeks of Transactions in categories", async ({ page }) => {
      await open(page, "/app/ledger");
      const main = page.locator("main");
      // The register's summary line: "58 transactions · −€… · +€…".
      await expect(main.getByText(/^\d{2,} transactions/)).toBeVisible();
      // Each row reads "<day> <payee> · <category> …".
      for (const row of [/Ballintemple Lettings · Rent/, /Quay Coffee · Eating out/, /Lidl · Groceries/]) {
        await expect(main.getByRole("button", { name: row }).first()).toBeAttached();
      }
    });

    test("the Money overview forecasts the rent and the salary", async ({ page }) => {
      await open(page, "/module/money");
      await expect(page.getByText("Upcoming bills").first()).toBeVisible();
      await expect(page.getByText("Ballintemple Lettings").first()).toBeVisible();
      await expect(page.getByText("Harbourside Physio").first()).toBeVisible();
    });

    test("Ledger balances add up to the opening balances and the seeded Transactions", async ({ page }) => {
      // The seed has a fixed count of every Transaction, whatever the visit day,
      // so each balance is a known sum: opening balance + income − spending ± transfers.
      await open(page, "/module/money");
      for (const [account, balance] of [
        ["Current account", /^Current account\s*€5,079\.13$/],
        ["Savings", /^Savings\s*€7,163\.60$/],
        ["Credit card", /^Credit card\s*[-−]€489\.75$/],
        ["Net worth", /^Net worth\s*€11,752\.98$/],
      ] as const) {
        await expect(page.getByText(account, { exact: true }).locator("..")).toHaveText(balance);
      }
    });

    test("Pocket, Pantry and Shopping open with believable content", async ({ page }) => {
      await open(page, "/app/pocket");
      await expect(page.locator("main").getByText("Eating out").first()).toBeVisible();
      await expect(page.locator("main").getByText("Coffee").first()).toBeVisible();

      await open(page, "/app/pantry");
      await expect(page.locator("main").getByText("Porridge oats").first()).toBeVisible();
      await expect(page.locator("main").getByText("Frozen peas").first()).toBeVisible();

      await open(page, "/app/shopping");
      await expect(page.locator("main").getByText("Oat milk").first()).toBeVisible();
      await expect(page.locator("main").getByText("Washing-up liquid").first()).toBeVisible();
    });

    test("a Product shows its price history across more than one shop", async ({ page }) => {
      await open(page, "/app/prices");
      await page.locator("main").getByText("Semi-skimmed milk").first().click();
      await expect(page).toHaveURL(/\/app\/prices\/p\//);
      await expect(page.locator("main").getByText("Tesco").first()).toBeVisible();
      await expect(page.locator("main").getByText("Lidl").first()).toBeVisible();
    });

    test.describe("from an empty store", () => {
      test.use({ storageState: EMPTY });
      // Writing the life takes seconds of its own, behind the first screen.
      test.describe.configure({ timeout: SEEDING });
      test("with the clock pinned, the money moves with the visit day", async ({ page }) => {
        await page.clock.setFixedTime(new Date("2027-03-10T09:30:00"));
        await open(page, "/app/pocket");
        // A monthly Allowance runs over the visit day's month.
        await expect(page.locator("main").getByText(/March 2027|Mar 2027/).first()).toBeVisible();

        // The month's budget: the rent is not yet due on the 10th, the phone bills leave a little over.
        await open(page, "/module/money");
        const budget = page.locator('[data-slot="card"]').filter({ has: page.getByText("Budget this month", { exact: true }) });
        for (const category of ["Rent", "Phone & internet"]) {
          const row = budget.getByRole("button").filter({ has: page.getByText(category, { exact: true }) });
          await expect(row, category).toBeVisible();
          await expect(row, `${category} is not spent to the cent`).not.toContainText("€0.00");
        }
      });
    });
  });
}

/* ---- Demo life: time and work (#109) ---------------------------------- */

const TALK = "Injury-prevention talk for the running club";
/** The talk's deadline, in days from the visit day. */
const TALK_DAY = 4;

/** The Calendar's Upcoming day region `offset` days from the browser's today. */
async function dayOnUpcoming(page: Page, offset: number) {
  const label = await page.evaluate((o) => {
    const n = new Date();
    return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate() + o)).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  }, offset);
  return page.getByRole("region", { name: label, exact: true });
}

for (const w of WIDTHS) {
  test.describe(`Demo time and work at ${w.name} width`, () => {
    test.use({ viewport: w.viewport, isMobile: w.isMobile, hasTouch: w.hasTouch });

    test("Tasks, Projects, Chores and Events open with a lived-in life", async ({ page }) => {
      await open(page, "/app/tasks");
      await expect(page.getByText("Make the workshop slides", { exact: true }).first()).toBeVisible();

      await open(page, "/module/tasks");
      await page.getByRole("link", { name: new RegExp(TALK) }).first().click();
      await expect(page.getByText("Make the workshop slides").first()).toBeVisible();
      await expect(page.getByText("Book the club room").first()).toBeVisible();

      await open(page, "/app/chores");
      await expect(page.getByText("Wash the car", { exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Upcoming", exact: true })).toBeVisible();

      await open(page, "/app/events");
      await expect(page.getByText(/^Portuguese lesson with Luís/).first()).toBeVisible();
      await open(page, "/app/events?tab=templates");
      await expect(page.getByText("Sea swim", { exact: true }).first()).toBeVisible();
    });

    test("the Project's deadline is a marker on the Calendar", async ({ page }) => {
      await open(page, "/calendar?view=upcoming");
      const day = await dayOnUpcoming(page, TALK_DAY);
      await day.scrollIntoViewIfNeeded();
      await expect(day.getByText(`⚑ ${TALK}`)).toBeVisible();
    });

    test("completing an overdue Chore rolls it forward", async ({ page }) => {
      await open(page, "/app/chores");
      const section = (name: string) => page.locator("section").filter({ has: page.getByRole("heading", { name, exact: true }) });
      const row = section("Overdue").locator('[data-slot="card"]').filter({ hasText: "Wash the car" });
      await expect(row).toBeVisible();
      await row.getByTitle("Mark done").click();
      await expect(section("Overdue").getByText("Wash the car")).toHaveCount(0);
      await expect(section("Upcoming").getByText("Wash the car")).toBeVisible();
    });

    test.describe("from an empty store", () => {
      test.use({ storageState: EMPTY });
      // Writing the life takes seconds of its own, behind the first screen.
      test.describe.configure({ timeout: SEEDING });
      test("with the clock pinned, the deadline moves with the visit day", async ({ page }) => {
        await page.clock.setFixedTime(new Date("2027-03-10T09:30:00"));
        await open(page, "/calendar?view=upcoming");
        const day = await dayOnUpcoming(page, TALK_DAY);
        await day.scrollIntoViewIfNeeded();
        await expect(day.getByText(`⚑ ${TALK}`)).toBeVisible();
      });
    });
  });
}

// --- The banner, Reset and the Source link (#107) ---

/** The Source link the second Demo dev server is built with (playwright.config.ts). */
const SOURCE_URL = "https://github.com/grimfeld/lifeline";

function banner(page: Page) {
  return page.getByRole("region", { name: "Demo", exact: true });
}

function demoSettings(page: Page) {
  return page.getByRole("region", { name: "Demo settings", exact: true });
}

async function addTask(page: Page, title: string): Promise<void> {
  await open(page, "/app/tasks");
  await page.getByPlaceholder(/^Quick add/).fill(title);
  await page.keyboard.press("Enter");
  await expect(page.getByText(title, { exact: true })).toBeVisible();
}

/** Erase and re-seed through the app's own confirm Dialog, from wherever `scope` holds the Reset button. */
async function reset(page: Page, scope: Locator): Promise<void> {
  await scope.getByRole("button", { name: "Reset", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await Promise.all([page.waitForEvent("load"), dialog.getByRole("button", { name: "Reset", exact: true }).click()]);
  await settle(page);
}

for (const w of WIDTHS) {
  test.describe(`Demo banner and Reset at ${w.name} width`, () => {
    test.use({ viewport: w.viewport, isMobile: w.isMobile, hasTouch: w.hasTouch });

    test.describe("from an empty store", () => {
      test.use({ storageState: EMPTY });
      // Writing the life takes seconds of its own, behind the first screen.
      test.describe.configure({ timeout: SEEDING });
      test("the banner shows on first open, at the top, and staying dismissed survives a reload", async ({ page }) => {
        await open(page, "/calendar");
        const bar = banner(page);
        await expect(bar).toBeVisible();
        await expect(bar).toContainText(/your changes stay in this browser/i);
        // At the top on a phone too (ADR 0064): above the Phone header, not in the Phone dock.
        expect((await bar.boundingBox())!.y).toBeLessThan(2);

        await bar.getByRole("button", { name: "Dismiss" }).click();
        await expect(bar).toHaveCount(0);
        await page.reload();
        await settle(page);
        await expect(banner(page)).toHaveCount(0);
      });
    });

    test("the banner passes the layout checks", async ({ page }) => {
      await open(page, "/calendar");
      await expect(banner(page)).toBeVisible();
      const texts = (await banner(page).innerText()).split(/\s*\n\s*/).filter(Boolean);
      const problems = (await layoutProblems(page)).filter((p) => texts.some((t) => p.includes(t.slice(0, 20))));
      expect(problems, `the banner has broken layout:\n  ${problems.join("\n  ")}`).toEqual([]);
    });

    test.describe("from an empty store", () => {
      test.use({ storageState: EMPTY });
      // Writing the life takes seconds of its own, behind the first screen.
      test.describe.configure({ timeout: SEEDING });
      test("Reset asks first, then removes an edit and brings back the seeded life dated around today", async ({ page }) => {
        await page.clock.setFixedTime(new Date("2027-03-10T09:30:00"));
        await addTask(page, "Return the library card");

        // Cancelling keeps everything.
        await banner(page).getByRole("button", { name: "Reset", exact: true }).click();
        await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(page.getByText("Return the library card", { exact: true })).toBeVisible();

        // A week later, Reset re-seeds around the new today.
        await page.clock.setFixedTime(new Date("2027-03-17T09:30:00"));
        await reset(page, banner(page));
        // Back where a stranger lands: Home, not the page Reset was pressed on.
        await expect(page).toHaveURL(/\/screen\//);
        await expect(page.getByRole("heading", { name: "Home", exact: true })).toBeVisible();
        await open(page, "/app/tasks");
        await expect(page.getByTitle("Mark done")).not.toHaveCount(0);
        await expect(page.getByText("Return the library card", { exact: true })).toHaveCount(0);
        await expectBusyToday(page);
      });

      test("Reset stays in Settings after the banner is dismissed; Source is hidden when its URL is not set", async ({ page }) => {
        await open(page, "/settings");
        await expect(banner(page)).toBeVisible();
        await expect(page.getByRole("link", { name: /Source/ })).toHaveCount(0);
        await banner(page).getByRole("button", { name: "Dismiss" }).click();
        await expect(banner(page)).toHaveCount(0);
        await expect(demoSettings(page).getByRole("button", { name: "Reset", exact: true })).toBeVisible();
        await expect(page.getByRole("link", { name: /Source/ })).toHaveCount(0);

        await addTask(page, "Return the library card");
        await open(page, "/settings");
        await reset(page, demoSettings(page));
        await open(page, "/app/tasks");
        await expect(page.getByTitle("Mark done")).not.toHaveCount(0);
        await expect(page.getByText("Return the library card", { exact: true })).toHaveCount(0);
      });
    });
  });

  test.describe(`Demo with a Source link at ${w.name} width`, () => {
    test.use({ viewport: w.viewport, isMobile: w.isMobile, hasTouch: w.hasTouch });
    // That server listens on the port after the Demo's own.
    test.use({
      baseURL: async ({ baseURL }, use) => {
        const u = new URL(baseURL!);
        u.port = String(Number(u.port) + 1);
        await use(u.origin);
      },
    });
    // Another origin: the life demo.setup.ts saved is not there, so each case seeds its own.
    test.use({ storageState: EMPTY });
    test.describe.configure({ timeout: SEEDING });

    test("the shipped Demo carries no test hook", async ({ page }) => {
      // This build is made as the Demo is deployed; only the suite's own build hands it the registry.
      await open(page, "/calendar");
      expect(await page.evaluate(() => "lifelineDemo" in window)).toBe(false);
    });

    test("the Source link opens the repo, from the banner and from Settings", async ({ page }) => {
      await open(page, "/calendar");
      const link = banner(page).getByRole("link", { name: /Source/ });
      await expect(link).toHaveAttribute("href", SOURCE_URL);
      await expect(link).toHaveAttribute("target", "_blank");

      await banner(page).getByRole("button", { name: "Dismiss" }).click();
      await open(page, "/settings");
      await expect(demoSettings(page).getByRole("link", { name: /Source/ })).toHaveAttribute("href", SOURCE_URL);
      await expect(demoSettings(page).getByRole("button", { name: "Reset", exact: true })).toBeVisible();
    });
  });
}

/* ---------------------------------------------------------------------------
 * Demo life: media (#112) — Library, Cinema, Discotheque, Arcade, Museum.
 * ------------------------------------------------------------------------- */

/** The metadata services the media Apps can ask: none may be asked on first open. */
const METADATA_HOSTS =
  /(^|\.)(openlibrary\.org|googleapis\.com|comicvine\.gamespot\.com|themoviedb\.org|tmdb\.org|musicbrainz\.org|coverartarchive\.org|rawg\.io|wikidata\.org|wikimedia\.org|nominatim\.openstreetmap\.org)$/;

const MEDIA_PAGES = [
  { path: "/app/library", works: ["Normal People", "Vinland Saga"] },
  { path: "/app/cinema", works: ["Derry Girls", "Past Lives"] },
  { path: "/app/discotheque", works: ["Blue", "Com Que Voz"] },
  { path: "/app/arcade", works: ["Stardew Valley", "Outer Wilds"] },
  { path: "/app/museum", works: ["The Taking of Christ", "Saint Fin Barre's Cathedral"] },
] as const;

for (const w of WIDTHS) {
  test.describe(`Demo media at ${w.name} width`, () => {
    test.use({ viewport: w.viewport, isMobile: w.isMobile, hasTouch: w.hasTouch });

    test("Library, Cinema, Discotheque, Arcade and Museum open with their works", async ({ page }) => {
      for (const { path, works } of MEDIA_PAGES) {
        await open(page, path);
        for (const title of works) await expect(page.getByText(title, { exact: true }).first(), `${title} on ${path}`).toBeVisible();
      }
    });

    test("the next Part of a work in progress can be marked done", async ({ page }) => {
      await open(page, "/module/culture");
      await page.getByRole("button", { name: "Watched S2E3", exact: true }).click();
      await expect(page.getByRole("button", { name: "Watched S2E4", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Read Chapter 12", exact: true }).click();
      await expect(page.getByRole("button", { name: "Read Chapter 13", exact: true })).toBeVisible();
    });

    test("first open asks no external metadata service", async ({ page }) => {
      const asked: string[] = [];
      page.on("request", (r) => {
        if (METADATA_HOSTS.test(new URL(r.url()).hostname)) asked.push(r.url());
      });
      await open(page, "/module/culture");
      for (const { path } of MEDIA_PAGES) await open(page, path);
      // An Author's page looks their bibliography up whenever they carry an external key.
      await open(page, "/app/library");
      await page.getByRole("button", { name: "Open Normal People" }).first().click();
      await page.getByRole("dialog").getByRole("link", { name: "Sally Rooney" }).first().click();
      await expect(page).toHaveURL(/\/app\/library\/authors\//);
      await expect(page.getByText("Sally Rooney").first()).toBeVisible();
      await page.waitForLoadState("networkidle");
      expect(asked, "requests to metadata services").toEqual([]);
    });

    test.describe("from an empty store", () => {
      test.use({ storageState: EMPTY });
      // Writing the life takes seconds of its own, behind the first screen.
      test.describe.configure({ timeout: SEEDING });
      test("with the clock pinned to another day, the media dates follow it", async ({ page }) => {
        await page.clock.setFixedTime(new Date("2027-03-10T09:30:00"));
        // Hung twelve days before the visit.
        await open(page, "/app/museum");
        await expect(page.getByText(/since 2027-02-26/)).toBeVisible();
        // Started twelve days before the visit, too.
        await open(page, "/app/cinema");
        await page.getByRole("button", { name: "Open Derry Girls" }).first().click();
        await expect(page.getByRole("dialog").getByText("2027-02-26", { exact: true })).toBeVisible();
      });
    });
  });
}

// ---- Demo life: writing and the Journal (#111) ----------------------------

/** On a phone the Document panel (Reports, Backlinks) is a sheet behind a button. */
async function openDocPanel(page: Page, isMobile: boolean): Promise<void> {
  if (isMobile) await page.getByRole("button", { name: "Toggle links panel" }).click();
}

/** The Journal page on screen has links, and every one of them finds its page. */
async function expectLinksResolve(page: Page): Promise<void> {
  await expect(page.locator(".cm-wikilink").first()).toBeVisible();
  await expect(page.locator(".cm-wikilink-unresolved")).toHaveCount(0);
  // Every name in the seeded prose is linked: no "Unlinked names" left to tidy.
  await expect(page.getByText(/^Unlinked names · [1-9]/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /unlinked/ })).toHaveCount(0);
}

for (const w of WIDTHS) {
  test.describe(`Demo writing and Journal at ${w.name} width`, () => {
    test.use({ viewport: w.viewport, isMobile: w.isMobile, hasTouch: w.hasTouch });

    test("the writing pages open with believable content", async ({ page }) => {
      await open(page, "/app/journal");
      await expect(page.getByText(/Huddle with/).first()).toBeVisible();
      await expect(page.getByText("Histoire du jour")).toHaveCount(0);

      const pages: [string, string | RegExp][] = [
        ["/app/notes", "The Long Run"],
        ["/app/quotes", /The body keeps/],
        ["/app/research", "What rest is for"],
        ["/app/manuscripts", "The Tide Tables"],
        ["/app/thoughts", "Rehab is mostly patience"],
        ["/app/languages?tab=words", "saudade"],
      ];
      for (const [path, text] of pages) {
        await open(page, path);
        await expect(page.locator("main").getByText(text).first(), path).toBeVisible();
      }
    });

    test("a person's page shows backlinks and Reports from Journal Days", async ({ page }) => {
      await open(page, "/app/journal/t/person");
      await expect(page.getByText("Top mentioned")).toBeVisible();
      await page.getByRole("link", { name: /^Aoife Brennan/ }).click();
      await openDocPanel(page, w.isMobile);
      await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
      await expect(page.getByText("Last mentioned")).toBeVisible();
      await expect(page.getByText(/\d+ this year · \d+ in all/)).toBeVisible();
      const backlinks = page.getByRole("heading", { name: /^Backlinks · \d+$/ });
      await expect(backlinks).toBeVisible();
      expect(Number((await backlinks.textContent())!.split("·")[1]), "Days linking to Aoife").toBeGreaterThanOrEqual(4);
    });

    test("wikilinks in the seeded Days resolve to the seeded people and places", async ({ page }) => {
      await open(page, "/app/journal");
      await expectLinksResolve(page);
      // A week of Days back: each one written links only to pages that exist.
      for (let i = 1; i <= 7; i++) {
        await page.getByRole("button", { name: "Previous day" }).click();
        await expect(page).toHaveURL(new RegExp(`[?&]d=${await pageDay(page, -i)}`));
        if (await page.getByText(/^No entry for/).isVisible()) continue;
        await expectLinksResolve(page);
      }
    });

    test.describe("from an empty store", () => {
      test.use({ storageState: EMPTY });
      // Writing the life takes seconds of its own, behind the first screen.
      test.describe.configure({ timeout: SEEDING });
      test("the Journal is dated around the visit day", async ({ page }) => {
        await page.clock.setFixedTime(new Date("2027-03-10T09:30:00"));
        await open(page, "/app/journal");
        // Today's Journal is the bare address; one day back carries ?d=, so the clock's day is the Journal's today.
        await expect(page).toHaveURL(/\/app\/journal$/);
        await expect(page.getByText(/Huddle with/).first()).toBeVisible();
        await page.getByRole("button", { name: "Previous day" }).click();
        await expect(page).toHaveURL(/[?&]d=2027-03-09/);
        await expectLinksResolve(page);
      });
    });
  });
}

/* ---------------------------------------------------------------------------
 * Demo Home and Overviews; every App non-empty (#114).
 * ------------------------------------------------------------------------- */

/**
 * Every registered App's page and what it should show: read from the App
 * registry the Demo build hands the suite (src/demo/inspect.ts), never a hand
 * list, so a new App the Demo life misses fails here.
 */
async function appPages(page: Page) {
  await page.waitForFunction(() => !!window.lifelineDemo);
  return page.evaluate(() => window.lifelineDemo!.appPages());
}

for (const w of WIDTHS) {
  test.describe(`Demo Home, Overviews and every App at ${w.name} width`, () => {
    test.use({ viewport: w.viewport, isMobile: w.isMobile, hasTouch: w.hasTouch });

    test.describe("from an empty store", () => {
      test.use({ storageState: EMPTY });
      // Writing the life takes seconds of its own, behind the first screen.
      test.describe.configure({ timeout: SEEDING });
      test("first open lands on Home: Cards filled from the seeded life, today's agenda on the hours", async ({ page }) => {
        await open(page, "/");
        await expect(page).toHaveURL(/\/screen\//);
        await expect(page.getByRole("heading", { name: "Home", exact: true })).toBeVisible();
        const main = page.locator("main");
        // The hour-scaled agenda, holding today's timed Events.
        await expect(main.getByText("Today's agenda", { exact: true })).toBeVisible();
        await expect(main.getByText(/^Team huddle with Sam/).first()).toBeVisible();
        await expect(main.getByText(/^Climbing with Marcus/).first()).toBeAttached();
        // Every other Card is set up and shows the life, not an empty state.
        for (const title of ["Tasks today", "Chores due today", "Daily marks", "What's left", "Reading"]) {
          await expect(main.getByText(title, { exact: true }).first(), title).toBeAttached();
        }
        await expect(main.getByText("Take out the recycling").first()).toBeAttached();
        await expect(main.getByText("Normal People").first()).toBeAttached();
        await expect(main.getByText("Not configured yet.")).toHaveCount(0);
        if (w.isMobile) {
          // On the Phone bar, beside Calendar.
          await expect(page.locator("nav").getByRole("button", { name: "Home", exact: true })).toBeVisible();
          // The first screen shows the day's work and mood, not one tall agenda.
          await page.evaluate(() => window.scrollTo(0, 0));
          for (const title of ["Tasks today", "Today's mood"]) await expect(main.getByText(title, { exact: true }).first(), title).toBeInViewport();
        }
      });

      test("Home shows before the whole life is written; a reload meanwhile starts over without doubling it", async ({ page }) => {
        await page.goto("/");
        // Today first: Home and its agenda are up while the rest is still being written.
        await expect(page.getByRole("heading", { name: "Home", exact: true })).toBeVisible({ timeout: 20_000 });
        await expect(filling(page)).toBeVisible();
        await expect(page.locator("main").getByText(/^Team huddle with Sam/).first()).toBeVisible();

        // Reloading halfway erases the half-written life and writes it again, once.
        await page.reload();
        // The reloaded app erases the half-written life and reloads itself
        // (`eraseDevice`); a goto sent before that lands is interrupted by it.
        // "Filling in…" again means the second start is seeding.
        await expect(filling(page)).toBeVisible({ timeout: 20_000 });
        await open(page, "/app/tasks");
        await expect(page.getByText("Renew the bike insurance", { exact: true })).toHaveCount(1);
        await open(page, "/app/stats");
        await expect(page.getByText("Stretching", { exact: true })).toHaveCount(1);
        await open(page, "/screens");
        await expect(page.locator("main").getByText("Home", { exact: true })).toHaveCount(1);
      });

      test("when the life cannot be written, says so instead of opening half-empty, and tries again", async ({ page }) => {
        const seedChunk = /\/assets\/seed-[^/]*\.js$/;
        await page.route(seedChunk, (r) => r.abort());
        await page.goto("/");
        await expect(page.getByRole("alert")).toContainText("The Demo could not be set up");
        await expect(page.locator("main")).toHaveCount(0);

        await page.unroute(seedChunk);
        await page.getByRole("button", { name: "Try again" }).click();
        await settle(page);
        await expect(page.getByRole("heading", { name: "Home", exact: true })).toBeVisible();
      });

      test("on New Year's Day the Culture overview still shows a finished book and film", async ({ page }) => {
        await page.clock.setFixedTime(new Date("2027-01-01T09:30:00"));
        await open(page, "/module/culture");
        const main = page.locator("main");
        await expect(main.getByTitle(/^Small Things Like These/).first()).toBeAttached();
        await expect(main.getByTitle(/^The Banshees of Inisherin/).first()).toBeAttached();
      });
    });

    test("the Culture overview shows each work in progress whole, and its sidebar names each list once", async ({ page }) => {
      await open(page, "/module/culture");
      const main = page.locator("main");
      // The chip under a cover is the last thing in its Card: not cut off by the Card's bottom.
      for (const [card, chip] of [["Reading", "Book"], ["Watching", "Series"]] as const) {
        const box = main.locator('[data-slot="card"]').filter({ has: page.getByText(card, { exact: true }) }).first();
        const bottom = await box.evaluate((el) => el.getBoundingClientRect().bottom);
        const chipBottom = await box.getByText(chip, { exact: true }).first().evaluate((el) => el.getBoundingClientRect().bottom);
        expect(chipBottom, `${card}: the ${chip} chip is inside its Card`).toBeLessThanOrEqual(bottom);
      }
      if (!w.isMobile) {
        const labels = (await page.locator('a[href^="/base/"]').allInnerTexts()).map((t) => t.trim());
        expect(labels.length, "Raw data links").toBeGreaterThan(0);
        expect(labels.filter((l, i) => labels.indexOf(l) !== i), "Raw data links named twice").toEqual([]);
      }
    });

    test("a loaded Demo keeps working offline", async ({ page, context }) => {
      await open(page, "/settings");
      await context.setOffline(true);
      // Moving around inside the app needs nothing from the network.
      await page.evaluate(() => {
        history.pushState(null, "", "/app/tasks");
        dispatchEvent(new PopStateEvent("popstate"));
      });
      await expect(page.getByText("Renew the bike insurance", { exact: true }).first()).toBeVisible();
      await page.getByPlaceholder(/^Quick add/).fill("Post the birthday card");
      await page.keyboard.press("Enter");
      await expect(page.getByText("Post the birthday card", { exact: true })).toBeVisible();
      await page.evaluate(() => {
        history.pushState(null, "", "/module/culture");
        dispatchEvent(new PopStateEvent("popstate"));
      });
      await expect(page.locator("main").getByText("Reading", { exact: true }).first()).toBeVisible();
      await context.setOffline(false);
    });

    test("the key Overviews are arranged with more Cards, each showing the seeded life", async ({ page }) => {
      // What each shows, as text or (a cover, a grid cell) as its hover title.
      const overviews: [string, (string | RegExp)[], RegExp[]][] = [
        ["/module/money", ["What's left", "Balances", /Semi-skimmed milk/], []],
        ["/module/house", ["Chores due today", "Chores · 6 weeks"], []],
        ["/module/culture", ["Reading"], [/^Small Things Like These/, /^The Banshees of Inisherin/]],
        ["/module/progress", [/Resting heart rate/, "Recent sessions"], [MOOD_CELL]],
      ];
      for (const [path, texts, titles] of overviews) {
        await open(page, path);
        const main = page.locator("main");
        for (const t of texts) await expect(main.getByText(t).first(), `${path}: ${t}`).toBeAttached();
        for (const t of titles) await expect(main.getByTitle(t).first(), `${path}: ${t}`).toBeAttached();
        await expect(main.getByText("Not configured yet."), path).toHaveCount(0);
      }
    });

    test("every registered App's page opens with something of its own in it", async ({ page }) => {
      // One page over the seeded life, visiting every App; it fails once, naming them all.
      test.setTimeout(120_000);
      await open(page, "/settings");
      const pages = await appPages(page);
      expect(pages.length, "Apps found in the registry").toBeGreaterThan(20);
      const empty: string[] = [];
      for (const p of pages) {
        if (p.titles.length === 0) {
          empty.push(`${p.app}: nothing seeded`);
          continue;
        }
        await open(page, p.route);
        const main = page.locator("main").first();
        let text = "";
        const shows = async () => {
          // What it reads, and what its icons and grid cells say on hover.
          text = [
            await main.innerText(),
            ...(await main
              .locator("[title], [aria-label]")
              .evaluateAll((els) => els.map((e) => `${e.getAttribute("title") ?? ""} ${e.getAttribute("aria-label") ?? ""}`))),
          ].join("\n");
          return p.titles.some((t) => t.length >= 3 && text.includes(t));
        };
        // A page fills in as its queries answer: give it a moment, not a fixed wait.
        const shown = await expect
          .poll(shows, { timeout: 5_000 })
          .toBe(true)
          .then(() => true, () => false);
        if (!shown)
          empty.push(`${p.app}: ${p.route} shows none of its Documents (${p.titles.slice(0, 3).join(" | ")}); it reads "${text.slice(0, 160).replace(/\s+/g, " ")}"`);
      }
      expect(empty, `Apps that open empty in the Demo:\n  ${empty.join("\n  ")}`).toEqual([]);
    });
  });
}

/** How long a stranger waits on first open, on the production build: logged, not asserted. */
test.describe("Demo first open, timed", () => {
  test.use({ storageState: EMPTY, viewport: { width: 1280, height: 800 } });
  test.describe.configure({ timeout: SEEDING });

  test("logs the time from navigation to today's seeded agenda on Home", async ({ page }, info) => {
    await page.goto("/");
    await expect(page.locator("main").getByText(/^Team huddle with Sam/).first()).toBeVisible();
    // Milliseconds since this navigation started, as the page measures it.
    const ms = Math.round(await page.evaluate(() => performance.now()));
    info.annotations.push({ type: "first-open-ms", description: String(ms) });
    console.log(`Demo first open: ${ms} ms from navigation to today's agenda on Home`);
    // And the rest of the life, written behind it.
    await expect(filling(page)).toHaveCount(0, { timeout: WRITTEN });
    const all = Math.round(await page.evaluate(() => performance.now()));
    info.annotations.push({ type: "whole-life-ms", description: String(all) });
    console.log(`Demo first open: ${all} ms until the whole life is written`);
  });
});
