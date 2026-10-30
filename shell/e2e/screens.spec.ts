import { test, expect, type Page } from "@playwright/test";
import { encodeHandoff } from "@lifeline/handoff";
import { CORE_URL, LONG_WORD, longText } from "./support/seed";
import { expectNoBrokenLayout, layoutProblems } from "./support/layout";
import { selectText } from "./support/selection";
import { datePickerLabelled, dayFromToday, openCalendar, showPhoneFilters } from "./support/date-picker";

/**
 * Every screen of the app, at phone and desktop width (the `mobile` and
 * `desktop` projects), over a store filled with very long content: nothing
 * may spill out of its box, be cut off without an ellipsis, or make a box
 * scroll sideways that is not meant to.
 *
 * The rule (CODING_STANDARDS.md § Long content): a new screen gets a row here. The last test fails
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

/** A Prices Product page → Edit: the Product dialog, its Measure controls included. */
async function openProductEdit(page: Page) {
  await workLocally(page);
  await page.getByRole("button", { name: "Edit" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

/**
 * A Prices Product page → Edit → Merge into a Product of another dimension
 * (ADR 0084): the picker lists it with its Measure, and the dialog says how
 * many of the Product's Lines will need an amount.
 */
async function openProductMerge(page: Page) {
  await workLocally(page);
  const target = longText("Merge target");
  await page.evaluate(
    async ([coreUrl, title]) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      const id = location.pathname.split("/").pop();
      const own = (await core.documentsOf("price_product")).find((p: { id: string }) => p.id === id);
      for (const l of await core.documentsOf("price_line")) await core.patchDocument(l.id, { productId: id, needsAmount: false });
      const dimension = own?.dimension === "length" ? "mass" : "length";
      await core.putDocument({ type: "price_product", title, dimension, unit: dimension === "length" ? "m" : "kg", countName: "", labels: [], folder: "", tags: [] });
    },
    [CORE_URL, target] as const,
  );
  await page.getByRole("button", { name: "Edit" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox", { name: "Merge into" }).click();
  await page.getByRole("option", { name: new RegExp(`^${target.slice(0, 20)}`) }).click();
  await expect(dialog.getByRole("status")).toContainText("will need an amount");
}

/**
 * A Prices Product page with two Measures (ADR 0084): the page's Product made
 * a count also weighed, compared by weight, and every Line given a second
 * amount — so both unit prices show, the compared-by one leading.
 */
async function withTwoMeasures(page: Page) {
  await workLocally(page);
  await page.evaluate(async (coreUrl) => {
    const core = await import(/* @vite-ignore */ coreUrl);
    const id = location.pathname.split("/").pop();
    await core.patchDocument(id, { dimension: "count", unit: "pc", countName: "", secondaryDimension: "mass", secondaryUnit: "g", compareBy: "secondary" });
    for (const l of await core.documentsOf("price_line")) await core.patchDocument(l.id, { productId: id, needsAmount: false, secondAmount: 0.24 });
  }, CORE_URL);
  await expect(page.getByText("also mass")).toBeVisible();
}

/** withTwoMeasures, then Edit: the secondary Measure and compare-by controls. */
async function openTwoMeasuresEdit(page: Page) {
  await withTwoMeasures(page);
  await page.getByRole("button", { name: "Edit" }).first().click();
  await expect(page.getByRole("dialog").getByRole("combobox", { name: "Compare by" })).toBeVisible();
}

/**
 * Prices with the needs-amount inbox (ADR 0084): every seeded Line marked as
 * needing an amount — its Product changed dimension — so the loud banner
 * shows, then the inbox opened over it.
 */
async function openNeedsAmount(page: Page) {
  await workLocally(page);
  await page.evaluate(async (coreUrl) => {
    const core = await import(/* @vite-ignore */ coreUrl);
    for (const l of await core.documentsOf("price_line")) await core.patchDocument(l.id, { needsAmount: true });
  }, CORE_URL);
  await page.getByRole("button", { name: /need.? an amount/ }).click();
  await expect(page.getByRole("dialog", { name: "Lines that need an amount" })).toBeVisible();
}

/**
 * Knowledge → Puzzles over a Topic with one Word a Wordle-like can draw (ADR
 * 0106): a short term met reversed, with the longest meaning, notes, origin
 * and Sentence translation a person could type.
 */
async function withPuzzleWord(page: Page) {
  await workLocally(page);
  await page.evaluate(
    async ([coreUrl, long, word]) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      const topic = await core.putDocument({ type: "language", title: long, name: long, newCap: 10, archived: false, tallies: [], tags: [] });
      const at = new Date(Date.now() - 3 * 86_400_000).toISOString();
      const w = await core.putDocument({ type: "language_word", languageId: topic.id, term: "palabra", meaning: `${long} ${word}`, notes: `${long} ${word}`, origin: `${long} ${word}`, originId: "", paused: false, addedAt: at, tags: [] });
      await core.putDocument({ type: "language_sentence", languageId: topic.id, text: "Una {{palabra}} más", translation: `${long} ${word}`, origin: "", originId: "", paused: false, addedAt: at, tags: [] });
      await core.putDocument({ type: "language_recall", title: "", languageId: topic.id, itemId: w.id, slot: "reverse", grade: "pass", at, tags: [] });
    },
    [CORE_URL, longText("Puzzle topic"), LONG_WORD] as const,
  );
  await expect(page.getByRole("button", { name: "Play" }).first()).toBeVisible();
}

/** …and today's Wordle-like opened, one guess in. */
async function playPuzzle(page: Page) {
  await withPuzzleWord(page);
  await page.getByRole("button", { name: "Play" }).last().click();
  const guess = page.getByLabel("Guess 1 of 6");
  await guess.fill("palomas");
  await guess.press("Enter");
  await expect(page.getByLabel("Guess 2 of 6")).toBeVisible();
}

/** …and given up: the end, the Word in full. */
async function givenUpPuzzle(page: Page) {
  await playPuzzle(page);
  await page.getByRole("button", { name: "Give up" }).click();
  await expect(page.getByRole("button", { name: "Practise now" })).toBeVisible();
}

/**
 * Knowledge → Puzzles over a Topic with four Decks a Connections can draw
 * from (ADR 0106): the longest Deck names, and Words and Facts with the
 * longest terms, answers, meanings, questions, notes and origins.
 */
async function withConnections(page: Page) {
  await workLocally(page);
  await page.evaluate(
    async ([coreUrl, long, word]) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      const topic = await core.putDocument({ type: "language", title: long, name: long, newCap: 10, archived: false, tallies: [], tags: [] });
      const at = new Date(Date.now() - 3 * 86_400_000).toISOString();
      for (let d = 0; d < 4; d++) {
        const members: string[] = [];
        for (let i = 0; i < 4; i++) {
          const item =
            i % 2
              ? await core.putDocument({ type: "knowledge_fact", title: `${long} ${d}${i}`, languageId: topic.id, question: `${long} ${d}${i}`, answer: `${word}${d}${i} ${long}`, notes: `${long} ${word}`, origin: `${long} ${word}`, originId: "", paused: false, addedAt: at, tags: [] })
              : await core.putDocument({ type: "language_word", languageId: topic.id, term: `${word}${d}${i}`, meaning: `${long} ${word}`, notes: `${long} ${word}`, origin: `${long} ${word}`, originId: "", paused: false, addedAt: at, tags: [] });
          await core.putDocument({ type: "language_recall", title: "", languageId: topic.id, itemId: item.id, slot: "forward", grade: "pass", at, tags: [] });
          members.push(item.id);
        }
        await core.putDocument({ type: "language_deck", title: `${long} ${d}`, name: `${long} ${d}`, languageId: topic.id, members, tags: [] });
      }
    },
    [CORE_URL, longText("Connections topic"), LONG_WORD] as const,
  );
  await expect(page.getByRole("button", { name: "Play" }).first()).toBeVisible();
}

/** …and today's Connections opened, four tiles picked and submitted. */
async function playConnections(page: Page) {
  await withConnections(page);
  await page.locator("div").filter({ hasText: "Connections · not started" }).getByRole("button", { name: "Play" }).last().click();
  const tiles = page.getByRole("group", { name: "Items left" }).getByRole("button");
  for (let i = 0; i < 4; i++) await tiles.nth(i).click();
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText(/mistakes left/)).toBeVisible();
}

/** …and given up: the end, every group under its Deck, each item in full. */
async function givenUpConnections(page: Page) {
  await playConnections(page);
  await page.getByRole("button", { name: "Give up" }).click();
  await expect(page.getByRole("button", { name: "Practise now" })).toBeVisible();
}

/**
 * Knowledge → Puzzles over a Topic whose kept material makes a crossword
 * (ADR 0106): four Words, a Fact and a Sentence blank, all met, with the
 * longest meaning, question and translation a person could type.
 */
async function withCrossword(page: Page) {
  await workLocally(page);
  await page.evaluate(
    async ([coreUrl, long, word]) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      const topic = await core.putDocument({ type: "language", title: long, name: long, newCap: 10, archived: false, tallies: [], tags: [] });
      const at = new Date(Date.now() - 3 * 86_400_000).toISOString();
      const met = (itemId: string, slot: string) => core.putDocument({ type: "language_recall", title: "", languageId: topic.id, itemId, slot, grade: "pass", at, tags: [] });
      for (const term of ["casa", "mapa", "sala", "pasa"]) {
        const w = await core.putDocument({ type: "language_word", languageId: topic.id, term, meaning: `${long} ${word}`, notes: `${long} ${word}`, origin: `${long} ${word}`, originId: "", paused: false, addedAt: at, tags: [] });
        await met(w.id, "reverse");
      }
      const f = await core.putDocument({ type: "knowledge_fact", languageId: topic.id, question: `${long} ${word}?`, answer: "lata", notes: `${long} ${word}`, origin: "", originId: "", paused: false, addedAt: at, tags: [] });
      await met(f.id, "forward");
      const s = await core.putDocument({ type: "language_sentence", languageId: topic.id, text: `${long} {{nata}} ${word}`, translation: `${long} ${word}`, origin: "", originId: "", paused: false, addedAt: at, tags: [] });
      await met(s.id, "blank:nata");
    },
    [CORE_URL, longText("Crossword topic"), LONG_WORD] as const,
  );
  await expect(page.getByText(/Crossword · not started/).first()).toBeVisible();
}

/** …and today's crossword opened, a letter in. */
async function playCrossword(page: Page) {
  await withCrossword(page);
  await page.locator("div").filter({ hasText: "Crossword · not started" }).getByRole("button", { name: "Play" }).last().click();
  await expect(page.getByRole("grid", { name: "Crossword" })).toBeVisible();
  await page.getByRole("group", { name: "Letters" }).getByRole("button", { name: "a", exact: true }).click();
}

/** …and given up: the end, every answer's material in full. */
async function givenUpCrossword(page: Page) {
  await playCrossword(page);
  await page.getByRole("button", { name: "Give up" }).click();
  await expect(page.getByRole("button", { name: "Practise now" })).toBeVisible();
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

/**
 * Settings → Macros over a long-named Macro whose steps carry long fixed
 * values, an asked argument, a step skipped if refused, and a step whose Command is gone — with its editor open when `edit`.
 */
function macrosWithLongContent(edit?: boolean) {
  return async (page: Page) => {
    await workLocally(page);
    const name = longText("A Macro");
    await page.evaluate(
      async ({ coreUrl, name, title }) => {
        const core = await import(/* @vite-ignore */ coreUrl);
        if ((await core.allMacros()).some((m: { name: string }) => m.name === name)) return;
        await core.saveMacro({
          name,
          steps: [
            { command: "tasks/tasks.add", args: { title: { from: "fixed", value: title }, notes: { from: "asked" } } },
            { command: "shopping/shopping.add", args: { title: { from: "fixed", value: title } }, skipIfRefused: true },
            { command: `gone/${name.replace(/ /g, "")}`, args: {} },
          ],
        });
      },
      { coreUrl: CORE_URL, name, title: longText("A task") },
    );
    const row = page.getByRole("list", { name: "Macros" }).getByRole("button", { name }).first();
    await row.waitFor();
    if (edit) {
      await row.click();
      await page.getByRole("dialog").waitFor();
    }
  };
}

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
 * `write` turns its body's writing on, as ✎ does.
 */
function peekOf(type: string, userField?: boolean, write?: boolean) {
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
    if (write) {
      await page.getByRole("dialog").getByRole("button", { name: "Write", exact: true }).click();
      await page.getByRole("dialog").locator(".cm-content").waitFor();
    }
  };
}

/**
 * A Provision's Peek with its "Expires" Date picker open (ADR 0087): the
 * calendar sits inside the viewport and nothing scrolls sideways, at phone
 * width too; the layout check then covers the popover itself.
 */
async function datePickerOpen(page: Page) {
  await peekOf("provision")(page);
  await page.getByRole("dialog").getByLabel("Expires (check by)").click();
  await calendarFits(page);
}

/** A type's reports over two dates (From set), with To's calendar open over the page. */
async function reportToOpen(page: Page) {
  await workLocally(page);
  await showPhoneFilters(page, "Dates", datePickerLabelled(page, "To"));
  await datePickerLabelled(page, "To").click();
  await calendarFits(page);
}

/** The open Date picker's calendar sits inside the viewport and scrolls nothing sideways. */
async function calendarFits(page: Page) {
  const calendar = openCalendar(page);
  await expect(calendar).toBeVisible();
  const fit = await calendar.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, width: innerWidth, scroll: document.documentElement.scrollWidth };
  });
  expect(fit.left).toBeGreaterThanOrEqual(0);
  expect(fit.right).toBeLessThanOrEqual(fit.width);
  expect(fit.scroll).toBeLessThanOrEqual(fit.width);
}

/**
 * The Time blocker dialog with its Start Time field's list open: the quarter
 * hours sit inside the viewport and nothing scrolls sideways, at phone width
 * too; the layout check then covers the list itself.
 */
async function timeListOpen(page: Page) {
  await workLocally(page);
  await page.getByRole("button", { name: "New blocker" }).click();
  await page.getByRole("dialog").getByRole("combobox", { name: "Start" }).click();
  const list = page.getByRole("listbox", { name: "Times" });
  await expect(list.getByRole("option", { selected: true })).toBeInViewport();
  const fit = await list.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, bottom: r.bottom, width: innerWidth, height: innerHeight, scroll: document.documentElement.scrollWidth };
  });
  expect(fit.left).toBeGreaterThanOrEqual(0);
  expect(fit.right).toBeLessThanOrEqual(fit.width);
  expect(fit.bottom).toBeLessThanOrEqual(fit.height);
  expect(fit.scroll).toBeLessThanOrEqual(fit.width);
}

/**
 * The Schedule's quick add (#225) over an empty hour, a very long title typed:
 * Start, End, the length and More… keep their places, in the bottom sheet on
 * a phone and the popover on the desk.
 */
const QUICK_ADD_DAY = "2031-01-06";
async function quickAddOpen(page: Page) {
  await workLocally(page);
  // A day far ahead, clear of the seeded Events, so the tap lands on an empty hour.
  const column = page.locator(`[data-col="${QUICK_ADD_DAY}"]`);
  await expect(column).toBeVisible();
  const position = { x: 20, y: 2 * 56 + 10 };
  if ((page.viewportSize()?.width ?? 1280) < 768) await column.tap({ position });
  else await column.dblclick({ position });
  const quick = page.getByRole("dialog", { name: /^Add on / });
  await quick.getByRole("textbox", { name: "Title" }).fill(longText("A new event"));
  await expect(quick.getByRole("button", { name: "More…" })).toBeVisible();
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

/** Settings → Keys with a live binding on the longest chord and a dead one whose Command id is one unbroken word. */
async function seedKeyBindings(page: Page) {
  await workLocally(page);
  await page.evaluate(
    async ({ coreUrl, dead }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      const c = core.allCommands().find((x: { dialog?: unknown }) => x.dialog);
      await core.saveKeyBinding({ key: "Mod+Alt+Shift+ArrowRight", command: `${c.appId}/${c.id}` });
      await core.put("key_bindings", { id: "e2edeadbinding1", key: "Mod+Alt+Shift+Backspace", command: dead });
    },
    { coreUrl: CORE_URL, dead: `${LONG_WORD}/${LONG_WORD}` },
  );
  await expect(page.getByText("Dead")).toBeVisible();
}

/** The bind dialog over a key already taken: its error names the Command that holds it. */
async function bindTakenKey(page: Page) {
  await seedKeyBindings(page);
  await page.getByRole("button", { name: "Bind a key" }).click();
  const dialog = page.getByRole("dialog", { name: "Bind a key" });
  await dialog.getByRole("button", { name: "Key", exact: true }).press("Control+Alt+Shift+ArrowRight");
  await expect(dialog.getByText(/is taken by/)).toBeVisible();
}

/** An unwritten date's page once written Days lie on both sides: "Start writing" and the links to them (#208). */
async function seedWrittenNeighbours(page: Page) {
  await workLocally(page);
  await page.evaluate(async (coreUrl) => {
    const core = await import(/* @vite-ignore */ coreUrl);
    await core.createDocument({ type: "daily", title: "2001-02-04", body: "Marie wrote back." });
    await core.createDocument({ type: "daily", title: "2001-03-13", body: "Rain." });
  }, CORE_URL);
  await expect(page.getByRole("link", { name: /^Next written Day/ })).toBeVisible();
}

/** The Journal sidebar's calendar zoomed out `levels` times (1: a year's months, 2: the years list) — desk only, the sidebar is hidden below `lg`. */
const zoomCalendar = (levels: number) => async (page: Page) => {
  await workLocally(page);
  if ((page.viewportSize()?.width ?? 0) < 1024) return;
  const calendar = page.getByRole("complementary", { name: "Journal" }).getByRole("group", { name: "Calendar" });
  await calendar.getByRole("button", { name: "February 2001" }).click();
  if (levels > 1) await calendar.getByRole("button", { name: "2001", exact: true }).first().click();
  await expect(calendar.getByRole("button", { name: levels > 1 ? /^Earlier years$/ : /^2001-02(, written)?$/ })).toBeVisible();
};

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
  { name: "Calendar · Day · quick add", path: `/calendar?view=day&d=${QUICK_ADD_DAY}`, afterOpen: quickAddOpen },
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
  { name: "Settings · Macros", path: "/settings/macros", afterOpen: macrosWithLongContent() },
  { name: "Settings · Macros · editor", path: "/settings/macros", afterOpen: macrosWithLongContent(true) },
  { name: "Settings · Keys", path: "/settings/keys", afterOpen: seedKeyBindings },
  { name: "Settings · Keys · bind a key", path: "/settings/keys", afterOpen: bindTakenKey },
  { name: "Guide", path: "/guide" },
  { name: "Guide · Claude connector", path: "/guide/connector" },
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
  // …and writes its body with the Vault's editor, the panel widened (ADR 0085).
  { name: "Vault · Peek writing its body", path: "/vault", afterOpen: peekOf("note", false, true) },
  { name: "Vault · Peek of a user-defined type, writing", path: "/vault", afterOpen: peekOf("e2eperson", false, true) },
  // The Apps' own editable Peeks (#182): Ledger, Pocket, Prices, Knowledge, Projects.
  ...["ledger_transaction", "ledger_account", "ledger_category", "pocket_allowance", "price_product", "price_receipt", "price_shop", "language_word", "language_sentence", "knowledge_fact", "project"].map(
    (type): ScreenCase => ({ name: `Vault · Peek of ${type}`, path: "/vault", afterOpen: peekOf(type) }),
  ),
  // The Apps' own editable parts (ADR 0085): a Task's and an Event's Fields edited through their App's controls.
  { name: "Vault · Peek of a Task", path: "/vault", afterOpen: peekOf("task") },
  { name: "Vault · Peek of an Event", path: "/vault", afterOpen: peekOf("event") },
  { name: "Vault · Peek of a Project, writing beneath its App's part", path: "/vault", afterOpen: peekOf("project", false, true) },
  // House's editable Peeks (ADR 0085): each App's own controls over a long-titled Document.
  { name: "Vault · Peek of chore", path: "/vault/d/:id", type: "chore", afterOpen: peekOf("chore") },
  { name: "Vault · Peek of provision", path: "/vault/d/:id", type: "provision", afterOpen: peekOf("provision") },
  { name: "Vault · Peek of provision · date picker open", path: "/vault/d/:id", type: "provision", afterOpen: datePickerOpen },
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
  // The writing Apps' own editable parts (ADR 0085).
  { name: "Vault · Peek of a Day", path: "/vault", afterOpen: peekOf("daily") },
  { name: "Vault · Peek of a Week", path: "/vault", afterOpen: peekOf("week") },
  { name: "Vault · Peek of a Source", path: "/vault", afterOpen: peekOf("source") },
  { name: "Vault · Peek of a Note", path: "/vault", afterOpen: peekOf("note") },
  { name: "Vault · Peek of a Quote", path: "/vault", afterOpen: peekOf("quote") },
  { name: "Vault · Peek of an Essay", path: "/vault", afterOpen: peekOf("essay") },
  { name: "Vault · Peek of a Manuscript", path: "/vault", afterOpen: peekOf("manuscript") },
  { name: "Vault · Peek of a Chapter", path: "/vault", afterOpen: peekOf("chapter") },
  { name: "Vault · Peek of a Thought", path: "/vault", afterOpen: peekOf("thought") },
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
  // A date with no Day and a period with no review keep the sidebar (#206).
  { name: "Journal · Day not written", path: "/app/journal?d=2001-02-14" },
  { name: "Journal · Day not written, between written Days", path: "/app/journal?d=2001-02-14", afterOpen: seedWrittenNeighbours },
  { name: "Journal · Month without a review", path: "/app/journal/p/:key", params: { key: "2001-02" } },
  { name: "Journal · Calendar months of a year", path: "/app/journal?d=2001-02-14", afterOpen: zoomCalendar(1) },
  { name: "Journal · Calendar years", path: "/app/journal?d=2001-02-14", afterOpen: zoomCalendar(2) },
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
  { name: "Journal · One type · two dates, To open", path: `/app/journal/t/:type?w=custom&from=${dayFromToday(-10)}`, params: { type: "e2eperson" }, afterOpen: reportToOpen },
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
  {
    // The Move dialog: the calendar in place under a very long title.
    name: "Tasks · Move dialog",
    path: "/app/tasks",
    afterOpen: async (page) => {
      await workLocally(page);
      await page.getByRole("button", { name: "More" }).first().click();
      await page.getByRole("menuitem", { name: "Move to day…" }).click();
      await expect(page.getByRole("dialog").locator('[data-slot="calendar"]')).toBeVisible();
    },
  },
  { name: "Projects · Timeline", path: "/app/projects/timeline" },
  { name: "Project", path: "/app/projects/p/:id", type: "project" },
  { name: "Events", path: "/app/events", afterOpen: workLocally },
  { name: "Events · Time blocker · time list open", path: "/app/events?tab=blockers", afterOpen: timeListOpen },
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
  {
    // The Event template dialog: the kit Length picker, holding a custom length of days.
    name: "Events · Event template dialog",
    path: "/app/events?tab=templates",
    afterOpen: async (page) => {
      await workLocally(page);
      await page.getByRole("button", { name: "New event template" }).click();
      const length = page.getByRole("dialog").getByRole("group", { name: "Length" });
      await length.getByRole("textbox").fill("12d 23h 45m");
      await length.getByRole("textbox").press("Enter");
      await expect(length.getByRole("textbox")).toHaveValue("12d 23h 45m");
      await expect(length.getByRole("button", { name: "1h", exact: true })).toHaveAttribute("aria-pressed", "false");
    },
  },
  { name: "Stats", path: "/app/stats" },
  { name: "Stat", path: "/app/stats/:id", type: "stat" },
  { name: "Life Level", path: "/app/lifelevel" },
  { name: "Habit", path: "/app/lifelevel/:id", type: "habit" },
  { name: "Library", path: "/app/library", afterOpen: openShelf },
  { name: "Author", path: "/app/library/authors/:id", type: "author" },
  { name: "Library · Work", path: "/app/library/works/:id", type: "book" },
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
  { name: "Prices · needs amount", path: "/app/prices", afterOpen: openNeedsAmount },
  { name: "Prices · overview", path: "/app/prices?tab=overview" },
  { name: "Price product · edit", path: "/app/prices/p/:id", type: "price_product", afterOpen: openProductEdit },
  { name: "Price product · merge", path: "/app/prices/p/:id", type: "price_product", afterOpen: openProductMerge },
  { name: "Price product · two measures", path: "/app/prices/p/:id", type: "price_product", afterOpen: withTwoMeasures },
  { name: "Price product · two measures edit", path: "/app/prices/p/:id", type: "price_product", afterOpen: openTwoMeasuresEdit },
  { name: "Mood", path: "/app/mood" },
  { name: "Swear Jar", path: "/app/swearjar" },
  { name: "Knowledge", path: "/app/languages" },
  { name: "Knowledge · Puzzles", path: "/app/languages?tab=puzzles", afterOpen: withPuzzleWord },
  { name: "Knowledge · Puzzle player", path: "/app/languages?tab=puzzles", afterOpen: playPuzzle },
  { name: "Knowledge · Puzzle played", path: "/app/languages?tab=puzzles", afterOpen: givenUpPuzzle },
  { name: "Knowledge · Connections", path: "/app/languages?tab=puzzles", afterOpen: withConnections },
  { name: "Knowledge · Connections player", path: "/app/languages?tab=puzzles", afterOpen: playConnections },
  { name: "Knowledge · Crossword", path: "/app/languages?tab=puzzles", afterOpen: playCrossword },
  { name: "Knowledge · Crossword played", path: "/app/languages?tab=puzzles", afterOpen: givenUpCrossword },
  { name: "Knowledge · Connections played", path: "/app/languages?tab=puzzles", afterOpen: givenUpConnections },
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
    // A path the dev server serves, not one on disk: typed as a plain string, it is not resolved.
    const shellsUrl: string = "/src/modules/shells.ts";
    const { MODULE_SHELLS } = await import(/* @vite-ignore */ shellsUrl);
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
