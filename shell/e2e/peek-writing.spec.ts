import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";

/**
 * A Peek edits (ADR 0085), the writing Apps' part: a Day, a Source, a Note, a
 * Quote, an Essay, a Chapter and a Thought are edited where they are peeked,
 * through their own App's controls, and a guarded Field changes only through
 * the App's operations.
 */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

/** Put the Documents (in order: a later one may name an earlier one's id as `$0`, `$1`…), then peek the last, over the Vault. */
async function peekNew(page: Page, docs: Record<string, unknown>[]) {
  await page.goto("/vault");
  await workLocally(page);
  const ids = await inCore(
    page,
    async (core, list: Record<string, unknown>[]) => {
      const out: string[] = [];
      for (const d of list) {
        const resolved = Object.fromEntries(Object.entries(d).map(([k, v]) => [k, typeof v === "string" && /^\$\d+$/.test(v) ? out[Number(v.slice(1))] : v]));
        out.push((await core.putDocument({ body: "", ...resolved } as unknown as { type: string })).id as string);
      }
      core.openPeek(out[out.length - 1]);
      return out;
    },
    docs,
  );
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  return { dialog, id: ids[ids.length - 1], ids };
}

const field = (page: Page, id: string, key: string) => inCore(page, async (core, a: { id: string; key: string }) => (await core.getDocument(a.id))?.[a.key], { id, key });

async function pick(page: Page, dialog: ReturnType<Page["getByRole"]>, label: string, option: string) {
  await dialog.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

test("Journal: a Day's Tags are edited in its Peek", async ({ page }) => {
  const { dialog, id } = await peekNew(page, [{ type: "daily", title: "2031-03-04", body: "A day with #walk in it.\n" }]);
  await dialog.getByLabel("Tags").fill("seaside");
  await dialog.getByLabel("Tags").press("Enter");
  await expect.poll(() => field(page, id, "tags")).toEqual(expect.arrayContaining(["seaside", "walk"]));
});

test("Notes: a Source's kind and author, and a Quote's place, are edited in their Peeks; the Quote's Source is not", async ({ page }) => {
  const stamp = Date.now();
  const { dialog, id, ids } = await peekNew(page, [{ type: "source", title: `A talk ${stamp}` }]);
  await pick(page, dialog, "Kind", "Podcast");
  await dialog.getByLabel("Author").fill("Ada");
  await dialog.getByLabel("Author").press("Enter");
  await expect.poll(() => field(page, id, "kind")).toBe("podcast");
  await expect.poll(() => field(page, id, "author")).toBe("Ada");

  const quoteId = await inCore(page, async (core, source: string) => {
    const q = await core.putDocument({ type: "quote", title: "", body: "To be is to be perceived.\n", source, capturedOn: "2031-03-04" });
    core.openPeek(q.id);
    return q.id as string;
  }, ids[0]);
  await expect(dialog.getByLabel("Where")).toBeVisible();
  await dialog.getByLabel("Where").fill("p. 12");
  await dialog.getByLabel("Where").blur();
  await expect.poll(() => field(page, quoteId, "locator")).toBe("p. 12");
  // Guarded: its Source is shown, never picked here.
  await expect(dialog.getByRole("combobox", { name: "Source" })).toHaveCount(0);
});

test("Research: an Essay's status is set in its Peek", async ({ page }) => {
  const { dialog, id } = await peekNew(page, [{ type: "essay", title: `On peeking ${Date.now()}`, status: "draft", material: [] }]);
  await pick(page, dialog, "Status", "Revised");
  await expect.poll(() => field(page, id, "status")).toBe("revised");
});

test("Manuscript: a Chapter's status is set and its order moved through the App, in its Peek", async ({ page }) => {
  const stamp = Date.now();
  const { dialog, id, ids } = await peekNew(page, [
    { type: "manuscript", title: `A novel ${stamp}`, form: "novel", status: "draft" },
    { type: "chapter", title: `One ${stamp}`, manuscriptId: "$0", position: 1, status: "draft" },
    { type: "chapter", title: `Two ${stamp}`, manuscriptId: "$0", position: 2, status: "draft" },
  ]);
  await pick(page, dialog, "Status", "Done");
  await expect.poll(() => field(page, id, "status")).toBe("done");
  await dialog.getByRole("button", { name: "Earlier" }).click();
  await expect.poll(async () => Number(await field(page, id, "position")) < Number(await field(page, ids[1], "position"))).toBe(true);
});

test("Thoughts: a Thought's kind is set in its Peek", async ({ page }) => {
  const { dialog, id } = await peekNew(page, [{ type: "thought", title: `Why peek ${Date.now()}`, body: "Hm.\n" }]);
  await pick(page, dialog, "Kind", "Question");
  await expect.poll(() => field(page, id, "kind")).toBe("question");
});
