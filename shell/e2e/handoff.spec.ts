import { test, expect, type Page } from "@playwright/test";
import { encodeHandoff, HANDOFF_DONE_PATH, type Handoff } from "@lifeline/handoff";
import { CORE_URL } from "./support/seed";

/**
 * The Handoff page (ADR 0080): a Handoff made outside Lifeline arrives in the
 * fragment, opens the Intake it names prefilled, and nothing is written until
 * that dialog saves.
 */

/** A fresh store greets with "You're signed out" over the page; working locally is enough here. */
async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

async function tasksTitled(page: Page, title: string): Promise<number> {
  return page.evaluate(
    async ({ coreUrl, title }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      return ((await core.documentsOf("task")) as { title: string }[]).filter((d) => d.title === title).length;
    },
    { coreUrl: CORE_URL, title },
  );
}

test("a Handoff naming an Intake opens its dialog prefilled, and saves", async ({ page }) => {
  const title = `Pick up the parcel ${Date.now()}`;
  const handoff: Handoff = { title, text: "Your parcel is waiting at the post office.", url: "https://example.com/parcel/123", author: "The Post" };
  await page.goto(`/handoff#${encodeHandoff(handoff, "tasks/task")}`);
  await workLocally(page);

  const dialog = page.getByRole("dialog", { name: "New task" });
  await expect(dialog.getByLabel("Title")).toHaveValue(title);
  await expect(dialog.getByLabel("Notes")).toHaveValue("https://example.com/parcel/123\nFrom The Post");
  expect(await tasksTitled(page, title), "nothing is written before the dialog saves").toBe(0);

  await dialog.getByRole("button", { name: "Add task" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await expect(page).toHaveURL((u) => u.pathname === HANDOFF_DONE_PATH && !u.hash);
  expect(await tasksTitled(page, title)).toBe(1);
});

test("a cancelled dialog writes nothing and returns to the picker", async ({ page }) => {
  const title = `Not this one ${Date.now()}`;
  await page.goto(`/handoff#${encodeHandoff({ title, text: "" }, "tasks/task")}`);
  await workLocally(page);
  const dialog = page.getByRole("dialog", { name: "New task" });
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("Nothing was saved")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Intake" })).toHaveText("Task");
  await page.getByRole("button", { name: "Open the Task" }).click();
  await expect(dialog.getByLabel("Title")).toHaveValue(title);
  expect(await tasksTitled(page, title)).toBe(0);
});

/** Picks an Intake in the Handoff page's picker (a Select, on the desk and on a phone). */
async function pickIntake(page: Page, title: string) {
  await page.getByRole("combobox", { name: "Intake" }).click();
  await page.getByRole("option", { name: title, exact: true }).click();
}

test("a Handoff naming no Intake asks which one, then opens its dialog — and the choice is remembered", async ({ page }) => {
  const title = `Read this later ${Date.now()}`;
  await page.goto(`/handoff#${encodeHandoff({ title, text: "", url: "https://example.com/later" })}`);
  await workLocally(page);
  await expect(page.getByRole("dialog")).toHaveCount(0);

  const expected = await page.evaluate(async (coreUrl) => {
    const core = await import(/* @vite-ignore */ coreUrl);
    return { intakes: (core.allIntakes() as { title: string }[]).map((i) => i.title), workspaces: (await core.allWorkspaces()).length };
  }, CORE_URL);
  await page.getByRole("combobox", { name: "Intake" }).click();
  await expect(page.getByRole("option")).toHaveText(expected.intakes);
  await page.getByRole("option", { name: "Task", exact: true }).click();
  // The seeded store has one Workspace: no Workspace question.
  expect(expected.workspaces).toBe(1);
  await expect(page.getByRole("combobox", { name: "Workspace" })).toHaveCount(0);

  await page.getByRole("button", { name: "Open the Task" }).click();
  const dialog = page.getByRole("dialog", { name: "New task" });
  await expect(dialog.getByLabel("Title")).toHaveValue(title);
  await dialog.getByRole("button", { name: "Cancel" }).click();

  // Next time from outside Lifeline, Task is preselected.
  await page.goto(`/handoff#${encodeHandoff({ title: "Another", text: "" })}`);
  await workLocally(page);
  await expect(page.getByRole("combobox", { name: "Intake" })).toHaveText("Task");
});

test("a Handoff naming an Intake that no longer exists falls back to the picker", async ({ page }) => {
  await page.goto(`/handoff#${encodeHandoff({ title: "From an old extension", text: "" }, "mail/thread")}`);
  await workLocally(page);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await pickIntake(page, "Quote");
  await page.getByRole("button", { name: "Open the Quote" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("with two Workspaces, a Document lands in the one chosen", async ({ page }) => {
  await page.goto("/");
  await workLocally(page);
  const work = await page.evaluate(async (coreUrl) => {
    const core = await import(/* @vite-ignore */ coreUrl);
    const home = (await core.allWorkspaces())[0];
    const ws = await core.createWorkspace(`Work ${Date.now()}`, []);
    core.setCurrentWorkspace(home.id);
    return { id: ws.id as string, name: ws.name as string, home: home.name as string };
  }, CORE_URL);

  const title = `A work task ${Date.now()}`;
  await page.goto(`/handoff#${encodeHandoff({ title, text: "" }, "tasks/task")}`);
  await workLocally(page);
  const choice = page.getByRole("combobox", { name: "Workspace" });
  await expect(choice).toHaveText(work.home);
  await choice.click();
  await page.getByRole("option", { name: work.name }).click();
  await page.getByRole("button", { name: "Open the Task" }).click();

  const dialog = page.getByRole("dialog", { name: "New task" });
  await expect(dialog.getByLabel("Title")).toHaveValue(title);
  await dialog.getByRole("button", { name: "Add task" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  const held = await page.evaluate(
    async ({ coreUrl, ws, title }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      return { current: core.currentWorkspaceId(), held: ((await core.documentsHeldBy(ws)) as { title: string }[]).filter((d) => d.title === title).length };
    },
    { coreUrl: CORE_URL, ws: work.id, title },
  );
  expect(held).toEqual({ current: work.id, held: 1 });
});

test("a malformed Handoff shows a plain message", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/handoff#v1.not-a-handoff");
  await workLocally(page);
  await expect(page.getByText("This Handoff can't be read")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(errors).toEqual([]);
});
