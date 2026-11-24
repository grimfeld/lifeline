import { expect, type Page } from "@playwright/test";
import { test } from "./support/test";
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

test("a Handoff naming an Intake opens its dialog prefilled, writes nothing when cancelled, and saves", async ({ page }) => {
  const title = `Pick up the parcel ${Date.now()}`;
  const handoff: Handoff = { title, text: "Your parcel is waiting at the post office.", url: "https://example.com/parcel/123", author: "The Post" };
  await page.goto(`/handoff#${encodeHandoff(handoff, "tasks/task")}`);
  await workLocally(page);

  const dialog = page.getByRole("dialog", { name: "New task" });
  await expect(dialog.getByLabel("Title")).toHaveValue(title);
  await expect(dialog.getByLabel("Notes")).toHaveValue("https://example.com/parcel/123\nFrom The Post");

  // Cancelled, it writes nothing and returns to the picker, which opens it again.
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("Nothing was saved")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Intake" })).toHaveText("Task");
  expect(await tasksTitled(page, title), "nothing is written before the dialog saves").toBe(0);
  await page.getByRole("button", { name: "Open the Task" }).click();
  await expect(dialog.getByLabel("Title")).toHaveValue(title);

  await dialog.getByRole("button", { name: "Add task" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await expect(page).toHaveURL((u) => u.pathname === HANDOFF_DONE_PATH && !u.hash);
  expect(await tasksTitled(page, title)).toBe(1);

  // A Need already on the list makes nothing new, but the Handoff is kept all the same.
  const need = `Oat milk ${Date.now()}`;
  for (let i = 0; i < 2; i++) {
    await page.goto(`/handoff#${encodeHandoff({ title: need, text: "" }, "shopping/need")}`);
    await workLocally(page);
    const add = page.getByRole("dialog", { name: "Add to the shopping list" });
    await expect(add.getByLabel("Need")).toHaveValue(need);
    await add.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    await expect(page).toHaveURL((u) => u.pathname === HANDOFF_DONE_PATH);
  }
});

test("Facts kept with “Save & add another” from a Handoff are Saved when the dialog closes", async ({ page }) => {
  await page.goto(`/handoff#${encodeHandoff({ title: "On treaties", text: "The Peace of Westphalia was signed in 1648." }, "languages/fact")}`);
  await workLocally(page);
  const dialog = page.getByRole("dialog", { name: "New fact" });
  await dialog.getByLabel("Question").fill(`When was the Peace of Westphalia? ${Date.now()}`);
  await dialog.getByLabel("Answer").fill("1648");
  await dialog.getByRole("button", { name: "Save & add another" }).click();
  await expect(dialog.getByLabel("Question")).toHaveValue("");
  await page.keyboard.press("Escape");
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await expect(page).toHaveURL((u) => u.pathname === HANDOFF_DONE_PATH);
});

/** Picks an Intake in the Handoff page's picker (a Select, on the desk and on a phone). */
async function pickIntake(page: Page, title: string) {
  await page.getByRole("combobox", { name: "Intake" }).click();
  await page.getByRole("option", { name: title, exact: true }).click();
}

test("a Handoff naming no Intake, or one that no longer exists, asks which one, then opens its dialog — and the choice is remembered", async ({ page }) => {
  const title = `Read this later ${Date.now()}`;
  await page.goto(`/handoff#${encodeHandoff({ title, text: "", url: "https://example.com/later" })}`);
  await workLocally(page);
  await expect(page.getByRole("dialog")).toHaveCount(0);

  const expected = await page.evaluate(async (coreUrl) => {
    const core = await import(/* @vite-ignore */ coreUrl);
    // Every App's Intake and Core's for each user-defined type, grouped by Module as the Selection menu is.
    const intakes = [...core.allIntakes(), ...core.typeIntakesOf(core.allDocumentTypes())];
    const groups = core.groupIntakes(intakes, { moduleOf: (id: string) => core.appById(id)?.module, appTitle: (id: string) => core.appById(id)?.title }) as { intakes: { title: string }[] }[];
    return { intakes: groups.flatMap((g) => g.intakes.map((i) => i.title)), workspaces: (await core.allWorkspaces()).length };
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

  // Next time from outside Lifeline, Task is preselected — even for a Handoff naming an Intake that no longer exists.
  await page.goto(`/handoff#${encodeHandoff({ title: "From an old extension", text: "" }, "mail/thread")}`);
  await workLocally(page);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Intake" })).toHaveText("Task");
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

test("signing in as another Account, once the switch is confirmed, carries on with the same Handoff", async ({ page }) => {
  await fakeServer(page, "e2e@example.com");
  await page.goto("/");
  await workLocally(page);
  // This device holds another Account's data, all of it synced.
  await page.evaluate(async (coreUrl) => {
    const core = await import(/* @vite-ignore */ coreUrl);
    await core.db()._outbox.clear();
    await core.db()._meta.bulkPut([
      { key: "account", value: "someone-else" },
      { key: "accountEmail", value: "else@example.com" },
    ]);
  }, CORE_URL);

  const title = `After the switch ${Date.now()}`;
  await page.goto(`/handoff#${encodeHandoff({ title, text: "" }, "tasks/task")}`);
  await page.getByLabel("Email").fill("e2e@example.com");
  await page.getByLabel("Password").fill("secret");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  const confirm = page.getByRole("dialog", { name: "Switch account?" });
  await confirm.getByRole("button", { name: "Erase and switch" }).click();
  const dialog = page.getByRole("dialog", { name: "New task" });
  await expect(dialog.getByLabel("Title")).toHaveValue(title);
});

test("a pending Handoff outlives a reload of the tab, and is gone once used or left for another page", async ({ page }) => {
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

  // Another, left for another page within the app, is abandoned too. (From elsewhere: a hash change alone is no new Handoff.)
  await page.goto("/settings");
  await page.goto(`/handoff#${encodeHandoff({ title: `Abandoned ${Date.now()}`, text: "" }, "tasks/task")}`);
  await page.getByRole("dialog", { name: "New task" }).getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("Nothing was saved")).toBeVisible();
  // Leaving the Handoff page within the app abandons the Handoff.
  await page.evaluate(() => {
    history.pushState(null, "", "/settings");
    dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page.getByText("Nothing was saved")).toHaveCount(0);
  await page.goto("/handoff");
  await expect(page.getByText("This Handoff can't be read")).toBeVisible();
});

/** Makes a user-defined type in this store (homed in `module`, or none) and waits until Core knows it. */
async function makeType(page: Page, type: { typeId: string; label: string; module?: string; fields?: { key: string; label: string; kind: string }[] }) {
  await page.goto("/");
  await workLocally(page);
  await page.evaluate(
    async ({ coreUrl, type }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      await core.saveDocumentType({ fields: [], module: "", ...type, icon: "map-pin", folder: "", body: "optional", linkable: true, order: 0 });
      for (let i = 0; i < 40 && !core.documentTypeSync(type.typeId); i++) await new Promise((r) => setTimeout(r, 50));
    },
    { coreUrl: CORE_URL, type },
  );
}

async function documentsOf(page: Page, type: string): Promise<Record<string, unknown>[]> {
  return page.evaluate(async ({ coreUrl, type }) => (await import(/* @vite-ignore */ coreUrl)).documentsOf(type), { coreUrl: CORE_URL, type });
}

test("a URL Handoff becomes a Place, its URL kept in the Place's url Field — or, for a type with no url Field, in the body", async ({ page }) => {
  const stamp = Date.now();
  const placeType = `place${stamp}`;
  const recipeType = `recipe${stamp}`;
  await makeType(page, { typeId: placeType, label: "Places", module: "journal", fields: [{ key: "website", label: "Website", kind: "url" }] });
  await makeType(page, { typeId: recipeType, label: "Recipes" });
  const title = `Chez Panisse ${stamp}`;
  const url = "https://www.chezpanisse.example.com/";
  await page.goto(`/handoff#${encodeHandoff({ title, text: "", url })}`);
  await workLocally(page);

  // Core's generic Intake sits under the type's Home Module, as in the Selection menu.
  await page.getByRole("combobox", { name: "Intake" }).click();
  await expect(page.getByRole("group", { name: "Journal" }).getByRole("option", { name: "Place", exact: true })).toBeVisible();
  await page.getByRole("option", { name: "Place", exact: true }).click();
  await page.getByRole("button", { name: "Open the Place" }).click();

  const dialog = page.getByRole("dialog", { name: "New place" });
  await expect(dialog.getByLabel("Title")).toHaveValue(title);
  expect(await documentsOf(page, placeType), "nothing is written before the dialog saves").toEqual([]);
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  const places = await documentsOf(page, placeType);
  expect(places.map((d) => ({ title: d.title, website: d.website }))).toEqual([{ title, website: url }]);

  // A type homed in no Module sits under Other; with no url Field, the URL is the body.
  const recipe = `Tarte Tatin ${stamp}`;
  const recipeUrl = "https://recipes.example.org/tarte-tatin";
  await page.goto("/"); // from elsewhere: a hash change alone is no new Handoff
  await page.goto(`/handoff#${encodeHandoff({ title: recipe, text: "", url: recipeUrl })}`);
  await workLocally(page);
  await page.getByRole("combobox", { name: "Intake" }).click();
  await page.getByRole("group", { name: "Other" }).getByRole("option", { name: "Recipe", exact: true }).click();
  await page.getByRole("button", { name: "Open the Recipe" }).click();
  const recipeDialog = page.getByRole("dialog", { name: "New recipe" });
  await expect(recipeDialog.getByLabel("Title")).toHaveValue(recipe);
  await recipeDialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  const recipes = await documentsOf(page, recipeType);
  expect(recipes.map((d) => ({ title: d.title, body: d.body }))).toEqual([{ title: recipe, body: recipeUrl }]);
});
