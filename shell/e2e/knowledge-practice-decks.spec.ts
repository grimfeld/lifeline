import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";

/** A Practice narrowed to several Decks of one Topic (#430): their union, an item in two Decks once. */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

test("two Decks are practised together, a shared item once", async ({ page }) => {
  const topic = `Mix topic ${Date.now()}`;
  await page.goto("/app/languages");
  await workLocally(page);
  await inCore(
    page,
    async (core, name: string) => {
      const t = await core.putDocument({ type: "language", title: name, name, newCap: 20, archived: false, tallies: [], tags: [] });
      const at = new Date(Date.now() - 3 * 86_400_000).toISOString();
      const ids: string[] = [];
      for (const term of ["uno", "dos", "tres"]) {
        const w = await core.putDocument({ type: "language_word", languageId: t.id, term, meaning: `m-${term}`, notes: "", origin: "", originId: "", paused: false, addedAt: at, tags: [] });
        ids.push(w.id);
      }
      await core.putDocument({ type: "language_deck", title: "Lesson A", name: "Lesson A", languageId: t.id, members: [ids[0], ids[1]], tags: [] });
      await core.putDocument({ type: "language_deck", title: "Lesson B", name: "Lesson B", languageId: t.id, members: [ids[1], ids[2]], tags: [] });
      await core.putDocument({ type: "language_deck", title: "Lesson C", name: "Lesson C", languageId: t.id, members: [ids[2]], tags: [] });
    },
    topic,
  );
  await page.reload();
  await workLocally(page);
  await page.getByRole("combobox").first().click().catch(() => {});
  const option = page.getByRole("option", { name: topic });
  if (await option.isVisible().catch(() => false)) await option.click();

  await page.getByRole("button", { name: "Mix decks" }).click();
  const together = page.getByRole("button", { name: /decks together/ });
  await expect(together).toBeDisabled();
  await page.getByRole("button", { name: /Lesson A/ }).click();
  await page.getByRole("button", { name: /Lesson B/ }).click();
  await expect(together).toBeEnabled();
  await expect(together).toContainText("6 new"); // 3 words x 2 Prompts; "dos" is in both Decks, counted once
  await together.click();

  await expect(page.getByText(/Lesson A \+ Lesson B/)).toBeVisible();
  await expect(page.getByText(/· 6 new/)).toBeVisible();
});
