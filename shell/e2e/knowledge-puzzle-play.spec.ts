import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";

/**
 * Into a Puzzle and out of it (ADR 0106): the Today's Puzzles Card's Play
 * opens today's Puzzle itself, and "Practise now" practises what it drew.
 */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

/** A Topic with "palabra" met reversed (a Wordle-like draws it) and "mar", never met. */
async function topicWithPuzzle(page: Page, name: string) {
  await page.goto("/app/languages");
  await workLocally(page);
  await inCore(
    page,
    async (core, name: string) => {
      const t = await core.putDocument({ type: "language", title: name, name, newCap: 10, archived: false, tallies: [], tags: [] });
      const at = new Date(Date.now() - 3 * 86_400_000).toISOString();
      const word = (term: string, meaning: string) => core.putDocument({ type: "language_word", languageId: t.id, term, meaning, notes: "", origin: "", originId: "", paused: false, addedAt: at, tags: [] });
      const w = await word("palabra", "a unit of speech");
      await word("mar", "sea");
      await core.putDocument({ type: "language_recall", title: "", languageId: t.id, itemId: w.id, slot: "reverse", grade: "pass", at, tags: [] });
    },
    name,
  );
}

test("the Today's Puzzles Card's Play opens today's Puzzle", async ({ page }) => {
  const name = `Card topic ${Date.now()}`;
  await topicWithPuzzle(page, name);
  const screenId = `e2epuzzles${Date.now()}`;
  await inCore(
    page,
    async (core, id: string) => core.put("screens", { id, name: "Puzzles", layout: [{ instanceId: "p", cardId: "languages.puzzles", settings: {}, x: 0, y: 0, w: 4, h: 4 }], sort: 0, workspace: core.currentWorkspaceId() } as never),
    screenId,
  );
  await page.goto(`/screen/${screenId}`);
  await workLocally(page);
  await page.getByRole("listitem").filter({ hasText: name }).getByRole("button", { name: "Play" }).click();
  await expect(page.getByLabel("Guess 1 of 6")).toBeVisible();
  await expect(page).toHaveURL(/puzzle=/);
});

test("Practise now practises what the Puzzle drew", async ({ page }) => {
  const name = `Practise topic ${Date.now()}`;
  await topicWithPuzzle(page, name);
  await page.goto("/app/languages?tab=puzzles");
  await workLocally(page);
  const row = page.getByText(name, { exact: true }).locator("xpath=ancestor::div[contains(@class,'rounded-lg')]");
  await row.getByRole("button", { name: "Play", exact: true }).click();
  await page.getByRole("button", { name: "Give up" }).click();
  await page.getByRole("button", { name: "Practise now" }).click();
  // palabra's forward Prompt is new; mar's two would make three.
  await expect(page.getByText(new RegExp(`${name} · Wordle-like · \\d+ due · 1 new`))).toBeVisible();
});
