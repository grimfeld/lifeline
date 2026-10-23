import { test, expect, type Page } from "@playwright/test";
import { CORE_URL } from "./support/seed";

/**
 * A Base by keyboard as well as by pointer (#293), and a long one opening a
 * page at a time (#278). Each case makes a type of its own, so the seed's
 * Documents never get in the way.
 */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

/** Runs in the page against the app's own Core module. */
async function inCore<A, R>(page: Page, fn: (core: any, arg: A) => Promise<R>, arg: A): Promise<R> {
  return page.evaluate(
    async ({ coreUrl, src, arg }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      return new Function("core", "arg", `return (${src})(core, arg);`)(core, arg);
    },
    { coreUrl: CORE_URL, src: fn.toString(), arg },
  );
}

/** A type with a Status choice and a Note, holding `count` Documents ("Row 1"…), all "To do". */
async function makeBase(page: Page, count: number): Promise<string> {
  await page.goto("/base");
  await workLocally(page);
  const typeId = `e2ebase${Date.now()}`;
  await inCore(
    page,
    async (core, { typeId, count }: { typeId: string; count: number }) => {
      await core.saveDocumentType({
        typeId,
        label: "Shelves",
        icon: "box",
        folder: "",
        order: 999,
        fields: [
          { key: "status", label: "Status", kind: "select", options: [{ value: "todo", label: "To do" }, { value: "done", label: "Done" }] },
          { key: "note", label: "Note", kind: "text" },
        ],
      });
      // The type registry picks the record up from its live query: wait for it before writing rows of it.
      for (let i = 0; i < 100 && !core.documentType(typeId); i++) await new Promise((r) => setTimeout(r, 50));
      await Promise.all(Array.from({ length: count }, (_, i) => core.putDocument({ type: typeId, title: `Row ${i + 1}`, status: "todo", note: "" })));
    },
    { typeId, count },
  );
  return typeId;
}

const stored = (page: Page, typeId: string, title: string) =>
  inCore(page, async (core, { typeId, title }: { typeId: string; title: string }) => {
    const d = (await core.documentsOf(typeId)).find((x: { title: string }) => x.title === title);
    return d ? { status: d.status, note: d.note } : null;
  }, { typeId, title });

test("a table cell edits from the keyboard: Enter opens it, Escape puts the focus back on it", async ({ page, isMobile }) => {
  test.skip(isMobile, "a keyboard case: the desk");
  const typeId = await makeBase(page, 1);
  await page.goto(`/base/${typeId}`);
  await workLocally(page);

  const cell = page.getByRole("button", { name: /edit Note$/ });
  await cell.focus();
  await page.keyboard.press("Enter");
  const input = page.getByRole("row", { name: /Row 1/ }).getByRole("textbox");
  await expect(input, "the editor opens focused").toBeFocused();
  await page.keyboard.type("Second shelf");
  await page.keyboard.press("Escape");
  await expect(input).toBeHidden();
  await expect(page.getByRole("button", { name: /edit Note$/ }), "back on the cell").toBeFocused();
  await expect.poll(() => stored(page, typeId, "Row 1")).toEqual({ status: "todo", note: "Second shelf" });
});

test("a Board card moves to another column from its Move menu, without a drag", async ({ page }) => {
  const typeId = await makeBase(page, 1);
  const viewId = await inCore(
    page,
    async (core, typeId: string) => (await core.saveView({ type: typeId, name: "Board", filters: [], search: "", sortBy: "title", sortDir: "asc", columns: ["title"], layout: "board", sort: 0 })).id as string,
    typeId,
  );
  await page.goto(`/base/${typeId}?view=${viewId}`);
  await workLocally(page);

  await page.getByRole("button", { name: "Move Row 1" }).click();
  await expect(page.getByRole("menuitem", { name: "To do" }), "its own column is not offered").toBeDisabled();
  await page.getByRole("menuitem", { name: "Done" }).click();
  await expect.poll(() => stored(page, typeId, "Row 1")).toEqual({ status: "done", note: "" });
});

test("a long Base opens with a page of rows and draws more as it scrolls", async ({ page, isMobile }) => {
  test.skip(isMobile, "the table's paging is the same at any width");
  const typeId = await makeBase(page, 450);
  await page.goto(`/base/${typeId}`);
  await workLocally(page);

  const rows = page.locator("tbody tr");
  await expect(page.getByText("450 of 450")).toBeVisible();
  await expect(rows).toHaveCount(200);
  await expect(page.getByRole("button", { name: "Show more (250 left)" })).toBeAttached();
  await rows.last().scrollIntoViewIfNeeded();
  await expect(rows).toHaveCount(400);
  await rows.last().scrollIntoViewIfNeeded();
  await expect(rows).toHaveCount(450);
  await expect(page.getByRole("button", { name: /^Show more/ }), "all drawn: nothing more to show").toHaveCount(0);
});
