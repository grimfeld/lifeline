import { test, expect, type Page } from "@playwright/test";
import { CORE_URL } from "./support/seed";
import { expectNoBrokenLayout, layoutProblems } from "./support/layout";

/**
 * Every screen of the app, at phone and desktop width (the `mobile` and
 * `desktop` projects), over a store filled with very long content: nothing
 * may spill out of its box, be cut off without an ellipsis, or make a box
 * scroll sideways that is not meant to.
 *
 * The rule (CLAUDE.md): a new screen gets a row here. The last test fails
 * when a registered screen, Module page, Surface or Calendar view has none.
 */
interface ScreenCase {
  name: string;
  /** Route; a `:id` is filled with the first Document of `type`. */
  path: string;
  type?: string;
  /** Other route parameters, filled as given (`{ key: "2026-W42" }` for `:key`). */
  params?: Record<string, string>;
  /** What to do once the screen is open, before it is checked — open a dialog. */
  afterOpen?: (page: Page) => Promise<void>;
}

/** Journal → Types → the Type editor over the seeded People type. A fresh store greets with "You're signed out" over the page. */
async function openPeopleTypeEditor(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
  await page.getByRole("button", { name: /^Edit the type People/ }).first().click();
}

const SCREENS: ScreenCase[] = [
  // Core destinations.
  { name: "Calendar · Upcoming", path: "/calendar?view=upcoming" },
  { name: "Calendar · Day", path: "/calendar?view=day" },
  { name: "Calendar · 3 Day", path: "/calendar?view=3day" },
  { name: "Calendar · Week", path: "/calendar?view=week" },
  { name: "Calendar · Month", path: "/calendar?view=month" },
  { name: "Map", path: "/map" },
  { name: "Graph", path: "/graph" },
  { name: "Bases", path: "/base" },
  { name: "Base", path: "/base/task" },
  { name: "Screens", path: "/screens" },
  { name: "Screen with every Card", path: "/screen/e2elongcontent1" },
  { name: "Settings", path: "/settings" },

  // Modules.
  { name: "House", path: "/module/house" },
  { name: "House · Calendar", path: "/module/house/calendar" },
  { name: "Projects", path: "/module/tasks" },
  { name: "Culture", path: "/module/culture" },
  { name: "Money", path: "/module/money" },
  { name: "Progress", path: "/module/progress" },
  { name: "Knowledge module", path: "/module/languages" },
  { name: "Mail module", path: "/module/mail" },
  { name: "Journal module", path: "/module/journal" },
  { name: "Notes module", path: "/module/notes" },
  { name: "Thoughts module", path: "/module/thoughts" },
  { name: "Research module", path: "/module/research" },
  { name: "Manuscript module", path: "/module/manuscript" },

  // The Vault (Note-taking's layout).
  { name: "Vault", path: "/vault" },
  { name: "Journal · Today", path: "/app/journal" },
  { name: "Journal · Week", path: "/app/journal/p/:key", params: { key: "2026-W42" } },
  { name: "Journal · Year", path: "/app/journal/p/2026" },
  { name: "Journal · Types", path: "/app/journal/t" },
  { name: "Journal · Types (old link)", path: "/app/journal/c" },
  {
    // The Type editor over the seeded type with long Field, option and type labels, every fold-out open.
    name: "Journal · Types · Type editor",
    path: "/app/journal/t",
    afterOpen: async (page) => {
      await openPeopleTypeEditor(page);
      const gears = page.getByRole("dialog").getByRole("button", { name: "Field settings" });
      await expect(gears.first()).toBeVisible();
      for (const g of await gears.all()) await g.click();
    },
  },
  {
    // The Type editor's "+ Field" menu open: a dropdown on the desk, a bottom sheet on a phone.
    name: "Journal · Types · + Field menu",
    path: "/app/journal/t",
    afterOpen: async (page) => {
      await openPeopleTypeEditor(page);
      await page.getByRole("dialog").getByRole("button", { name: "Field", exact: true }).click();
      await expect(page.getByText("adds a board layout to its Base")).toBeVisible();
    },
  },
  { name: "Journal · One type", path: "/app/journal/t/:type", params: { type: "e2eperson" } },
  { name: "Journal · One type (old link)", path: "/app/journal/c/:type", params: { type: "e2eperson" } },
  { name: "Journal · Templates", path: "/app/journal/templates" },
  { name: "Journal · Page", path: "/app/journal/d/:id", type: "template" },
  { name: "Vault · Thought", path: "/vault/d/:id", type: "thought" },

  // App screens.
  { name: "Chores", path: "/app/chores" },
  { name: "Pantry", path: "/app/pantry" },
  { name: "Shopping list", path: "/app/shopping" },
  { name: "Tasks", path: "/app/tasks" },
  {
    // The Archived tab: an EmptyState (nothing is archived in the seed). A select on a phone.
    name: "Tasks · Archived",
    path: "/app/tasks",
    afterOpen: async (page) => {
      const local = page.getByRole("button", { name: "Work locally" });
      await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
      if ((page.viewportSize()?.width ?? 0) >= 768) await page.getByRole("tab", { name: /^Archived/ }).click();
      else {
        await page.getByRole("combobox", { name: "View" }).click();
        await page.getByRole("option", { name: /^Archived/ }).click();
      }
      await expect(page.getByText("Archive is empty.")).toBeVisible();
    },
  },
  { name: "Projects · Timeline", path: "/app/projects/timeline" },
  { name: "Project", path: "/app/projects/p/:id", type: "project" },
  { name: "Events", path: "/app/events" },
  {
    // The Event dialog saved without a title: the Field's error under the title, not a toast.
    name: "Events · Event dialog error",
    path: "/app/events",
    afterOpen: async (page) => {
      const local = page.getByRole("button", { name: "Work locally" });
      await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
      await page.getByRole("button", { name: "New event" }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("button", { name: "Add event" }).click();
      const title = dialog.getByRole("textbox", { name: "Title" });
      await expect(title).toHaveAttribute("aria-invalid", "true");
      await expect(title).toHaveAccessibleDescription("Title required");
      await expect(title).toBeFocused();
      await expect(page.getByText("Title required"), "under the field only, no toast").toHaveCount(1);
    },
  },
  { name: "Stats", path: "/app/stats" },
  { name: "Stat", path: "/app/stats/:id", type: "stat" },
  { name: "Life Level", path: "/app/lifelevel" },
  { name: "Habit", path: "/app/lifelevel/:id", type: "habit" },
  { name: "Library", path: "/app/library" },
  { name: "Author", path: "/app/library/authors/:id", type: "author" },
  { name: "Cinema", path: "/app/cinema" },
  { name: "Discotheque", path: "/app/discotheque" },
  { name: "Arcade", path: "/app/arcade" },
  { name: "Quotes", path: "/app/quotes" },
  { name: "Museum", path: "/app/museum" },
  { name: "Exhibition", path: "/app/museum/e/:id", type: "exhibition" },
  { name: "Thoughts", path: "/app/thoughts" },
  { name: "Thought", path: "/app/thoughts/:id", type: "thought" },
  { name: "Notes · Sources", path: "/app/notes" },
  { name: "Notes · Source", path: "/app/notes/s/:id", type: "source" },
  { name: "Notes · Note", path: "/app/notes/n/:id", type: "note" },
  { name: "Research", path: "/app/research" },
  { name: "Essay", path: "/app/research/e/:id", type: "essay" },
  { name: "Manuscripts", path: "/app/manuscripts" },
  { name: "Manuscript", path: "/app/manuscripts/m/:id", type: "manuscript" },
  { name: "Windows", path: "/app/sources" },
  { name: "Window", path: "/app/sources/:id", type: "window" },
  { name: "Workout", path: "/app/workout" },
  { name: "Workout timer", path: "/app/workout/run/:id", type: "workout" },
  { name: "Ledger", path: "/app/ledger" },
  { name: "Budget", path: "/app/ledger/budget" },
  { name: "Money reports", path: "/app/ledger/reports" },
  { name: "Pocket", path: "/app/pocket" },
  { name: "Prices", path: "/app/prices" },
  { name: "Price product", path: "/app/prices/p/:id", type: "price_product" },
  { name: "Mood", path: "/app/mood" },
  { name: "Mail", path: "/app/mail" },
  { name: "Swear Jar", path: "/app/swearjar" },
  { name: "Knowledge", path: "/app/languages" },
];

async function firstOfType(page: Page, type: string): Promise<string> {
  return page.evaluate(
    async ({ coreUrl, type }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      const [doc] = await core.documentsOf(type);
      return doc?.id ?? "";
    },
    { coreUrl: CORE_URL, type },
  );
}

async function open(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await expect(page.locator("#root")).not.toBeEmpty();
}

for (const screen of SCREENS) {
  test(`${screen.name} holds long content`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    let path = screen.path;
    if (screen.type) {
      await open(page, "/settings");
      const id = await firstOfType(page, screen.type);
      expect(id, `a seeded ${screen.type}`).not.toBe("");
      path = path.replace(":id", id);
    }
    for (const [k, v] of Object.entries(screen.params ?? {})) path = path.replace(`:${k}`, v);
    await open(page, path);
    await screen.afterOpen?.(page);
    await expectNoBrokenLayout(page, screen.name);
    expect(errors, `no uncaught errors:\n  ${errors.join("\n  ")}`).toEqual([]);
  });
}

test("the Document page holds long content for every type", async ({ page }) => {
  test.setTimeout(600_000);
  await open(page, "/settings");
  const docs = await page.evaluate(async (coreUrl) => {
    const core = await import(/* @vite-ignore */ coreUrl);
    const out: { type: string; id: string }[] = [];
    for (const def of core.allDocumentTypes()) {
      const [doc] = await core.documentsOf(def.id);
      if (doc) out.push({ type: def.id, id: doc.id });
    }
    return out;
  }, CORE_URL);
  const broken: string[] = [];
  for (const { type, id } of docs) {
    await open(page, `/vault/d/${id}`);
    for (const p of await layoutProblems(page)) broken.push(`${type}: ${p}`);
  }
  expect(broken, `the Document page has broken layout:\n  ${broken.join("\n  ")}`).toEqual([]);
});

test("every screen has a row in this file", async ({ page }) => {
  await open(page, "/settings");
  const registered = await page.evaluate(async (coreUrl) => {
    const core = await import(/* @vite-ignore */ coreUrl);
    const { MODULE_SHELLS } = await import(/* @vite-ignore */ "/src/modules/shells.ts");
    const routes: string[] = [];
    for (const s of core.screensOf()) routes.push(core.screenRoute(s));
    for (const f of core.frames()) for (const s of core.screensOf(f.id)) routes.push(core.screenRoute(s));
    for (const m of core.MODULES) {
      routes.push(core.moduleHome(m));
      for (const p of MODULE_SHELLS[m.id]?.pages ?? []) if (p.path) routes.push(`/module/${m.id}/${p.path}`);
    }
    for (const s of core.SURFACES) routes.push(s.path);
    for (const v of core.CALENDAR_VIEWS) routes.push(`/calendar?view=${v.id}`);
    return routes;
  }, CORE_URL);
  const covered = new Set(SCREENS.map((s) => s.path));
  // A Module whose home is a frame lands on that frame's home screen, covered above.
  const missing = registered.filter((r) => !covered.has(r) && r !== "/vault" && r !== "/calendar");
  expect(missing, "screens without a long-content layout test — add them to SCREENS in e2e/screens.spec.ts").toEqual([]);
});
