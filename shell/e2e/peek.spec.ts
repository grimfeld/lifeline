import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";
import { pickDate } from "./support/date-picker";

/**
 * A Peek edits (ADR 0085): a user-defined type's Document is edited whole in
 * Core's Peek, and the user's own Fields on a built-in type are edited beneath
 * the App's part of its Peek.
 */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

/** Open the Peek of a Document once the type registry has picked up `type`. */
async function peek(page: Page, id: string, type: string) {
  await expect.poll(() => inCore(page, async (core, t: string) => !!core.documentType(t), type)).toBe(true);
  await inCore(page, async (core, docId: string) => core.openPeek(docId), id);
  // The first dialog: a Date picker's popover open over the Peek is a dialog too.
  return page.getByRole("dialog").first();
}

test("a user-defined type's Document is edited in its Peek, and an alias added there resolves", async ({ page }) => {
  const stamp = Date.now();
  const typeId = `peekperson${stamp}`;
  const title = `Marie ${stamp}`;
  const alias = `Madame ${stamp}`;
  await page.goto("/");
  await workLocally(page);
  const id = await inCore(
    page,
    async (core, a: { typeId: string; title: string }) => {
      await core.saveDocumentType({
        typeId: a.typeId,
        label: "Peek people",
        icon: "user",
        folder: "",
        body: "optional",
        linkable: true,
        locatableField: "home",
        module: "journal",
        order: 0,
        fields: [
          { key: "aliases", label: "Aliases", kind: "list" },
          { key: "home", label: "Home", kind: "geo" },
          { key: "born", label: "Born", kind: "date" },
        ],
      });
      return (await core.putDocument({ type: a.typeId, title: a.title, body: "" })).id as string;
    },
    { typeId, title },
  );

  const dialog = await peek(page, id, typeId);
  await dialog.getByLabel("Aliases").fill(alias);
  // A date the user enters for themselves may be long past: the calendar reaches back to 1500.
  await pickDate(page, dialog.getByLabel("Born"), "1867-11-07");
  await dialog.getByLabel("Tags").fill("scientist");
  await dialog.getByLabel("Tags").press("Enter");

  await expect
    .poll(() => inCore(page, async (core, docId: string) => { const d = (await core.getDocument(docId))!; return { aliases: d.aliases, born: d.born, tags: d.tags }; }, id))
    .toEqual({ aliases: [alias], born: "1867-11-07", tags: ["scientist"] });
  await expect
    .poll(() => inCore(page, async (core, name: string) => core.linkIndexFor(await core.allDocuments(), core.allDocumentTypes()).resolve(name), alias))
    .toEqual({ kind: "doc", id, type: typeId });
});

test("the user's own Field on Book is edited beneath the Library's part of a Book's Peek", async ({ page }) => {
  const stamp = Date.now();
  await page.goto("/");
  await workLocally(page);
  const id = await inCore(
    page,
    async (core, title: string) => {
      await core.saveDocumentType({ typeId: "book", label: "Books", icon: "book", folder: "", order: 0, fields: [{ key: "lentTo", label: "Lent to", kind: "text" }] });
      return (await core.putDocument({ type: "book", title, body: "" })).id as string;
    },
    `A book ${stamp}`,
  );
  await expect.poll(() => inCore(page, async (core) => core.documentType("book")!.fields.some((f) => f.key === "lentTo"), null)).toBe(true);

  const dialog = await peek(page, id, "book");
  await dialog.getByLabel("Lent to").fill("Pierre");
  await expect.poll(() => inCore(page, async (core, docId: string) => (await core.getDocument(docId))!.lentTo, id)).toBe("Pierre");
  // The Library's own Fields stay the Library's: Core draws no second control for them.
  await expect(dialog.getByLabel("Year")).toHaveCount(1);
});
