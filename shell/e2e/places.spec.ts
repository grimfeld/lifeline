import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";
import { openPalette } from "./support/palette";

/**
 * Places (ADR 0128): a Place is made from a name alone — from the palette or
 * the phone's capture sheet — kept unique by name, filtered by Kind on the
 * Places screen, linked by name, `place:` prefix or alias, and opened on its
 * page with its backlinks and unlinked mentions.
 */

const PLACE = "atlas_place";

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

type StoredPlace = { id: string; title: string; kind?: string; aliases?: string[]; tags?: string[]; body?: string };

async function placeNamed(page: Page, title: string): Promise<StoredPlace | undefined> {
  const all = await inCore(page, async (core, type: string) => (await core.documentsOf(type)) as never, PLACE);
  return (all as StoredPlace[]).find((p) => p.title === title);
}

/** A Place made in the store, by name; its id. */
async function makePlace(page: Page, title: string, fields: Record<string, unknown> = {}): Promise<string> {
  return inCore(page, async (core, a: { type: string; title: string; fields: Record<string, unknown> }) => (await core.createDocument({ type: a.type, title: a.title, folder: "Places", fields: a.fields })).id as string, { type: PLACE, title, fields });
}

async function openAddPlace(page: Page) {
  await openPalette(page);
  await page.keyboard.type("Add place");
  await page.getByRole("option", { name: /Add place/ }).first().click();
  return page.getByRole("dialog", { name: "Add a place" });
}

test("a Place made from the palette with a Kind is given aliases and Tags in its Peek, and opens on its page", async ({ page }) => {
  await page.goto("/app/places");
  await workLocally(page);
  const dialog = await openAddPlace(page);
  await dialog.getByLabel("Name").fill("Chez Janou");
  await dialog.getByRole("combobox", { name: "Kind" }).click();
  await page.getByRole("option", { name: "Restaurant", exact: true }).click();
  await dialog.getByRole("button", { name: "Add", exact: true }).click();

  const peek = page.getByRole("dialog", { name: "Chez Janou" });
  await expect(peek).toBeVisible();
  await peek.getByLabel("Aliases").fill("Janou");
  await peek.getByLabel("Aliases").press("Enter");
  await peek.getByLabel("Tags").fill("provençal");
  await peek.getByLabel("Tags").press("Enter");
  await expect.poll(() => placeNamed(page, "Chez Janou")).toMatchObject({ kind: "restaurant", aliases: ["Janou"], tags: ["provençal"] });

  await peek.getByRole("button", { name: /^Open in / }).click();
  await expect(page).toHaveURL(/\/app\/places\/place\//);
  await expect(page.getByRole("heading", { level: 1, name: "Chez Janou" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Details" }).getByRole("combobox", { name: "Kind" })).toHaveText("Restaurant");
});

test("a name another Place has is refused, from the palette and by rename, and that Place is offered", async ({ page }) => {
  await page.goto("/app/places");
  await workLocally(page);
  await makePlace(page, "Musée d'Orsay");
  const orsay = (await placeNamed(page, "Musée d'Orsay"))!;

  const dialog = await openAddPlace(page);
  await dialog.getByLabel("Name").fill("musée d'orsay");
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await expect(dialog.getByText("“musée d'orsay” is already a Place: Musée d'Orsay")).toBeVisible();
  await dialog.getByRole("button", { name: "Open Musée d'Orsay", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Musée d'Orsay" })).toBeVisible();
  await page.keyboard.press("Escape");

  // Renamed on its page to the same name: refused, the old name kept, the other Place a link away.
  const id = await makePlace(page, "Orsay");
  await page.goto(`/app/places/place/${id}`);
  await workLocally(page);
  const name = page.getByRole("region", { name: "Details" }).getByLabel("Name");
  await name.fill("Musée d'Orsay");
  await name.press("Enter");
  await expect(page.getByText("“Musée d'Orsay” is already a Place: Musée d'Orsay")).toBeVisible();
  expect(await placeNamed(page, "Orsay")).toBeDefined();
  await page.getByRole("link", { name: "Open Musée d'Orsay", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/app/places/place/${orsay.id}$`));
});

test("the Places screen lists Places A to Z and filters them by Kind, and Kinds are renamed and added", async ({ page }) => {
  await page.goto("/app/places");
  await workLocally(page);
  await makePlace(page, "Zinc Bar", { kind: "bar" });
  await makePlace(page, "Atelier Café", { kind: "cafe" });
  await makePlace(page, "Bar du Port", { kind: "bar" });
  const list = page.getByRole("list", { name: "Places" });
  await expect(list.getByRole("link", { name: /^(Atelier Café|Bar du Port|Zinc Bar)/ })).toHaveText([/^Atelier Café/, /^Bar du Port/, /^Zinc Bar/]);

  // On a phone the Kind is under Filters, whose sheet hides the page until it closes.
  const filters = page.getByRole("button", { name: /^Filters/ });
  const phone = await filters.isVisible();
  if (phone) await filters.click();
  await page.getByRole("combobox", { name: "Kind" }).click();
  await page.getByRole("option", { name: "Bar", exact: true }).click();
  if (phone) await page.keyboard.press("Escape");
  await expect(list.getByRole("link", { name: /^(Atelier Café|Bar du Port|Zinc Bar)/ })).toHaveText([/^Bar du Port/, /^Zinc Bar/]);

  await page.getByRole("button", { name: "Kinds", exact: true }).click();
  const kinds = page.getByRole("dialog", { name: "Kinds" });
  await kinds.getByLabel("Kind 3", { exact: true }).fill("Pub");
  await kinds.getByRole("button", { name: "Add kind" }).click();
  await kinds.getByLabel("Kind 11", { exact: true }).fill("Climbing gym");
  await kinds.getByRole("button", { name: "Save" }).click();
  await expect(kinds).toBeHidden();
  // The renamed Kind keeps its Places, still filtered by it; the new one is offered after the others.
  await expect(list.getByRole("link", { name: /^(Atelier Café|Bar du Port|Zinc Bar)/ })).toHaveText([/^Bar du Port/, /^Zinc Bar/]);
  await expect
    .poll(() => inCore(page, async (core, type: string) => (core.documentType(type)?.fields.find((f: { key: string }) => f.key === "kind")?.options ?? []).map((o: { label: string }) => o.label) as string[], PLACE))
    .toEqual(["Restaurant", "Café", "Pub", "Museum", "Gallery", "Shop", "Mall", "Park", "Venue", "Other", "Climbing gym"]);
});

test("[[Chez Janou]], [[place:Lidl Prado]] and an alias land on Places, whose page lists the Day as a backlink and its prose as an unlinked mention", async ({ page }) => {
  await page.goto("/app/places");
  await workLocally(page);
  const janou = await makePlace(page, "Chez Janou", { aliases: ["Janou"], kind: "restaurant" });
  await makePlace(page, "Lidl Prado", { kind: "shop" });
  await inCore(
    page,
    async (core, days: { title: string; body: string }[]) => {
      for (const d of days) await core.createDocument({ type: "daily", ...d });
    },
    [
      { title: "2001-03-04", body: "Lunch at [[Chez Janou]], then [[place:Lidl Prado]], and coffee at [[Janou]]." },
      { title: "2001-03-05", body: "Chez Janou was full." },
    ],
  );

  await page.goto("/app/journal?d=2001-03-04");
  await workLocally(page);
  await expect(page.locator(".cm-wikilink")).toHaveCount(3);
  await expect(page.locator(".cm-wikilink-unresolved")).toHaveCount(0);

  await page.goto(`/app/places/place/${janou}`);
  await workLocally(page);
  await expect(page.getByText("Backlinks · 2")).toBeVisible();
  await expect(page.getByRole("button", { name: /^2001-03-04/ }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /^2001-03-05/ }).first()).toBeVisible();
  await page.getByRole("textbox", { name: "Notes" }).click();
  await page.keyboard.type("The pastis bar upstairs.");
  await expect.poll(async () => (await placeNamed(page, "Chez Janou"))?.body).toBe("The pastis bar upstairs.");
});

test("the phone's capture sheet offers Add place", { tag: "@phone" }, async ({ page }) => {
  await page.goto("/app/places");
  await workLocally(page);
  await page.getByRole("button", { name: "Capture" }).click();
  await page.getByRole("dialog", { name: "Capture" }).getByRole("button", { name: /Add place/ }).click();

  const dialog = page.getByRole("dialog", { name: "Add a place" });
  await dialog.getByLabel("Name").fill("Lidl Jean Jaurès");
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await expect.poll(() => placeNamed(page, "Lidl Jean Jaurès")).toMatchObject({ kind: "" });
});

test("a Place's page shows when it was last visited, Mentioned beside it, and its upcoming Events above Today", async ({ page }) => {
  await page.goto("/app/places");
  await workLocally(page);
  const id = await makePlace(page, "Chez Janou");
  const days = await inCore(
    page,
    async (core, at: string) => {
      const today = core.todayStr();
      const day = (n: number) => core.addDays(today, n);
      // Two Events on one day count one visit; a two-day weekend counts two; next week's booking none.
      await core.createDocument({ type: "event", title: "Lunch", fields: { date: day(-5), at } });
      await core.createDocument({ type: "event", title: "Drinks", fields: { date: day(-5), notes: "after, [[Chez Janou]]" } });
      await core.createDocument({ type: "event", title: "Weekend", fields: { date: day(-12), endDate: day(-11), at } });
      await core.createDocument({ type: "event", title: "Booked dinner", fields: { date: day(7), at } });
      await core.createDocument({ type: "daily", title: day(-2), body: "Still thinking of [[Chez Janou]]." });
      return { last: core.formatHuman(day(-5)) as string };
    },
    id,
  );
  await page.goto(`/app/places/place/${id}`);
  await workLocally(page);
  await expect(page.getByText(`Last visited ${days.last} · 3 visits`)).toBeVisible();
  const reports = page.getByRole("region", { name: "Reports" });
  await expect(reports.getByText("Last visited", { exact: true })).toBeVisible();
  await expect(reports.getByText("Visits", { exact: true })).toBeVisible();
  await expect(reports.getByText(/in all/)).toHaveText(/3 in all/);
  await expect(reports.getByText("Last mentioned", { exact: true })).toBeVisible();

  const timeline = page.getByRole("region", { name: "Timeline" });
  await expect(timeline.getByRole("button", { name: /Booked dinner/ })).toBeVisible();
  // Each stop in reading order: an entry by its title, the Today line by its name.
  const order = await timeline.locator("li").evaluateAll((els) =>
    els.flatMap((el) => (el.getAttribute("aria-label") === "Today" ? ["Today"] : el.querySelector(":scope > button") ? [el.querySelector(":scope > button > span")?.textContent ?? ""] : [])),
  );
  expect(order).toEqual(["Booked dinner", "Today", expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), "Drinks", "Lunch", "Weekend"]);
});
