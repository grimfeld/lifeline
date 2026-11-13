import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";

/**
 * An agent's draft change to accepted material (ADR 0115): shown beside the item's own
 * values, applied only when the user accepts it, dropped when they discard it.
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
      localStorage.setItem("lifeline.languages.active", t.id);
    },
    topic,
  );
  await page.goto("/app/languages?tab=words");
  await workLocally(page);
}

test("a draft change shows beside the current values and is applied when accepted", async ({ page }) => {
  await seed(page, `Draft change ${Date.now()}`);
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
});

test("a draft change discarded leaves the item as it was", async ({ page }) => {
  await seed(page, `Draft change ${Date.now()}`);
  await page.getByRole("button", { name: /^gare/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByTestId("drafted-meaning")).toHaveText("train station");
  await dialog.getByRole("button", { name: "Discard" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("train station")).toHaveCount(0);
  await expect(page.getByText("draft change", { exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: /^gare/ }).click();
  await expect(page.getByRole("dialog").getByLabel("Meaning")).toHaveValue("station");
  await expect(page.getByRole("dialog").getByRole("region", { name: "Draft change" })).toHaveCount(0);
});
