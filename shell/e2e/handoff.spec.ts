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

interface ShareTarget {
  action: string;
  method?: string;
  params: Partial<Record<"title" | "text" | "url", string>>;
}

/**
 * The address Android opens for "Share → Lifeline", built the way the browser
 * builds it from the served manifest's GET share target: its action, each
 * shared field under the parameter name the manifest gives it.
 */
async function shareUrl(page: Page, fields: Partial<Record<"title" | "text" | "url", string>>): Promise<string> {
  const manifest = (await (await page.request.get("/manifest.webmanifest")).json()) as { share_target?: ShareTarget };
  const target = manifest.share_target;
  expect(target, "the manifest declares a share target").toBeTruthy();
  expect(target!.method ?? "GET").toBe("GET");
  const q = new URLSearchParams();
  for (const [field, value] of Object.entries(fields)) {
    const name = target!.params[field as keyof ShareTarget["params"]];
    expect(name, `the share target takes ${field}`).toBeTruthy();
    q.set(name!, value);
  }
  return `${target!.action}?${q}`;
}

test("the share sheet's fields prefill the Intake — a URL in the text becomes the origin, its host the title", async ({ page }) => {
  const passage = `Worth reading ${Date.now()}`;
  await page.goto(await shareUrl(page, { text: `${passage} https://essays.example.org/on-keeping?ref=share — a long passage` }));
  await workLocally(page);
  await expect(page.getByRole("heading", { name: "essays.example.org" })).toBeVisible();
  await pickIntake(page, "Quote");
  await page.getByRole("button", { name: "Open the Quote" }).click();

  const dialog = page.getByRole("dialog", { name: "Keep as a Quote" });
  await expect(dialog.getByLabel("Link")).toHaveValue("https://essays.example.org/on-keeping?ref=share");
  await expect(dialog.getByLabel("Headline")).toHaveValue("essays.example.org");
  await expect(dialog.getByLabel("Text")).toHaveValue(`${passage} — a long passage`);
  await dialog.getByRole("button", { name: "Keep", exact: true }).click();

  // From the share sheet there is no extension window to close: it offers to open what was made.
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await expect(page).toHaveURL((u) => u.pathname === "/handoff");
  await page.getByRole("button", { name: "Open the Quote" }).click();
  await expect(page).toHaveURL((u) => !u.pathname.startsWith("/handoff"));
  await expect(page.getByText(`${passage} — a long passage`).first()).toBeVisible();
});

test("from the share sheet, a saved Handoff offers to go back", async ({ page }) => {
  await page.goto("/");
  await workLocally(page);
  const before = new URL(page.url()).pathname;
  const title = `Shared task ${Date.now()}`;
  await page.goto(await shareUrl(page, { title, text: "Look at this", url: "https://example.com/shared" }));
  await workLocally(page);
  await pickIntake(page, "Task");
  await page.getByRole("button", { name: "Open the Task" }).click();
  const dialog = page.getByRole("dialog", { name: "New task" });
  await expect(dialog.getByLabel("Title")).toHaveValue(title);
  await expect(dialog.getByLabel("Notes")).toHaveValue("https://example.com/shared");
  await dialog.getByRole("button", { name: "Add task" }).click();

  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Go back" }).click();
  await expect(page).toHaveURL((u) => u.pathname === before);
  expect(await tasksTitled(page, title)).toBe(1);
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
