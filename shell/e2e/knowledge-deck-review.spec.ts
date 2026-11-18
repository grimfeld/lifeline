import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";

/**
 * A Deck of an agent's drafts (ADR 0115): reviewed one by one, and accepted
 * together only once every draft left has been shown. Its Words are then
 * practised with another Deck's (#430), an item in both counted once (the
 * union itself is practice.test.ts's).
 */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

test("review a Deck, delete one draft, accept the rest with accept all, then practise it mixed with another Deck", async ({ page }) => {
  const topic = `Review ${Date.now()}`;
  await page.goto("/app/languages");
  await workLocally(page);
  await inCore(
    page,
    async (core, name: string) => {
      const t = await core.putDocument({ type: "language", title: name, name, newCap: 10, archived: false, tallies: [], folder: "", tags: [] });
      const at = new Date().toISOString();
      const members: string[] = [];
      for (const [i, [term, meaning]] of [["alfa", "first"], ["beta", "second"], ["gamma", "third"], ["delta", "fourth"]].entries()) {
        const w = await core.putDocument({ type: "language_word", title: term, languageId: t.id, term, meaning, notes: "", origin: "Agent draft · Lesson 1", originId: "", paused: false, draft: true, addedAt: new Date(Date.parse(at) + i).toISOString(), tags: [] });
        members.push(w.id);
      }
      await core.putDocument({ type: "language_deck", title: "Lesson 1", name: "Lesson 1", languageId: t.id, members, tags: [] });
      localStorage.setItem("lifeline.languages.active", t.id);
    },
    topic,
  );
  await page.goto("/app/languages?tab=decks");
  await workLocally(page);

  await page.getByRole("button", { name: "Review 4 drafts" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Draft 1 of 4")).toBeVisible();
  await expect(dialog.getByText("alfa")).toBeVisible();
  await expect(dialog.getByRole("button", { name: /Accept all/ })).toBeDisabled();

  // Show the second, and throw it away.
  await dialog.getByRole("button", { name: "Next" }).click();
  await expect(dialog.getByText("beta")).toBeVisible();
  await dialog.getByRole("button", { name: "Delete" }).click();
  await expect(dialog.getByText("Draft 2 of 3")).toBeVisible();
  // Deleted at once, with Undo; undone, it is back in the Deck, then thrown away for good.
  await dialog.getByRole("button", { name: "Undo" }).click();
  await expect(dialog.getByText("Draft 2 of 4")).toBeVisible();
  await expect(dialog.getByText("beta")).toBeVisible();
  await dialog.getByRole("button", { name: "Delete" }).click();
  await expect(dialog.getByText("Draft 2 of 3")).toBeVisible();
  await expect(dialog.getByText("gamma")).toBeVisible();
  await expect(dialog.getByRole("button", { name: /Accept all/ })).toBeDisabled();

  // Once the last has been shown, every draft left has been seen.
  await dialog.getByRole("button", { name: "Next" }).click();
  await expect(dialog.getByText("delta")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Accept all (3)" })).toBeEnabled();
  await dialog.getByRole("button", { name: "Accept all (3)" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: /Review .* draft/ })).toHaveCount(0);

  const words = await inCore(
    page,
    async (core, name: string) => {
      const t = (await core.documentsOf("language")).find((d) => (d as { name?: string }).name === name) as { id: string };
      return (await core.documentsOf("language_word")).filter((w) => (w as { languageId?: string }).languageId === t.id).map((w) => w as unknown as { term: string; draft?: boolean }).map((w) => [w.term, w.draft]);
    },
    topic,
  );
  expect(words.sort()).toEqual([["alfa", false], ["delta", false], ["gamma", false]]);

  // Mixed with a second Deck sharing "delta" and "gamma", the three Words are practised together, each once.
  await inCore(
    page,
    async (core, name: string) => {
      const t = (await core.documentsOf("language")).find((d) => (d as { name?: string }).name === name) as { id: string };
      const w = (await core.documentsOf("language_word")).filter((d) => (d as { languageId?: string }).languageId === t.id) as unknown as { id: string; term: string }[];
      const id = (term: string) => w.find((x) => x.term === term)!.id;
      await core.putDocument({ type: "language_deck", title: "Lesson 2", name: "Lesson 2", languageId: t.id, members: [id("delta"), id("gamma")], tags: [] });
      await core.putDocument({ type: "language_deck", title: "Lesson 3", name: "Lesson 3", languageId: t.id, members: [id("gamma")], tags: [] });
    },
    topic,
  );
  await page.goto("/app/languages");
  await workLocally(page);
  await page.getByRole("button", { name: "Mix decks" }).click();
  const together = page.getByRole("button", { name: /decks together/ });
  await expect(together).toBeDisabled();
  await page.getByRole("button", { name: /Lesson 1/ }).click();
  await page.getByRole("button", { name: /Lesson 2/ }).click();
  await expect(together).toBeEnabled();
  await expect(together).toContainText("6 new"); // 3 Words x 2 Prompts; "delta" and "gamma" are in both Decks, counted once
  await together.click();
  await expect(page.getByText(/Lesson 1 \+ Lesson 2/)).toBeVisible();
  await expect(page.getByText(/· 6 new/)).toBeVisible();
});
