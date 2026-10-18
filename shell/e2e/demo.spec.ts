import { test, expect, type Page } from "@playwright/test";

/**
 * The Demo (CONTEXT.md "Demo", ADR 0077): the build with `VITE_DEMO=1`, as a
 * stranger opening the link meets it — a fresh browser, no backend, at phone
 * and desktop width. Run by the `demo` project, against its own dev server.
 */
const WIDTHS = [
  { name: "phone", viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true },
  { name: "desktop", viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false },
] as const;

/** Open a page and let it settle: the signed-out sign-in used to open a beat after load. */
async function open(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await expect(page.locator("#root")).not.toBeEmpty();
  // First open writes the Demo life behind "Loading…"; leaving before it ends would start it over.
  await expect(page.getByRole("status").filter({ hasText: /^Loading…$/ })).toHaveCount(0, { timeout: 30_000 });
  await page.waitForTimeout(1_000);
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

    test("Mail is not in the navigation and its routes do not open", async ({ page }) => {
      await open(page, "/calendar");
      if (w.isMobile) await page.getByTitle("Menu").click();
      await expect(page.locator('a[href="/module/mail"], a[href^="/app/mail"]')).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Mail", exact: true })).toHaveCount(0);

      for (const path of ["/app/mail", "/module/mail"]) {
        await open(page, path);
        expect(new URL(page.url()).pathname, `${path} redirects away`).not.toMatch(/mail/);
      }
    });

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
      await page.waitForLoadState("networkidle");
      await expect(page.getByText("Return the library card", { exact: true })).toBeVisible();
      await page.waitForTimeout(1_000);
      await expect(ticks).toHaveCount(seeded + 1);
    });

    test("with the clock pinned to another day, that day's agenda is full", async ({ page }) => {
      await page.clock.setFixedTime(new Date("2027-03-10T09:30:00"));
      await expectBusyToday(page);
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
  const longest = Math.max(...(await streaks.allInnerTexts()).map((t) => Number(t.trim())));
  expect(longest, "a streak on the Stats list").toBeGreaterThanOrEqual(7);

  await openStat(page, "Stretching");
  const run = await page.getByText(/day streak/).innerText();
  expect(Number(run.match(/(\d+)\s*day streak/)?.[1]), "streak on the visit day").toBeGreaterThanOrEqual(7);
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

    test("with the clock pinned to another day, streaks and moods run up to it", async ({ page }) => {
      await page.clock.setFixedTime(new Date("2027-03-10T09:30:00"));
      await expectLiveStreak(page);
      await open(page, "/app/mood");
      expect(await page.getByRole("button", { name: MOOD_CELL }).count(), "moods in March").toBeGreaterThanOrEqual(6);
    });
  });
}
