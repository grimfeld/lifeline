import { test, expect, type Locator, type Page } from "@playwright/test";
import { layoutProblems } from "./support/layout";

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
  await page.waitForLoadState("networkidle");
  await expect(page.locator("#root")).not.toBeEmpty();
}

for (const w of WIDTHS) {
  test.describe(`Demo banner and Reset at ${w.name} width`, () => {
    test.use({ viewport: w.viewport, isMobile: w.isMobile, hasTouch: w.hasTouch });

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
      await page.waitForLoadState("networkidle");
      await expect(page.locator("#root")).not.toBeEmpty();
      await page.waitForTimeout(500);
      await expect(banner(page)).toHaveCount(0);
    });

    test("the banner passes the layout checks", async ({ page }) => {
      await open(page, "/calendar");
      await expect(banner(page)).toBeVisible();
      const texts = (await banner(page).innerText()).split(/\s*\n\s*/).filter(Boolean);
      const problems = (await layoutProblems(page)).filter((p) => texts.some((t) => p.includes(t.slice(0, 20))));
      expect(problems, `the banner has broken layout:\n  ${problems.join("\n  ")}`).toEqual([]);
    });

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
}
