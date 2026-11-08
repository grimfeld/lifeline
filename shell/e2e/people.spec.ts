import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";
import { openPalette } from "./support/palette";
import { selectText } from "./support/selection";

/**
 * People (ADR 0113): a Person is made from a name alone — from the palette,
 * the phone's capture sheet or a name selected in a Day — linked by name or
 * alias, peeked from a link, and opened on their page from the Peek.
 */

const PERSON = "contacts_person";

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

/** The stored People, by name. */
async function people(page: Page): Promise<{ id: string; title: string; aliases?: string[]; relationship?: string; tags?: string[] }[]> {
  return inCore(page, async (core, type: string) => (await core.documentsOf(type)) as never, PERSON);
}

async function personNamed(page: Page, title: string) {
  return (await people(page)).find((p) => p.title === title);
}

/** A Day reading `body`, opened in the Journal; its id. */
async function openDay(page: Page, date: string, body: string): Promise<string> {
  await page.goto("/app/journal");
  await workLocally(page);
  const id = await inCore(page, async (core, a: { date: string; body: string }) => (await core.createDocument({ type: "daily", title: a.date, body: a.body })).id as string, { date, body });
  await page.goto(`/app/journal?d=${date}`);
  await workLocally(page);
  await expect(page.locator(".cm-content")).toContainText(body);
  return id;
}

test("a Person made from the palette is given aliases, a Relationship and Tags in their Peek, and opens on their page", async ({ page }) => {
  await page.goto("/app/people");
  await workLocally(page);
  await openPalette(page);
  await page.keyboard.type("Add person");
  await page.getByRole("option", { name: /Add person/ }).first().click();

  const dialog = page.getByRole("dialog", { name: "Add a person" });
  await dialog.getByLabel("Name").fill("Anne Dupont");
  await dialog.getByRole("button", { name: "Add" }).click();

  // The new Person opens in a Peek where the user is.
  const peek = page.getByRole("dialog", { name: "Anne Dupont" });
  await expect(peek).toBeVisible();
  await peek.getByLabel("Aliases").fill("Mum");
  await peek.getByLabel("Aliases").press("Enter");
  await peek.getByLabel("Relationship").fill("my mother");
  await peek.getByLabel("Relationship").press("Enter");
  await peek.getByLabel("Tags").fill("family");
  await peek.getByLabel("Tags").press("Enter");
  await expect.poll(() => personNamed(page, "Anne Dupont")).toMatchObject({ aliases: ["Mum"], relationship: "my mother", tags: ["family"] });

  await peek.getByRole("button", { name: "Open in People" }).click();
  await expect(page).toHaveURL(/\/app\/people\/person\//);
  await expect(page.getByRole("heading", { level: 1, name: "Anne Dupont" })).toBeVisible();
  await expect(page.getByText("my mother · also Mum")).toBeVisible();
});

test("[[Mum]] and [[Anne Dupont]] land on one Person, whose page lists the Day's links as backlinks and whose body is written there", async ({ page }) => {
  await page.goto("/app/people");
  await workLocally(page);
  const id = await inCore(page, async (core, type: string) => (await core.createDocument({ type, title: "Anne Dupont", fields: { aliases: ["Mum"], relationship: "my mother" } })).id as string, PERSON);

  await openDay(page, "2001-02-03", "Lunch with [[Mum]], then [[Anne Dupont]] again.");
  await expect(page.locator(".cm-wikilink")).toHaveCount(2);
  await expect(page.locator(".cm-wikilink-unresolved")).toHaveCount(0);

  await page.goto(`/app/people/person/${id}`);
  await workLocally(page);
  // One backlink for each of the Day's two links, by alias and by name.
  await expect(page.getByRole("heading", { name: "Backlinks · 2" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^2001-02-03 Day/ })).toHaveCount(2);
  await page.getByRole("region", { name: "About them" }).locator(".cm-content").click();
  await page.keyboard.type("Grows tomatoes.");
  await expect.poll(async () => (await personNamed(page, "Anne Dupont")) as { body?: string } | undefined).toMatchObject({ body: "Grows tomatoes." });
});

test("a name selected in a Day becomes a Person under People, and a link to them", async ({ page }) => {
  const dayId = await openDay(page, "2001-02-04", "Met Léa Martin at the market.");
  await selectText(page.locator(".cm-content"), "Léa Martin");
  await page.getByRole("button", { name: "Selection menu" }).click();
  await page.getByRole("dialog", { name: "Selection menu" }).getByRole("group", { name: "People" }).getByRole("option", { name: "Person", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "Add a person" });
  await expect(dialog.getByLabel("Name")).toHaveValue("Léa Martin");
  await dialog.getByRole("button", { name: "Add" }).click();

  await expect.poll(() => personNamed(page, "Léa Martin")).toBeDefined();
  await expect.poll(() => inCore(page, async (core, id: string) => (await core.getDocument(id))?.body, dayId)).toBe("Met [[Léa Martin]] at the market.");
  await expect(page).toHaveURL((u) => u.pathname === "/app/journal");
});

test("the phone's capture sheet offers Add person under People", async ({ page, isMobile }) => {
  test.skip(!isMobile, "the capture sheet is the phone's");
  await page.goto("/app/people");
  await workLocally(page);
  await page.getByRole("button", { name: "Capture" }).click();
  const sheet = page.getByRole("dialog", { name: "Capture" });
  await sheet.getByRole("button", { name: /Add person/ }).click();

  const dialog = page.getByRole("dialog", { name: "Add a person" });
  await dialog.getByLabel("Name").fill("Marc Petit");
  await dialog.getByRole("button", { name: "Add" }).click();
  await expect.poll(() => personNamed(page, "Marc Petit")).toMatchObject({ type: PERSON });
});

test("the People home lists Everyone, searched by name and alias and filtered by Relationship and Tag", async ({ page }) => {
  await page.goto("/app/people");
  await workLocally(page);
  // The seeded store already holds a Person or two; the home lists them with the three made here.
  const everyone = page.getByRole("region", { name: "Everyone" });
  await expect(everyone.getByRole("link").first()).toBeVisible();
  const before = await everyone.getByRole("link").count();

  await inCore(
    page,
    async (core, type: string) => {
      const mk = (title: string, fields: Record<string, unknown>) => core.createDocument({ type, title, fields });
      await mk("Anne Dupont", { aliases: ["Mum-x"], relationship: "kin-x", tags: ["family-x"] });
      await mk("Léa Martin", { relationship: "kin-x", tags: ["family-x", "climbing-x"] });
      await mk("Marc Petit", { relationship: "colleague-x", tags: ["climbing-x"] });
    },
    PERSON,
  );

  await expect(everyone.getByRole("link")).toHaveCount(before + 3);
  await expect(everyone.getByRole("link", { name: /Anne Dupont\s*kin-x/ })).toBeVisible();

  await page.getByLabel("Search people").fill("mum-x");
  await expect(everyone.getByRole("link")).toHaveCount(1);
  await expect(everyone.getByRole("link", { name: /Anne Dupont/ })).toBeVisible();
  await page.getByLabel("Search people").fill("");

  // On a phone the filters are under Filters.
  const pick = async (label: string, option: string) => {
    const filters = page.getByRole("button", { name: /^Filters/ });
    const phone = await filters.isVisible();
    if (phone) await filters.click();
    await page.getByRole("combobox", { name: label }).click();
    await page.getByRole("option", { name: option, exact: true }).click();
    if (phone) await page.keyboard.press("Escape");
  };
  await pick("Relationship", "kin-x");
  await expect(everyone.getByRole("link")).toHaveCount(2);
  await pick("Tag", "climbing-x");
  await expect(everyone.getByRole("link")).toHaveCount(1);
  await expect(everyone.getByRole("link", { name: /Léa Martin/ })).toBeVisible();

  await everyone.getByRole("link", { name: /Léa Martin/ }).click();
  await expect(page).toHaveURL(/\/app\/people\/person\//);
  await expect(page.getByRole("heading", { level: 1, name: "Léa Martin" })).toBeVisible();
});
