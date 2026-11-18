import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";

/**
 * An agent's draft change to accepted material (ADR 0115): shown beside the item's own
 * values, applied only when the user accepts it, dropped when they discard it. The Word's
 * peek then lists the Sentences of its Topic that use its term (which ones,
 * wordSentences.test.ts).
 */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

async function seed(page: Page, topic: string) {
  await page.goto("/app/languages");
  await workLocally(page);
  await inCore(
    page,
    async (core, name: string) => {
      const t = await core.putDocument({ type: "language", title: name, name, newCap: 10, archived: false, tallies: [], folder: "", tags: [] });
      const at = new Date().toISOString();
      const base = { languageId: t.id, notes: "", origin: "", originId: "", paused: false, addedAt: at, tags: [] };
      await core.putDocument({ type: "language_word", title: "stazione", term: "stazione", meaning: "station", ...base, draftChange: { meaning: "railway station", notes: "feminine: la stazione" } });
      await core.putDocument({ type: "language_word", title: "gare", term: "gare", meaning: "station", ...base, draftChange: { meaning: "train station" } });
      await core.putDocument({ type: "language_sentence", title: "", text: "La {{stazione}} è lontana", translation: "The station is far", ...base });
      await core.putDocument({ type: "language_sentence", title: "", text: "Le stazioni sono chiuse", translation: "The stations are closed", ...base });
      localStorage.setItem("lifeline.languages.active", t.id);
    },
    topic,
  );
  await page.goto("/app/languages?tab=words");
  await workLocally(page);
}

test("a draft change shows beside the current values, is applied when accepted and dropped when discarded", async ({ page }) => {
  const topic = `Draft change ${Date.now()}`;
  await seed(page, topic);
  await expect(page.getByText("draft change", { exact: true })).toHaveCount(2);

  await page.getByRole("button", { name: /^stazione/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByTestId("current-meaning")).toHaveText("station");
  await expect(dialog.getByTestId("drafted-meaning")).toHaveText("railway station");
  await expect(dialog.getByTestId("drafted-notes")).toHaveText("feminine: la stazione");
  // Nothing has changed yet.
  await expect(dialog.getByLabel("Meaning")).toHaveValue("station");

  await dialog.getByRole("button", { name: "Accept change" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("railway station")).toBeVisible();
  await expect(page.getByText("draft change", { exact: true })).toHaveCount(1);

  // Discarded, the other leaves its item as it was.
  await page.getByRole("button", { name: /^gare/ }).click();
  await expect(dialog.getByTestId("drafted-meaning")).toHaveText("train station");
  await dialog.getByRole("button", { name: "Discard" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("train station")).toHaveCount(0);
  await expect(page.getByText("draft change", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: /^gare/ }).click();
  await expect(dialog.getByLabel("Meaning")).toHaveValue("station");
  await expect(dialog.getByRole("region", { name: "Draft change" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  // The Word's peek lists the Sentence that uses it, and opens it.
  await inCore(
    page,
    async (core, name: string) => {
      const t = (await core.documentsOf("language")).find((d) => (d as { name?: string }).name === name) as { id: string };
      const w = (await core.documentsOf("language_word")).find((d) => (d as { languageId?: string; term?: string }).languageId === t.id && (d as { term?: string }).term === "stazione") as { id: string };
      core.openPeek(w.id);
    },
    topic,
  );
  const peek = page.getByRole("dialog");
  await expect(peek.getByRole("button", { name: "La stazione è lontana" })).toBeVisible();
  await expect(peek.getByRole("button", { name: "Le stazioni sono chiuse" })).toHaveCount(0);
  await peek.getByRole("button", { name: "La stazione è lontana" }).click();
  await expect(page.getByRole("dialog").getByLabel("Translation")).toHaveValue("The station is far");
});
