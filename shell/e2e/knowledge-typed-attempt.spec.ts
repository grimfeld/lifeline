import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";

/** A typed attempt on a blank (ADR 0116): typed, revealed beside the answer, graded by the user, kept on the Recall. */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

test("type into a blank, reveal with Enter, see both, grade, and the Recall keeps it", async ({ page }) => {
  const topic = `Typed topic ${Date.now()}`;
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
      await core.putDocument({ type: "language_sentence", title: "Perché", languageId: t.id, text: "Resto a casa {{perché}} piove", translation: "I stay home because it rains", notes: "", origin: "", originId: "", paused: false, addedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(), tags: [] });
    },
    topic,
  );

  await page.goto("/app/languages");
  await workLocally(page);
  await page.getByRole("button", { name: `Practise ${topic}` }).click();
  const field = page.getByLabel("Your answer");
  await expect(field).toBeFocused(); // no click needed before typing
  await field.fill("perche");
  await field.press("Enter");
  const both = page.getByTestId("attempt-vs-answer");
  await expect(both).toContainText("You typed");
  await expect(both).toContainText("perche");
  await expect(both).toContainText("perché");
  await expect(page.getByRole("button", { name: "Fail" })).toBeFocused(); // focus follows the reveal, not the body
  await page.getByRole("button", { name: "Fail" }).click();

  const kept = await inCore(page, async (core, name: string) => {
    const t = (await core.documentsOf("language")).find((d) => (d as { name?: string }).name === name) as { id: string };
    return (await core.documentsOf("language_recall")).filter((r) => (r as { languageId?: string }).languageId === t.id).map((r) => (r as { typed?: string }).typed);
  }, topic);
  expect(kept).toEqual(["perche"]);
});

test("revealing without typing still works and keeps no attempt", async ({ page }) => {
  const topic = `Untyped topic ${Date.now()}`;
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
      await core.putDocument({ type: "language_sentence", title: "Perché", languageId: t.id, text: "Resto a casa {{perché}} piove", translation: "", notes: "", origin: "", originId: "", paused: false, addedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(), tags: [] });
    },
    topic,
  );
  await page.goto("/app/languages");
  await workLocally(page);
  await page.getByRole("button", { name: `Practise ${topic}` }).click();
  await page.getByRole("button", { name: "Show answer" }).click();
  await expect(page.getByTestId("attempt-vs-answer")).toBeHidden();
  await page.getByRole("button", { name: "Pass" }).click();
});
