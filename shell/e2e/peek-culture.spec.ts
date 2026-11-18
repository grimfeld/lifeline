import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";

/**
 * An editable Peek (ADR 0085) with a guarded Field, the App transition menu
 * pattern: a book is edited where it is peeked — here over the Vault, away
 * from its Home Module — and its Shelf moves only through the Library's own
 * operations. Each App's one-field edits are component tests of its Peek part
 * (`@lifeline/parts/testing`, #561).
 */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

/** A fresh Document of `type`, peeked over the Vault. */
async function peekNew(page: Page, type: string, fields: Record<string, unknown> = {}) {
  await page.goto("/vault");
  await workLocally(page);
  await expect.poll(() => inCore(page, async (core, t: string) => !!core.documentType(t), type)).toBe(true);
  const id = await inCore(
    page,
    async (core, a: { type: string; title: string; fields: Record<string, unknown> }) => (await core.putDocument({ type: a.type, title: a.title, body: "", ...a.fields })).id as string,
    { type, title: `A ${type} ${Date.now()}`, fields },
  );
  await inCore(page, async (core, docId: string) => core.openPeek(docId), id);
  return { id, dialog: page.getByRole("dialog") };
}

const fieldOf = (page: Page, id: string, key: string) => inCore(page, async (core, a: { id: string; key: string }) => (await core.getDocument(a.id))![a.key], { id, key });

test("Library: a book's Year is edited in its Peek, and its Shelf moves only through the Library's operations", async ({ page }) => {
  const { id, dialog } = await peekNew(page, "book", { engagement: "UNSTARTED", acquisition: "WANTED" });
  await dialog.getByLabel("Year").fill("1969");
  await expect.poll(() => fieldOf(page, id, "year")).toBe(1969);
  // Its descriptive Fields are plain: series, with a decimal number, and the synopsis.
  await dialog.getByLabel("Series", { exact: true }).fill("Dune Chronicles");
  await dialog.getByLabel("Number", { exact: true }).fill("1.5");
  await dialog.getByLabel("Synopsis").fill("A desert planet.");
  await expect.poll(() => fieldOf(page, id, "series")).toBe("Dune Chronicles");
  await expect.poll(() => fieldOf(page, id, "seriesNumber")).toBe(1.5);
  await expect.poll(() => fieldOf(page, id, "synopsis")).toBe("A desert planet.");
  // The guarded Shelf has no raw control, only the Library's own transitions.
  await expect(dialog.getByRole("combobox", { name: "Shelf" })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Shelf" }).click();
  await page.getByRole("menuitem", { name: "Got it (owned)" }).click();
  await expect.poll(() => fieldOf(page, id, "acquisition")).toBe("OWNED");
});
