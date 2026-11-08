import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";

/**
 * A blank's hint and a Sentence's notes (ADR 0116): the hint sits in the gap
 * while the blank is hidden, the notes come with every reveal.
 */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

test("a Sentence's hint shows in the gap before the reveal and its notes after", async ({ page }) => {
  const topic = `Hint topic ${Date.now()}`;
  await page.goto("/app/languages");
  await workLocally(page);
  await page.getByRole("button", { name: "New topic" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill(topic);
  await dialog.getByRole("button", { name: "Create" }).click();
  await expect(dialog).toBeHidden();

  await inCore(
    page,
    async (core, name: string) => {
      const t = (await core.documentsOf("language")).find((d) => (d as { name?: string }).name === name) as { id: string };
      await core.putDocument({
        type: "language_sentence",
        title: "Vado nel centro",
        languageId: t.id,
        text: "Vado {{nel|in}} centro",
        translation: "I go downtown",
        notes: "also: in centro",
        origin: "",
        originId: "",
        paused: false,
        addedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
        tags: [],
      });
    },
    topic,
  );

  await page.goto("/app/languages");
  await workLocally(page);
  await page.getByRole("button", { name: `Practise ${topic}` }).click();
  await expect(page.getByText("Fill the blank")).toBeVisible();
  await expect(page.getByText("in", { exact: true })).toBeVisible();
  await expect(page.getByText("also: in centro")).toBeHidden();
  await page.getByRole("button", { name: "Show answer" }).click();
  await expect(page.getByText("nel", { exact: true })).toBeVisible();
  await expect(page.getByText("also: in centro")).toBeVisible();
});
