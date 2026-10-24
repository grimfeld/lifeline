import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";

/**
 * A Topic's second Tally occurrence (ADR 0106): "daily Puzzle finished". Set
 * in the Topic dialog beside "day practised", it logs a Habit when a daily
 * Puzzle is finished — once, solved or not.
 */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

test("a Topic tallies each finished daily Puzzle to a Habit", async ({ page }) => {
  const stamp = Date.now();
  const habit = `Play ${stamp}`;
  const topic = `Tally topic ${stamp}`;
  await page.goto("/app/languages");
  await workLocally(page);
  await inCore(page, async (core, title: string) => core.putDocument({ type: "habit", title, difficulty: "normal" }), habit);

  // The Topic dialog offers both occurrences; the Tally counts the Puzzle.
  await page.getByRole("button", { name: "New topic" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill(topic);
  await dialog.getByRole("combobox", { name: "Add a tally" }).click();
  await page.getByRole("option", { name: new RegExp(habit) }).click();
  await dialog.getByRole("combobox", { name: "Occurrence to count" }).click();
  await expect(page.getByRole("option", { name: "day practised" })).toBeVisible();
  await page.getByRole("option", { name: "daily Puzzle finished" }).click();
  await dialog.getByRole("button", { name: "Create" }).click();
  await expect(dialog).toBeHidden();

  // A practised Word, so the Topic has a Puzzle to draw.
  await inCore(
    page,
    async (core, name: string) => {
      const t = (await core.documentsOf("language")).find((d) => (d as { name?: string }).name === name) as { id: string };
      const at = new Date(Date.now() - 3 * 86_400_000).toISOString();
      const w = await core.putDocument({ type: "language_word", languageId: t.id, term: "palabra", meaning: "a unit of speech", notes: "", origin: "", originId: "", paused: false, addedAt: at, tags: [] });
      await core.putDocument({ type: "language_recall", title: "", languageId: t.id, itemId: w.id, slot: "reverse", grade: "pass", at, tags: [] });
    },
    topic,
  );
  const completions = () =>
    inCore(
      page,
      async (core, title: string) => {
        const h = (await core.documentsOf("habit")).find((d) => d.title === title) as { id: string };
        return (await core.documentsOf("habit_completion")).filter((c) => (c as { habitId?: string }).habitId === h.id).length;
      },
      habit,
    );

  await page.goto("/app/languages?tab=puzzles");
  await workLocally(page);
  const row = page.getByText(topic, { exact: true }).locator("xpath=ancestor::div[contains(@class,'rounded-lg')]");
  await row.getByRole("button", { name: "Play" }).click();
  expect(await completions()).toBe(0);
  const guess = page.getByLabel("Guess 1 of 6");
  await guess.fill("palabra");
  await guess.press("Enter");
  await expect(page.getByText("Solved in 1")).toBeVisible();
  await expect.poll(completions).toBe(1);
});
