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

test("a cancelled dialog writes nothing and can be opened again", async ({ page }) => {
  const title = `Not this one ${Date.now()}`;
  await page.goto(`/handoff#${encodeHandoff({ title, text: "" }, "tasks/task")}`);
  await workLocally(page);
  const dialog = page.getByRole("dialog", { name: "New task" });
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("Nothing was saved")).toBeVisible();
  await page.getByRole("button", { name: "Open the Task again" }).click();
  await expect(dialog.getByLabel("Title")).toHaveValue(title);
  expect(await tasksTitled(page, title)).toBe(0);
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
