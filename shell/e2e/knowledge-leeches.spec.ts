import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";

/** A Leech (#433): a Prompt with 4 fails among its last 8 Recalls, listed on the Topic with pause and edit. */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

test("a Prompt failed repeatedly is listed as a Leech, can be edited, and is gone once paused", async ({ page }) => {
  const topic = `Leeches ${Date.now()}`;
  await page.goto("/app/languages");
  await workLocally(page);
  await inCore(
    page,
    async (core, name: string) => {
      const t = await core.putDocument({ type: "language", title: name, name, newCap: 10, archived: false, tallies: [], folder: "", tags: [] });
      const day = (back: number) => new Date(Date.now() - back * 3_600_000).toISOString();
      const mk = (term: string, meaning: string) => core.putDocument({ type: "language_word", title: term, languageId: t.id, term, meaning, notes: "", origin: "", originId: "", paused: false, addedAt: day(100), tags: [] });
      const stuck = await mk("stazione", "station");
      const fine = await mk("treno", "train");
      for (let k = 0; k < 4; k++) await core.putDocument({ type: "language_recall", title: "fail", languageId: t.id, itemId: stuck.id, slot: "reverse", grade: "fail", at: day(10 - k), tags: [] });
      for (let k = 0; k < 3; k++) await core.putDocument({ type: "language_recall", title: "fail", languageId: t.id, itemId: fine.id, slot: "reverse", grade: "fail", at: day(10 - k), tags: [] });
      localStorage.setItem("lifeline.languages.active", t.id);
    },
    topic,
  );
  await page.goto("/app/languages");
  await workLocally(page);

  const section = page.locator("section", { has: page.getByRole("heading", { name: "Leeches" }) });
  await expect(section.getByText("station")).toBeVisible();
  await expect(section.getByText("4 fails")).toBeVisible();
  await expect(section.getByText("train")).toHaveCount(0); // 3 fails: not yet

  await section.getByRole("button", { name: "Edit station" }).click();
  await expect(page.getByRole("dialog").getByLabel("Meaning")).toHaveValue("station");
  await page.keyboard.press("Escape");

  await section.getByRole("button", { name: "Pause station" }).click();
  await expect(page.getByRole("heading", { name: "Leeches" })).toHaveCount(0);
});
