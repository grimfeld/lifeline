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

    test("with the clock pinned, the deadline moves with the visit day", async ({ page }) => {
      await page.clock.setFixedTime(new Date("2027-03-10T09:30:00"));
      await open(page, "/calendar?view=upcoming");
      const day = await dayOnUpcoming(page, TALK_DAY);
      await day.scrollIntoViewIfNeeded();
      await expect(day.getByText(`⚑ ${TALK}`)).toBeVisible();
    });
  });
}
