import { test, expect, type Page } from "@playwright/test";
import { CORE_URL } from "./support/seed";
import { selectText } from "./support/selection";

/**
 * The Selection menu (CONTEXT.md, ADR 0086): selecting text in a Document's
 * body offers Link — to the Document the text already names — then, by Module,
 * the user-defined types made at once from a short selection (quick make) and
 * every App's Intakes. Opened by its trigger or Ctrl+., filtered by typing.
 */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

const DATE = "2001-02-03";

/** A Person "Marie Curie" (alias "Marie", unless other `aliases` are given) and a Day reading `body`, opened in the Journal. */
async function openDay(page: Page, body: string, aliases: string[] = ["Marie"]): Promise<string> {
  await page.goto("/app/journal");
  await workLocally(page);
  const dayId = await page.evaluate(
    async ({ coreUrl, body, date, aliases }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      await core.saveDocumentType({ typeId: "e2esmperson", label: "Persons", fields: [{ key: "aliases", label: "Aliases", kind: "list" }], icon: "user", folder: "", body: "optional", linkable: true, module: "journal", order: 0 });
      for (let i = 0; i < 40 && !core.documentTypeSync("e2esmperson"); i++) await new Promise((r) => setTimeout(r, 50));
      await core.createDocument({ type: "e2esmperson", title: "Marie Curie", fields: { aliases } });
      return (await core.createDocument({ type: "daily", title: date, body })).id as string;
    },
    { coreUrl: CORE_URL, body, date: DATE, aliases },
  );
  await page.goto(`/app/journal?d=${DATE}`);
  await workLocally(page);
  await expect(page.locator(".cm-content")).toContainText(body);
  return dayId;
}

async function bodyOf(page: Page, id: string): Promise<string> {
  return page.evaluate(
    async ({ coreUrl, id }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      return ((await core.getDocument(id)) as { body?: string } | undefined)?.body ?? "";
    },
    { coreUrl: CORE_URL, id },
  );
}

/** The Document titled `title`, as stored. */
async function docTitled(page: Page, title: string): Promise<{ id: string; aliases?: string[] }> {
  return page.evaluate(
    async ({ coreUrl, title }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      const all = (await core.allDocuments()) as { id: string; title: string; aliases?: string[] }[];
      return all.find((d) => d.title === title)!;
    },
    { coreUrl: CORE_URL, title },
  );
}

const menu = (page: Page) => page.getByRole("dialog", { name: "Selection menu" });

test("a name selected in a Day is linked to the Person it names, and the user stays on the Day", async ({ page }) => {
  const dayId = await openDay(page, "Met Marie at the lab.");
  await selectText(page.locator(".cm-content"), "Marie");
  await page.getByRole("button", { name: "Selection menu" }).click();

  const options = menu(page).getByRole("option");
  await expect(options.first()).toHaveText("Link to Marie Curie (Person)");
  await options.first().click();

  await expect.poll(() => bodyOf(page, dayId)).toBe("Met [[Marie Curie|Marie]] at the lab.");
  await expect(page).toHaveURL((u) => u.pathname === "/app/journal");
  await expect(page.locator(".cm-content")).toContainText("[[Marie Curie|Marie]]");
});

test("text selected in a rendered body is linked too", async ({ page }) => {
  const dayId = await openDay(page, "Pierre wrote to Marie Curie.");
  await page.locator(".cm-content").click();
  await page.keyboard.press("Control+e");
  const rendered = page.locator(".prose-note");
  await expect(rendered).toContainText("Pierre wrote to Marie Curie.");

  await selectText(rendered, "Marie Curie");
  await page.getByRole("button", { name: "Selection menu" }).click();
  await menu(page).getByRole("option", { name: "Link to Marie Curie (Person)" }).click();

  await expect.poll(() => bodyOf(page, dayId)).toBe("Pierre wrote to [[Marie Curie]].");
});

test("an Intake chosen from the menu opens its dialog, and nothing is written until it saves", async ({ page }) => {
  const dayId = await openDay(page, "Call the plumber about the leak.");
  await selectText(page.locator(".cm-content"), "Call the plumber");
  await page.getByRole("button", { name: "Selection menu" }).click();
  await expect(menu(page).getByRole("group", { name: "Projects" })).toBeVisible();
  await menu(page).getByRole("option", { name: "Task", exact: true }).click();

  await expect(page.getByRole("dialog", { name: "New task" })).toBeVisible();
  expect(await bodyOf(page, dayId)).toBe("Call the plumber about the leak.");
});

test("Ctrl+. opens the menu on the selection, and typing filters it", async ({ page }) => {
  await openDay(page, "Le chat dort sur le canapé.");
  await selectText(page.locator(".cm-content"), "Le chat dort");
  await page.keyboard.press("Control+.");

  const filter = menu(page).getByRole("combobox", { name: "Filter" });
  await expect(filter).toBeFocused();
  await filter.fill("senten");
  await expect(menu(page).getByRole("option")).toHaveText(["Sentence"]);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "New sentence" })).toBeVisible();
});

/** Every Document of `type`, as titles with their bodies. */
async function docsOf(page: Page, type: string): Promise<{ id: string; title: string; body: string }[]> {
  return page.evaluate(
    async ({ coreUrl, type }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      return ((await core.documentsOf(type)) as { id: string; title: string; body?: string }[]).map((d) => ({ id: d.id, title: d.title, body: d.body ?? "" }));
    },
    { coreUrl: CORE_URL, type },
  );
}

test("Journal → Person makes the Person from the selected name, links it, peeks it, and Undo takes both back", async ({ page }) => {
  const dayId = await openDay(page, "Met Ada at the lab.");
  await selectText(page.locator(".cm-content"), "Ada");
  await page.getByRole("button", { name: "Selection menu" }).click();
  await menu(page).getByRole("group", { name: "Journal" }).getByRole("option", { name: "Person", exact: true }).click();

  await expect.poll(() => docsOf(page, "e2esmperson").then((ds) => ds.map((d) => d.title).sort())).toEqual(["Ada", "Marie Curie"]);
  await expect.poll(() => bodyOf(page, dayId)).toBe("Met [[Ada]] at the lab.");
  await expect(page.getByRole("dialog", { name: "Ada" })).toBeVisible();
  await expect(page).toHaveURL((u) => u.pathname === "/app/journal");

  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => docsOf(page, "e2esmperson").then((ds) => ds.map((d) => d.title))).toEqual(["Marie Curie"]);
  await expect.poll(() => bodyOf(page, dayId)).toBe("Met Ada at the lab.");
});

test("Undo of a quick make closes the Peek showing what it took back", async ({ page }) => {
  await openDay(page, "Met Ada at the lab.");
  await selectText(page.locator(".cm-content"), "Ada");
  await page.getByRole("button", { name: "Selection menu" }).click();
  await menu(page).getByRole("group", { name: "Journal" }).getByRole("option", { name: "Person", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Ada" })).toBeVisible();

  // The Peek holds the pointer while it is open; the toast's Undo is pressed however it is reached.
  await page.getByRole("button", { name: "Undo" }).dispatchEvent("click");
  await expect.poll(() => docsOf(page, "e2esmperson").then((ds) => ds.map((d) => d.title))).toEqual(["Marie Curie"]);
  // Closed, not left saying "This document is gone".
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("Undo of a quick make leaves the Document when its link can no longer be taken back, and says why", async ({ page }) => {
  const dayId = await openDay(page, "Met Ada at the lab.");
  await selectText(page.locator(".cm-content"), "Ada");
  await page.getByRole("button", { name: "Selection menu" }).click();
  await menu(page).getByRole("group", { name: "Journal" }).getByRole("option", { name: "Person", exact: true }).click();
  await expect.poll(() => bodyOf(page, dayId)).toBe("Met [[Ada]] at the lab.");
  await page.keyboard.press("Escape");

  // The text moves under the link: it is no longer where it was written.
  await page.locator(".cm-content").click();
  await page.keyboard.press("Control+Home");
  await page.keyboard.type("Today. ");
  await expect.poll(() => bodyOf(page, dayId)).toBe("Today. Met [[Ada]] at the lab.");

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText(/Couldn’t undo/)).toBeVisible();
  expect((await docsOf(page, "e2esmperson")).map((d) => d.title).sort()).toEqual(["Ada", "Marie Curie"]);
  expect(await bodyOf(page, dayId)).toBe("Today. Met [[Ada]] at the lab.");
});

test("a type homed nowhere is made under Other from its only Template, and a non-Linkable one leaves the text alone", async ({ page }) => {
  const dayId = await openDay(page, "Cooked shakshuka tonight.");
  await page.evaluate(async (coreUrl) => {
    const core = await import(/* @vite-ignore */ coreUrl);
    await core.saveDocumentType({ typeId: "e2esmrecipe", label: "Recipes", fields: [], icon: "book", folder: "", body: "optional", linkable: false, module: "", order: 0 });
    for (let i = 0; i < 40 && !core.documentTypeSync("e2esmrecipe"); i++) await new Promise((r) => setTimeout(r, 50));
    await core.putDocument({ type: "template", title: "Recipe card", forType: "e2esmrecipe", folder: "Templates", body: "## Ingredients" });
  }, CORE_URL);

  await selectText(page.locator(".cm-content"), "shakshuka");
  await page.getByRole("button", { name: "Selection menu" }).click();
  await menu(page).getByRole("group", { name: "Other" }).getByRole("option", { name: "Recipe", exact: true }).click();

  await expect.poll(() => docsOf(page, "e2esmrecipe").then((ds) => ds.map((d) => [d.title, d.body]))).toEqual([["shakshuka", "## Ingredients"]]);
  await expect(page.getByRole("dialog", { name: "shakshuka" })).toBeVisible();
  expect(await bodyOf(page, dayId)).toBe("Cooked shakshuka tonight.");
});

test("a user-defined type is not offered for a long selection", async ({ page }) => {
  const long = "We spent the whole afternoon walking along the river talking about everything and nothing.";
  await openDay(page, long);
  await selectText(page.locator(".cm-content"), long);
  await page.getByRole("button", { name: "Selection menu" }).click();
  await expect(menu(page).getByRole("group", { name: "Projects" })).toBeVisible();
  await expect(menu(page).getByRole("option", { name: "Person", exact: true })).toHaveCount(0);
});

for (const addAlias of [false, true]) {
  test(`Link to… links a name to the Document searched for${addAlias ? ", adding the name as its alias" : ", the alias left off"}`, async ({ page }) => {
    const dayId = await openDay(page, "Met Marie at the lab.", []);
    await selectText(page.locator(".cm-content"), "Marie");
    await page.getByRole("button", { name: "Selection menu" }).click();
    await menu(page).getByRole("option", { name: "Link to…" }).click();

    await menu(page).getByRole("combobox", { name: "Search Documents" }).fill("curie");
    await menu(page).getByRole("option", { name: /Marie Curie/ }).click();

    const alias = menu(page).getByRole("checkbox", { name: "Also add “Marie” as an alias" });
    await expect(alias).not.toBeChecked();
    if (addAlias) await alias.check();
    await menu(page).getByRole("button", { name: "Link", exact: true }).click();

    await expect.poll(() => bodyOf(page, dayId)).toBe("Met [[Marie Curie|Marie]] at the lab.");
    await expect.poll(async () => (await docTitled(page, "Marie Curie")).aliases ?? []).toEqual(addAlias ? ["Marie"] : []);

    // The same name, written plainly elsewhere, is now an Unlinked mention of Marie Curie — or, without the alias, nothing.
    const marie = await docTitled(page, "Marie Curie");
    await page.evaluate(
      async ({ coreUrl }) => {
        const core = await import(/* @vite-ignore */ coreUrl);
        await core.createDocument({ type: "daily", title: "2001-02-04", body: "Marie wrote back." });
      },
      { coreUrl: CORE_URL },
    );
    await page.goto(`/vault/d/${marie.id}`);
    await workLocally(page);
    await expect(page.getByRole("textbox", { name: "Title" })).toHaveValue("Marie Curie");
    // On a phone the links panel is folded away until asked for.
    if (page.viewportSize()!.width < 768) await page.getByRole("button", { name: "Toggle links panel" }).click();
    // The Day links here now, so the panel is drawn once its Backlinks are.
    await expect(page.getByText("Backlinks · 1")).toBeVisible();
    if (addAlias) await expect(page.getByText("Unlinked mentions · 1")).toBeVisible();
    else await expect(page.getByText(/^Unlinked mentions · /)).toHaveCount(0);
  });
}

test("Link to… links at once when the words are the target's name in other letters", async ({ page }) => {
  const dayId = await openDay(page, "Met marie curie at the lab.", []);
  await selectText(page.locator(".cm-content"), "marie curie");
  await page.getByRole("button", { name: "Selection menu" }).click();
  await menu(page).getByRole("option", { name: "Link to…" }).click();
  await menu(page).getByRole("combobox", { name: "Search Documents" }).fill("Marie");
  await page.keyboard.press("Enter");
  await expect.poll(() => bodyOf(page, dayId)).toBe("Met [[Marie Curie|marie curie]] at the lab.");
});
