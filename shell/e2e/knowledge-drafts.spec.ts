import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";

/**
 * An agent's drafts (ADR 0115): listed in Kept with a draft mark, out of practice
 * until the user accepts them — one at a time, edited first, or deleted.
 */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

test("a draft waits in Kept; accepting it, editing then accepting it, or deleting it is the user's", async ({ page }) => {
  const stamp = Date.now();
  const topic = `Drafts ${stamp}`;
  await page.goto("/app/languages");
  await workLocally(page);
  await inCore(
    page,
    async (core, name: string) => {
      const t = await core.putDocument({ type: "language", title: name, name, newCap: 10, archived: false, tallies: [], folder: "", tags: [] });
      const at = new Date().toISOString();
      for (const [term, meaning] of [["alfa", "first"], ["beta", "second"], ["gamma", "third"]]) {
        await core.putDocument({ type: "language_word", title: term, languageId: t.id, term, meaning, notes: "", origin: "Agent draft · Lesson 1", originId: "", paused: false, draft: true, addedAt: at, tags: [] });
      }
      localStorage.setItem("lifeline.languages.active", t.id);
    },
    topic,
  );
  await page.goto("/app/languages");
  await workLocally(page);

  // Out of practice: the Topic has nothing new to practise, though three Words are kept.
  await expect(page.getByText("0 new today")).toBeVisible();
  await page.goto("/app/languages?tab=words");
  await workLocally(page);
  await expect(page.getByText("draft", { exact: true })).toHaveCount(3);

  // Accept one from its row.
  await page.getByRole("button", { name: /^alfa/ }).locator("xpath=..").getByRole("button", { name: /Accept/ }).click();
  await expect(page.getByText("draft", { exact: true })).toHaveCount(2);

  // Edit one, then accept it.
  await page.getByRole("button", { name: /^beta/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Meaning").fill("second, edited");
  await dialog.getByRole("button", { name: "Save & accept" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("draft", { exact: true })).toHaveCount(1);
  await expect(page.getByText("second, edited")).toBeVisible();

  // Delete the last.
  await page.getByRole("button", { name: /^gamma/ }).click();
  await dialog.getByRole("button", { name: "Delete" }).click();
  await dialog.getByRole("button", { name: "Really delete" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("gamma")).toHaveCount(0);
  await expect(page.getByText("draft", { exact: true })).toHaveCount(0);

  // The accepted ones are in practice as new, from now.
  const added = await inCore(
    page,
    async (core, name: string) => {
      const t = (await core.documentsOf("language")).find((d) => (d as { name?: string }).name === name) as { id: string };
      return (await core.documentsOf("language_word")).filter((w) => (w as { languageId?: string }).languageId === t.id).map((w) => w as unknown as { term: string; draft?: boolean; origin: string })
        .map((w) => [w.term, w.draft, w.origin]);
    },
    topic,
  );
  expect(added.sort()).toEqual([["alfa", false, "Agent draft · Lesson 1"], ["beta", false, "Agent draft · Lesson 1"]]);
});
