import { test, expect, type Page } from "@playwright/test";
import { pressMod } from "./support/keys";
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

test("Ctrl+. opens the menu on the selection, typing filters it, and the Intake chosen opens its dialog, writing nothing until it saves", async ({ page }) => {
  const dayId = await openDay(page, "Le chat dort sur le canapé.");
  await selectText(page.locator(".cm-content"), "Le chat dort");
  await page.keyboard.press("Control+.");

  const filter = menu(page).getByRole("combobox", { name: "Filter" });
  await expect(filter).toBeFocused();
  await filter.fill("senten");
  await expect(menu(page).getByRole("option")).toHaveText(["Sentence"]);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "New sentence" })).toBeVisible();
  expect(await bodyOf(page, dayId)).toBe("Le chat dort sur le canapé.");
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

test("Journal → Person makes the Person from the selected name, links it and peeks it; Undo takes both back and closes the Peek, unless the link has moved", async ({ page }) => {
  const dayId = await openDay(page, "Met Ada at the lab.");
  const makeAda = async () => {
    await selectText(page.locator(".cm-content"), "Ada");
    await page.getByRole("button", { name: "Selection menu" }).click();
    await menu(page).getByRole("group", { name: "Journal" }).getByRole("option", { name: "Person", exact: true }).click();
    await expect.poll(() => docsOf(page, "e2esmperson").then((ds) => ds.map((d) => d.title).sort())).toEqual(["Ada", "Marie Curie"]);
    await expect.poll(() => bodyOf(page, dayId)).toBe("Met [[Ada]] at the lab.");
    await expect(page.getByRole("dialog", { name: "Ada" })).toBeVisible();
    await expect(page).toHaveURL((u) => u.pathname === "/app/journal");
  };
  await makeAda();

  // The Peek holds the pointer while it is open; the toast's Undo is pressed however it is reached.
  await page.locator("[data-sonner-toast]").getByRole("button", { name: "Undo" }).dispatchEvent("click");
  await expect.poll(() => docsOf(page, "e2esmperson").then((ds) => ds.map((d) => d.title))).toEqual(["Marie Curie"]);
  await expect.poll(() => bodyOf(page, dayId)).toBe("Met Ada at the lab.");
  // Closed, not left saying "This document is gone".
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Made again, then the text moves under the link: Undo leaves the Person and says why.
  await makeAda();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.locator(".cm-content").click();
  await pressMod(page, "Home");
  await page.keyboard.type("Today. ");
  await expect.poll(() => bodyOf(page, dayId)).toBe("Today. Met [[Ada]] at the lab.");
  // The newest toast's Undo, not the phone editor's own.
  await page.locator("[data-sonner-toast]").filter({ hasText: "Made" }).last().getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText(/Couldn’t undo/)).toBeVisible();
  expect((await docsOf(page, "e2esmperson")).map((d) => d.title).sort()).toEqual(["Ada", "Marie Curie"]);
  expect(await bodyOf(page, dayId)).toBe("Today. Met [[Ada]] at the lab.");
});

test("Link to… links a name to the Document searched for, adding the name as its alias", async ({ page }) => {
  const dayId = await openDay(page, "Met Marie at the lab.", []);
  await selectText(page.locator(".cm-content"), "Marie");
  await page.getByRole("button", { name: "Selection menu" }).click();
  await menu(page).getByRole("option", { name: "Link to…" }).click();

  await menu(page).getByRole("combobox", { name: "Search Documents" }).fill("curie");
  await menu(page).getByRole("option", { name: /Marie Curie/ }).click();

  const alias = menu(page).getByRole("checkbox", { name: "Also add “Marie” as an alias" });
  await expect(alias).not.toBeChecked();
  await alias.check();
  await menu(page).getByRole("button", { name: "Link", exact: true }).click();

  await expect.poll(() => bodyOf(page, dayId)).toBe("Met [[Marie Curie|Marie]] at the lab.");
  await expect.poll(async () => (await docTitled(page, "Marie Curie")).aliases ?? []).toEqual(["Marie"]);

  // The same name, written plainly elsewhere, is now an Unlinked mention of Marie Curie.
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
  // The Day links here now, so the panel is drawn once its Backlinks are.
  await expect(page.getByText("Backlinks · 1")).toBeVisible();
  await expect(page.getByText("Unlinked mentions · 1")).toBeVisible();
});
