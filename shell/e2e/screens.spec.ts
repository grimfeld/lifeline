import { test, expect, type Page } from "@playwright/test";
import { encodeHandoff } from "@lifeline/handoff";
import { CORE_URL, LONG_WORD, longText } from "./support/seed";
import { expectNoBrokenLayout, layoutProblems } from "./support/layout";
import { selectText } from "./support/selection";

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

/** Dismisses the "You're signed out" notice a fresh store greets with, so the page under it is checked. */
async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

/** Journal → Types → the Type editor over the seeded People type. */
async function openPeopleTypeEditor(page: Page) {
  await workLocally(page);
  await page.getByRole("button", { name: /^Edit the type People/ }).first().click();
}

/**
 * A family App's QuickAdd with its list open over a very long typed title: the
 * "Add …" row, and where the lookup is keyless (Open Library, MusicBrainz)
 * one hit with a long title and byline, answered here so nothing leaves the machine.
 */
async function openQuickAdd(page: Page) {
  await page.route(/^https:\/\/(?!localhost)/, (route) => {
    const url = route.request().url();
    const title = longText("Looked-up title");
    const creator = longText("Looked-up creator");
    if (url.startsWith("https://openlibrary.org/search.json"))
      return route.fulfill({ json: { docs: [{ key: "/works/OL1W", title, author_name: [creator], first_publish_year: 1999 }] } });
    if (url.startsWith("https://musicbrainz.org/ws/2/release-group"))
      return route.fulfill({ json: { "release-groups": [{ id: "e2e", title, "first-release-date": "1999", "artist-credit": [{ name: creator }] }] } });
    return route.abort();
  });
  await workLocally(page);
  await page.getByRole("combobox", { name: /^Quick add/ }).fill(longText("Typed title"));
  await expect(page.getByRole("listbox", { name: "Lookup results" }).getByRole("option").first()).toContainText("Add “Typed title");
}

/**
 * A family App's Shelf switch (ToggleGroup): on the desk the arrow keys move
 * between choices and Enter picks one; on a phone it is a select, left open.
 */
async function openShelf(page: Page) {
  await workLocally(page);
  if ((page.viewportSize()?.width ?? 0) < 768) {
    await page.getByRole("combobox", { name: "Shelf" }).click();
    await expect(page.getByRole("listbox")).toBeVisible();
    return;
  }
  const shelf = page.getByRole("radiogroup", { name: "Shelf" });
  await shelf.getByRole("radio", { checked: true }).focus();
  await page.keyboard.press("ArrowRight");
  const first = shelf.getByRole("radio").first();
  await expect(first).toBeFocused(); // "All" is last: the arrow wraps round to the first Shelf
  await page.keyboard.press("Enter");
  await expect(first).toHaveAttribute("aria-checked", "true");
}

/** The longest Handoff the Lifeline extension could send (ADR 0080), to the Quote Intake — the dialog that shows it all. */
const LONG_HANDOFF = encodeHandoff(
  {
    title: longText("A page"),
    text: `${longText("A passage")}\n\n${"A selected paragraph that runs on and on. ".repeat(60)}\n\n- ${LONG_WORD}\n- ${longText("A list item")}`,
    url: `https://example.com/${LONG_WORD}/${LONG_WORD}?q=${LONG_WORD}`,
    author: longText("An author"),
    date: "2026-10-18",
  },
  "commonplace/quote",
);

/** The Handoff page's picker with a second Workspace, long-named, so the Workspace question is asked too. */
async function pickerWithWorkspaces(page: Page) {
  await workLocally(page);
  await page.evaluate(
    async ({ coreUrl, name }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      if ((await core.allWorkspaces()).length < 2) await core.createWorkspace(name, []);
    },
    { coreUrl: CORE_URL, name: longText("A Workspace") },
  );
  await page.getByRole("combobox", { name: "Workspace" }).waitFor();
}

/**
 * A Peek (ADR 0085) of the first Document of `type`, opened over the page —
 * with, when `userField` is given, a long-labelled Field of the user's added
 * to that (built-in) type first, so it is drawn beneath the App's part.
 */
function peekOf(type: string, userField?: boolean) {
  return async (page: Page) => {
    await workLocally(page);
    await page.evaluate(
      async ({ coreUrl, type, userField, label }) => {
        const core = await import(/* @vite-ignore */ coreUrl);
        if (userField) await core.saveDocumentType({ typeId: type, label: "Books", icon: "book", folder: "", order: 0, fields: [{ key: "lentTo", label, kind: "text" }] });
        for (let i = 0; i < 50 && userField && !core.documentType(type)?.fields.some((f: { key: string }) => f.key === "lentTo"); i++) await new Promise((r) => setTimeout(r, 100));
        const [doc] = await core.documentsOf(type);
        if (userField) await core.patchDocument(doc.id, { lentTo: label });
        core.openPeek(doc.id);
      },
      { coreUrl: CORE_URL, type, userField: !!userField, label: longText("Lent to") },
    );
    await page.getByRole("dialog").waitFor();
  };
}

/** What Android's share sheet would open (the manifest's GET share target): no title, a long text with a long URL buried in it. */
const LONG_SHARE = `/handoff?${new URLSearchParams({ text: `${longText("A shared passage")} https://${LONG_WORD.slice(0, 60)}.example.org/${LONG_WORD} ${longText("And more")}` })}`;

/** The share sheet's Handoff, saved as a Task: the done state that offers to open it or go back. */
async function sharedAndSaved(page: Page) {
  await workLocally(page);
  await page.getByRole("combobox", { name: "Intake" }).click();
  await page.getByRole("option", { name: "Task", exact: true }).click();
  await page.getByRole("button", { name: "Open the Task" }).click();
  await page.getByRole("dialog", { name: "New task" }).getByRole("button", { name: "Add task" }).click();
  await page.getByRole("button", { name: "Go back" }).waitFor();
}

/**
 * Today's Day naming a seeded Person with a very long title (of the seeded
 * type with a very long label), that name selected and the Selection menu
 * open: Link first, then every Intake under its Module. A second Person, also
 * very long, is there for "Link to…" to find.
 */
async function openSelectionMenu(page: Page) {
  await workLocally(page);
  const name = await page.evaluate(
    async ({ coreUrl, name, other }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      const pad = (n: number) => String(n).padStart(2, "0");
      const now = new Date();
      const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      let day: { id: string } | undefined;
      for (let i = 0; i < 40 && !day; i++) {
        day = ((await core.documentsOf("daily")) as { id: string; title: string }[]).find((d) => d.title === today);
        if (!day) await new Promise((r) => setTimeout(r, 100));
      }
      await core.createDocument({ type: "e2eperson", title: name });
      await core.createDocument({ type: "e2eperson", title: other });
      await core.patchDocument(day!.id, { body: `Met ${name} today.` });
      return name;
    },
    { coreUrl: CORE_URL, name: longText("Selected person"), other: longText("Linked person") },
  );
  const body = page.locator(".cm-content");
  await expect(body).toContainText(name);
  await selectText(body, name);
  await page.getByRole("button", { name: "Selection menu" }).click();
  await expect(page.getByRole("dialog", { name: "Selection menu" }).getByRole("option").first()).toContainText("Link to Selected person");
}

/** The Selection menu's "Link to…": every Linkable Document, the seeded very long ones among them. */
async function openLinkSearch(page: Page) {
  await openSelectionMenu(page);
  const menu = page.getByRole("dialog", { name: "Selection menu" });
  await menu.getByRole("option", { name: "Link to…" }).click();
  await expect(menu.getByRole("option").first()).toBeVisible();
}

/** "Link to…" with another Person picked: the very long words, the very long title, and "add as alias". */
async function openLinkAlias(page: Page) {
  await openLinkSearch(page);
  const menu = page.getByRole("dialog", { name: "Selection menu" });
  await menu.getByRole("combobox", { name: "Search Documents" }).fill("Linked person");
  await menu.getByRole("option", { name: /Linked person/ }).first().click();
  await expect(menu.getByRole("checkbox")).toBeVisible();
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
  { name: "Bases", path: "/base", afterOpen: workLocally },
  { name: "Base", path: "/base/task" },
  { name: "Screens", path: "/screens" },
  { name: "Screen with every Card", path: "/screen/e2elongcontent1", afterOpen: workLocally },
  { name: "Settings", path: "/settings", afterOpen: workLocally },
  { name: "Handoff · sign in", path: `/handoff#${LONG_HANDOFF}` },
  { name: "Handoff · Quote", path: `/handoff#${LONG_HANDOFF}`, afterOpen: workLocally },
  { name: "Handoff · picker", path: `/handoff#${encodeHandoff({ title: longText("A page"), text: "", url: `https://example.com/${LONG_WORD}` })}`, afterOpen: pickerWithWorkspaces },
  { name: "Handoff · unreadable", path: "/handoff#v1.not-a-handoff", afterOpen: workLocally },
  { name: "Handoff · Saved", path: "/handoff/done", afterOpen: workLocally },
  { name: "Selection menu", path: "/app/journal", afterOpen: openSelectionMenu },
  { name: "Selection menu · Link to…", path: "/app/journal", afterOpen: openLinkSearch },
  { name: "Selection menu · add as alias", path: "/app/journal", afterOpen: openLinkAlias },
  { name: "Handoff · shared", path: LONG_SHARE, afterOpen: workLocally },
  { name: "Handoff · shared, Saved", path: LONG_SHARE, afterOpen: sharedAndSaved },

  // Modules.
  { name: "House", path: "/module/house", afterOpen: workLocally },
  { name: "House · Calendar", path: "/module/house/calendar" },
  { name: "Projects", path: "/module/tasks" },
  { name: "Culture", path: "/module/culture", afterOpen: workLocally },
  { name: "Money", path: "/module/money", afterOpen: workLocally },
  { name: "Progress", path: "/module/progress", afterOpen: workLocally },
  { name: "Knowledge module", path: "/module/languages" },
  { name: "Journal module", path: "/module/journal" },
  { name: "Notes module", path: "/module/notes" },
  { name: "Thoughts module", path: "/module/thoughts" },
  { name: "Research module", path: "/module/research" },
  { name: "Manuscript module", path: "/module/manuscript" },

  // The Vault (Note-taking's layout).
  { name: "Vault", path: "/vault", afterOpen: workLocally },
  // A Peek edits (ADR 0085): a user-defined type's whole Peek, and a built-in's with the user's own Field beneath the App's part.
  { name: "Vault · Peek of a user-defined type", path: "/vault", afterOpen: peekOf("e2eperson") },
  { name: "Vault · Peek with the user's own Field", path: "/vault", afterOpen: peekOf("book", true) },
  // The Apps' own editable Peeks (#182): Ledger, Pocket, Prices, Knowledge, Projects.
  ...["ledger_transaction", "ledger_account", "ledger_category", "pocket_allowance", "price_product", "price_receipt", "price_shop", "language_word", "language_sentence", "knowledge_fact", "project"].map(
    (type): ScreenCase => ({ name: `Vault · Peek of ${type}`, path: "/vault", afterOpen: peekOf(type) }),
  ),
  // The Apps' own editable parts (ADR 0085): a Task's and an Event's Fields edited through their App's controls.
  { name: "Vault · Peek of a Task", path: "/vault", afterOpen: peekOf("task") },
  { name: "Vault · Peek of an Event", path: "/vault", afterOpen: peekOf("event") },
  // House's editable Peeks (ADR 0085): each App's own controls over a long-titled Document.
  { name: "Vault · Peek of chore", path: "/vault/d/:id", type: "chore", afterOpen: peekOf("chore") },
  { name: "Vault · Peek of provision", path: "/vault/d/:id", type: "provision", afterOpen: peekOf("provision") },
  { name: "Vault · Peek of need", path: "/vault/d/:id", type: "need", afterOpen: peekOf("need") },
  // The Progress Apps' editable Peeks (ADR 0085), each drawn by its App.
  { name: "Vault · Peek of a Stat", path: "/vault", afterOpen: peekOf("stat") },
  { name: "Vault · Peek of a Workout session", path: "/vault", afterOpen: peekOf("workout_session") },
  { name: "Vault · Peek of a Habit", path: "/vault", afterOpen: peekOf("habit") },
  { name: "Vault · Peek of a Negative activity", path: "/vault", afterOpen: peekOf("negative") },
  { name: "Vault · Peek of a Mood", path: "/vault", afterOpen: peekOf("mood") },
  { name: "Vault · Peek of a Fine", path: "/vault", afterOpen: peekOf("swearjar_fine") },
  // The Culture Apps' editable Peeks (ADR 0085), each drawn by its own App.
  { name: "Vault · Peek of a book", path: "/vault", afterOpen: peekOf("book") },
  { name: "Vault · Peek of an Author", path: "/vault", afterOpen: peekOf("author") },
  { name: "Vault · Peek of a film", path: "/vault", afterOpen: peekOf("movie") },
  { name: "Vault · Peek of a Cinema playlist", path: "/vault", afterOpen: peekOf("cinema_playlist") },
  { name: "Vault · Peek of an album", path: "/vault", afterOpen: peekOf("music") },
  { name: "Vault · Peek of a Discotheque playlist", path: "/vault", afterOpen: peekOf("discotheque_playlist") },
  { name: "Vault · Peek of a game", path: "/vault", afterOpen: peekOf("game") },
  { name: "Vault · Peek of a painting", path: "/vault", afterOpen: peekOf("painting") },
  { name: "Vault · Peek of a building", path: "/vault", afterOpen: peekOf("architecture") },
  {
    // The file tree's "New thought" focused: a tooltip names it on the desk; a touch phone shows none (ADR 0079).
    name: "Vault · Tooltip",
    path: "/vault",
    afterOpen: async (page) => {
      await workLocally(page);
      const button = page.getByRole("button", { name: "New thought", exact: true });
      const touch = await page.evaluate(() => !matchMedia("(hover: hover) and (pointer: fine)").matches);
      if (!touch) {
        await button.focus();
        await expect(page.getByRole("tooltip")).toHaveText("New thought");
        return;
      }
      if (await button.isVisible()) await button.focus();
      await page.waitForTimeout(600);
      await expect(page.locator("[data-slot=tooltip-content]")).toHaveCount(0);
    },
  },
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
  {
    // The AlertDialog (ADR 0079) before the seeded empty type with a long label is deleted: Cancel has the focus.
    name: "Journal · Types · Delete type confirmation",
    path: "/app/journal/t",
    afterOpen: async (page) => {
      await workLocally(page);
      await page.getByRole("button", { name: /^Edit the type Places/ }).first().click();
      await page.getByRole("dialog").getByRole("button", { name: "Delete type" }).click();
      const confirm = page.getByRole("alertdialog");
      await expect(confirm.getByRole("button", { name: "Delete type" })).toBeVisible();
      await expect(confirm.getByRole("button", { name: "Cancel" })).toBeFocused();
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
  { name: "Tasks", path: "/app/tasks", afterOpen: workLocally },
  {
    // The Archived tab: an EmptyState (nothing is archived in the seed). A select on a phone.
    name: "Tasks · Archived",
    path: "/app/tasks",
    afterOpen: async (page) => {
      await workLocally(page);
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
  { name: "Events", path: "/app/events", afterOpen: workLocally },
  {
    // The Event dialog saved without a title: the Field's error under the title, not a toast.
    name: "Events · Event dialog error",
    path: "/app/events",
    afterOpen: async (page) => {
      await workLocally(page);
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
  { name: "Library", path: "/app/library", afterOpen: openShelf },
  { name: "Author", path: "/app/library/authors/:id", type: "author" },
  {
    // The Add dialog's Author Combobox, its list open over the seeded long-named Author (two letters: no Open Library lookup).
    name: "Library · Add · Author picker",
    path: "/app/library",
    afterOpen: async (page) => {
      await workLocally(page);
      await page.getByRole("button", { name: /^Add with details/ }).click();
      await page.getByRole("combobox", { name: /Author|Creator/ }).fill("wi");
      await expect(page.getByRole("listbox", { name: "Authors" }).getByRole("option").first()).toBeVisible();
    },
  },
  {
    // The QuickAdd's Combobox open over a long typed title and a stubbed Open Library hit.
    name: "Library · Quick add",
    path: "/app/library",
    afterOpen: async (page) => {
      await openQuickAdd(page);
      await expect(page.getByRole("option", { name: /^Looked-up title/ })).toBeVisible();
    },
  },
  { name: "Cinema", path: "/app/cinema", afterOpen: openShelf },
  // No TMDB key in the seed: the list holds the "Add …" row alone.
  { name: "Cinema · Quick add", path: "/app/cinema", afterOpen: openQuickAdd },
  { name: "Discotheque", path: "/app/discotheque", afterOpen: openShelf },
  {
    // A stubbed MusicBrainz hit under the "Add …" row.
    name: "Discotheque · Quick add",
    path: "/app/discotheque",
    afterOpen: async (page) => {
      await openQuickAdd(page);
      await expect(page.getByRole("option", { name: /^Looked-up title/ })).toBeVisible();
    },
  },
  { name: "Arcade", path: "/app/arcade", afterOpen: openShelf },
  // No RAWG key in the seed: the list holds the "Add …" row alone.
  { name: "Arcade · Quick add", path: "/app/arcade", afterOpen: openQuickAdd },
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
