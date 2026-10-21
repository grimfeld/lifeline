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

async function runFromPalette(page: Page, name: string) {
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox").fill(name);
  await page.getByRole("option", { name: new RegExp(name) }).click();
}

test("a Macro asks its asked arguments in one form, skips a step refused when it may be, and goes somewhere last", async ({ page, isMobile }) => {
  test.skip(isMobile, "the palette is not opened on a phone");
  const title = `Water the plants ${Date.now()}`;
  await page.goto("/settings/macros");
  await workLocally(page);
  await page.getByRole("button", { name: "New macro" }).click();
  const editor = page.getByRole("dialog");
  await editor.getByLabel("Name").fill("Morning check");
  const add = editor.getByRole("combobox", { name: "Add a step" });
  for (const command of ["Add task", "Set mood…", "Go to Mood"]) {
    await add.fill(command);
    await page.getByRole("option", { name: command, exact: true }).click();
  }
  const steps = editor.getByRole("list", { name: "Steps" }).getByRole("listitem");
  for (const [i, arg] of [[0, "Title"], [1, "Mood"]] as const) {
    await steps.nth(i).getByRole("combobox", { name: `Source of ${arg}` }).click();
    await page.getByRole("option", { name: "Asked when it runs" }).click();
  }
  await steps.nth(1).getByLabel("Skip if refused").check();
  await expect(steps.nth(2)).toContainText("it is the last step");
  // Moved up, the step that goes somewhere is no longer last, and the Macro cannot be saved so.
  await steps.nth(2).getByRole("button", { name: "Move up" }).click();
  await expect(steps.nth(1)).toContainText("must be the last step");
  await expect(editor.getByRole("button", { name: "Save" })).toBeDisabled();
  await steps.nth(1).getByRole("button", { name: "Move down" }).click();
  await editor.getByRole("button", { name: "Save" }).click();

  for (const run of [1, 2]) {
    await runFromPalette(page, "Morning check");
    const form = page.getByRole("dialog", { name: "Morning check" });
    await form.getByLabel("Title (required)").fill(`${title} ${run}`);
    await form.getByRole("combobox", { name: "Mood (required)" }).click();
    await page.getByRole("option", { name: /Good/ }).click();
    await form.getByRole("button", { name: "Run" }).click();

    const report = page.getByRole("dialog", { name: "Morning check" }).getByRole("list", { name: "Steps" }).getByRole("listitem");
    await expect(report).toHaveCount(3);
    await expect(report.nth(0)).toContainText("Done");
    await expect(report.nth(2)).toContainText("Done");
    // Today's mood is set by the first run at the latest: the second is refused, and skipped.
    if (run === 2) {
      await expect(report.nth(1)).toContainText("Skipped");
      await expect(report.nth(1)).toContainText("already has a mood");
    }
    await expect(page).toHaveURL(/\/mood/);
    await page.getByRole("dialog", { name: "Morning check" }).getByRole("button", { name: "Close", exact: true }).first().click();
  }

  const titles = await page.evaluate(async (coreUrl) => {
    const core = await import(/* @vite-ignore */ coreUrl);
    return (await core.documentsOf("task")).map((d: { title: string }) => d.title);
  }, CORE_URL);
  expect(titles).toEqual(expect.arrayContaining([`${title} 1`, `${title} 2`]));
});

test("the built-in morning Macro is given once: reset puts it back as it shipped, deleted it never returns", async ({ page }) => {
  await page.goto("/settings/macros");
  await workLocally(page);
  const list = page.getByRole("list", { name: "Macros" });
  await expect(list).toContainText("Morning");
  await expect(list).toContainText("Set mood… → Go to Today");

  await page.evaluate(async (coreUrl) => {
    const core = await import(/* @vite-ignore */ coreUrl);
    const morning = (await core.allMacros()).find((m: { builtin?: string }) => m.builtin === "morning");
    await core.saveMacro({ id: morning.id, name: "Slow morning", steps: [] });
  }, CORE_URL);
  await expect(list).toContainText("Slow morning");
  await page.getByRole("button", { name: "Reset Slow morning to default" }).click();
  await expect(list).toContainText("Set mood… → Go to Today");
  await expect(list).not.toContainText("Slow morning");

  await page.getByRole("button", { name: "Delete Morning" }).click();
  await expect(list.getByText("Morning", { exact: true })).toHaveCount(0);
  await page.reload();
  await workLocally(page);
  await expect(page.getByRole("button", { name: "New macro" })).toBeVisible();
  // Seeding runs on every load; give it the chance to (wrongly) bring Morning back.
  await page.waitForTimeout(500);
  await expect(page.getByRole("button", { name: "Delete Morning" })).toHaveCount(0);
});

test("a Macro typed inline runs when its asked arguments are complete and opens its asked form pre-filled when not (#242)", async ({ page, isMobile }) => {
  test.skip(isMobile, "the palette is not opened on a phone");
  const stamp = Date.now();
  await page.goto("/settings/macros");
  await workLocally(page);
  await page.evaluate(async (coreUrl) => {
    const core = await import(/* @vite-ignore */ coreUrl);
    await core.saveMacro({ name: "Taskette", steps: [{ command: "tasks/tasks.add", args: { title: { from: "asked" } } }] });
    await core.saveMacro({ name: "Errand", steps: [{ command: "tasks/tasks.add", args: { title: { from: "asked" } } }, { command: "shopping/shopping.add", args: { title: { from: "asked" } } }] });
  }, CORE_URL);

  await page.keyboard.press("Control+k");
  const input = page.getByRole("combobox");
  await input.fill(`!taskette Call mum ${stamp}`);
  await expect(page.getByTestId("inline-preview")).toContainText("Taskette");
  await page.keyboard.press("Enter");
  const report = page.getByRole("dialog", { name: "Taskette" });
  await expect(report.getByRole("list", { name: "Steps" }).getByRole("listitem")).toHaveCount(1);
  await expect(report).toContainText("Done");
  await report.getByRole("button", { name: "Close", exact: true }).first().click();

  await page.keyboard.press("Control+k");
  await input.fill(`!errand Pick up ${stamp}`);
  await expect(page.getByTestId("inline-preview")).toContainText("Missing");
  await page.keyboard.press("Enter");
  const form = page.getByRole("dialog", { name: "Errand" });
  await expect(form.getByLabel("Title (required)")).toHaveValue(`Pick up ${stamp}`);
  await form.getByLabel("Thing (required)").fill(`Oat milk ${stamp}`);
  await form.getByRole("button", { name: "Run" }).click();
  await expect(page.getByRole("dialog", { name: "Errand" }).getByRole("list", { name: "Steps" }).getByRole("listitem")).toHaveCount(2);

  const titles = await page.evaluate(async (coreUrl) => {
    const core = await import(/* @vite-ignore */ coreUrl);
    return (await core.documentsOf("task")).map((d: { title: string }) => d.title);
  }, CORE_URL);
  expect(titles).toEqual(expect.arrayContaining([`Call mum ${stamp}`, `Pick up ${stamp}`]));
});

test("a broken Macro is marked in Settings with why, and refuses to start", async ({ page, isMobile }) => {
  await page.goto("/settings/macros");
  await workLocally(page);
  await page.evaluate(async (coreUrl) => {
    const core = await import(/* @vite-ignore */ coreUrl);
    await core.saveMacro({ name: "Half gone", steps: [{ command: "tasks/tasks.add", args: { title: { from: "fixed", value: "Never written either" } } }, { command: "gone/away", args: {} }] });
  }, CORE_URL);
  const row = page.getByRole("list", { name: "Macros" }).getByRole("listitem").filter({ hasText: "Half gone" });
  await expect(row).toContainText("Broken");
  await expect(row.getByRole("list", { name: "Why Half gone is broken" })).toContainText("Step 2: “gone/away” no longer exists");

  test.skip(isMobile, "the palette is not opened on a phone");
  await runFromPalette(page, "Half gone");
  const report = page.getByRole("dialog", { name: "Half gone" });
  await expect(report).toContainText("Broken, so nothing was run");
  await expect(report.getByRole("list", { name: "Why it is broken" })).toContainText("“gone/away” no longer exists");
  const titles = await page.evaluate(async (coreUrl) => {
    const core = await import(/* @vite-ignore */ coreUrl);
    return (await core.documentsOf("task")).map((d: { title: string }) => d.title);
  }, CORE_URL);
  expect(titles).not.toContain("Never written either");
});
