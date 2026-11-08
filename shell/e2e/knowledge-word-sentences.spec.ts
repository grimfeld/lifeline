import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";

/** A Word's peek lists the Sentences of its Topic that use its term; each opens its own peek. */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

test("a Word's peek lists a Sentence that uses it", async ({ page }) => {
  const stamp = Date.now();
  const topic = `Sentences topic ${stamp}`;
  await page.goto("/app/languages");
  await workLocally(page);
  await inCore(
    page,
    async (core, name: string) => {
      const t = await core.putDocument({ type: "language", name, newCap: 10, archived: false, tags: [] });
      const at = new Date().toISOString();
      const base = { languageId: t.id, origin: "", originId: "", paused: false, addedAt: at, tags: [] };
      await core.putDocument({ type: "language_word", term: "tavolo", meaning: "table", notes: "", ...base });
      await core.putDocument({ type: "language_sentence", text: "Il {{tavolo}} è grande", translation: "The table is big", ...base });
      await core.putDocument({ type: "language_sentence", text: "I tavoli sono grandi", translation: "The tables are big", ...base });
      localStorage.setItem("lifeline.languages.active", t.id);
    },
    topic,
  );
  await page.goto("/app/languages?tab=words");
  await workLocally(page);
  await inCore(
    page,
    async (core, name: string) => {
      const t = (await core.documentsOf("language")).find((d) => (d as { name?: string }).name === name) as { id: string };
      const w = (await core.documentsOf("language_word")).find((d) => (d as { languageId?: string }).languageId === t.id) as { id: string };
      core.openPeek(w.id);
    },
    topic,
  );
  const peek = page.getByRole("dialog");
  await expect(peek.getByRole("button", { name: "Il tavolo è grande" })).toBeVisible();
  await expect(peek.getByRole("button", { name: "I tavoli sono grandi" })).toHaveCount(0);
  await peek.getByRole("button", { name: "Il tavolo è grande" }).click();
  await expect(page.getByRole("dialog").getByLabel("Translation")).toHaveValue("The table is big");
});
