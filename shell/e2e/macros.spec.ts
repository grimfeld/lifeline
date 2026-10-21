import { test, expect, type Page } from "@playwright/test";
import { CORE_URL } from "./support/seed";

/**
 * Macros (CONTEXT.md "Macro", ADR 0092): made in Settings → Macros from
 * Commands with fixed values, run from the palette as one Command, stopped at
 * a refused step, and reported step by step after every run.
 */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

async function addStep(page: Page, command: string, field: string, value: string) {
  const editor = page.getByRole("dialog");
  const add = editor.getByRole("combobox", { name: "Add a step" });
  await add.fill(command);
  await page.getByRole("option", { name: command, exact: true }).click();
  const step = editor.getByRole("listitem").last();
  await step.getByLabel(field).fill(value);
}

test("a Macro made in Settings runs from the palette, stops at a refusal and reports each step", async ({ page, isMobile }) => {
  test.skip(isMobile, "the palette is not opened on a phone");
  const need = `Oat milk ${Date.now()}`;
  await page.goto("/settings/macros");
  await workLocally(page);
  await page.getByRole("button", { name: "New macro" }).click();
  await page.getByRole("dialog").getByLabel("Name").fill("Errand run");
  await addStep(page, "Add task", "Title (required)", "Call mum about the errands");
  await addStep(page, "Add need…", "Thing (required)", need);
  await addStep(page, "Add need…", "Thing (required)", need);
  await addStep(page, "Add task", "Title (required)", "Never written");
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("list", { name: "Macros" })).toContainText("Errand run");

  await page.keyboard.press("Control+k");
  await page.getByRole("combobox").fill("Errand run");
  await page.getByRole("option", { name: /Errand run/ }).click();

  const report = page.getByRole("dialog", { name: "Errand run" });
  const steps = report.getByRole("list", { name: "Steps" }).getByRole("listitem");
  await expect(steps).toHaveCount(4);
  await expect(steps.nth(0)).toContainText("Done");
  await expect(steps.nth(1)).toContainText("Done");
  await expect(steps.nth(2)).toContainText("Stopped");
  await expect(steps.nth(2)).toContainText("already on the shopping list");
  await expect(steps.nth(3)).toContainText("Not reached");

  const titles = await page.evaluate(async (coreUrl) => {
    const core = await import(/* @vite-ignore */ coreUrl);
    return (await core.documentsOf("task")).map((d: { title: string }) => d.title);
  }, CORE_URL);
  expect(titles).toContain("Call mum about the errands");
  expect(titles).not.toContain("Never written");

  await steps.nth(0).getByRole("button", { name: "Open" }).click();
  await expect(report).toBeHidden();
  await expect(page.getByText("Call mum about the errands").first()).toBeVisible();
});

test("deleting a Macro is undone from its toast", async ({ page }) => {
  await page.goto("/settings/macros");
  await workLocally(page);
  await page.evaluate(async (coreUrl) => {
    const core = await import(/* @vite-ignore */ coreUrl);
    await core.saveMacro({ name: "Short-lived", steps: [] });
  }, CORE_URL);
  const list = page.getByRole("list", { name: "Macros" });
  await expect(list).toContainText("Short-lived");
  await page.getByRole("button", { name: "Delete Short-lived" }).click();
  await expect(page.getByText("Short-lived")).toHaveCount(1); // only the toast says it now
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(list).toContainText("Short-lived");
});
