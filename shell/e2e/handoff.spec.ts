import { test, expect, type Page } from "@playwright/test";
import { encodeHandoff, HANDOFF_DONE_PATH, type Handoff } from "@lifeline/handoff";
import { CORE_URL } from "./support/seed";

/**
 * The Handoff page (ADR 0080): a Handoff made outside Lifeline arrives in the
 * fragment, opens the Intake it names prefilled, and nothing is written until
 * that dialog saves.
 */

/** A fresh store is signed out, so the Handoff page asks for sign-in first; working locally is enough here. */
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

/**
 * Stands in for PocketBase (VITE_PB_URL, by default 127.0.0.1:8090): any password
 * signs in as one Account, and the sync that follows pulls an empty server.
 */
async function fakeServer(page: Page, email: string) {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const token = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ id: "e2euser", type: "auth", exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
  await page.route(/^http:\/\/127\.0\.0\.1:8090\//, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/auth-with-password")) {
      return route.fulfill({
        json: { token, record: { id: "e2euser", email, collectionId: "_pb_users_auth_", collectionName: "users" } },
      });
    }
    if (route.request().method() === "GET" && url.pathname.endsWith("/records")) {
      return route.fulfill({ json: { page: 1, perPage: 200, totalItems: 0, totalPages: 0, items: [] } });
    }
    return route.abort();
  });
}

test("signed out, the page signs in and then opens the named Intake prefilled", async ({ page }) => {
  await fakeServer(page, "e2e@example.com");
  const title = `Read this later ${Date.now()}`;
  await page.goto(`/handoff#${encodeHandoff({ title, text: "", url: "https://example.com/a" }, "tasks/task")}`);

  // Sign-in stands where the Intake step would be — the Intake's dialog waits for it.
  await expect(page.getByRole("heading", { name: "Sign in to keep this" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByLabel("Email").fill("e2e@example.com");
  await page.getByLabel("Password").fill("secret");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "New task" });
  await expect(dialog.getByLabel("Title")).toHaveValue(title);
  await expect(dialog.getByLabel("Notes")).toHaveValue("https://example.com/a");
});

test("a pending Handoff outlives a reload of the tab, and is gone once used", async ({ page }) => {
  await fakeServer(page, "e2e@example.com");
  const title = `Kept across a reload ${Date.now()}`;
  await page.goto(`/handoff#${encodeHandoff({ title, text: "" }, "tasks/task")}`);
  await expect(page.getByRole("heading", { name: "Sign in to keep this" })).toBeVisible();
  // The Handoff leaves the address once read; this tab keeps it until it is used.
  await expect(page).toHaveURL((u) => u.pathname === "/handoff" && !u.hash);
  await page.reload();

  await page.getByLabel("Email").fill("e2e@example.com");
  await page.getByLabel("Password").fill("secret");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "New task" });
  await expect(dialog.getByLabel("Title")).toHaveValue(title);
  await dialog.getByRole("button", { name: "Add task" }).click();
  await expect(page).toHaveURL((u) => u.pathname === HANDOFF_DONE_PATH);

  await page.goto("/handoff");
  await expect(page.getByText("This Handoff can't be read")).toBeVisible();
});

test("a Handoff left for another page is not picked up again", async ({ page }) => {
  const title = `Abandoned ${Date.now()}`;
  await page.goto(`/handoff#${encodeHandoff({ title, text: "" }, "tasks/task")}`);
  await workLocally(page);
  await page.getByRole("dialog", { name: "New task" }).getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("Nothing was saved")).toBeVisible();
  // Leaving the Handoff page within the app abandons the Handoff.
  await page.evaluate(() => {
    history.pushState(null, "", "/settings");
    dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page.getByText("Nothing was saved")).toHaveCount(0);
  await page.goto("/handoff");
  await workLocally(page);
  await expect(page.getByText("This Handoff can't be read")).toBeVisible();
});
