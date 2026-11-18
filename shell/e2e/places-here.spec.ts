import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";

/**
 * Here (#501, ADR 0128, ADR 0120): on the Place form, a tap reads the device's
 * position once and asks Photon (stubbed here) for the places around it; a pick
 * fills the name, address and coordinates, and Just here keeps the position as
 * the coordinates of the name typed. The position is kept nowhere else. A refusal
 * says to type the name; with no geolocation at all there is no Here.
 */

const PLACE = "atlas_place";
const HERE = { latitude: 48.85561, longitude: 2.36549 };

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

/** Photon's reverse lookup answers with a street and a restaurant; every other outside request is refused. Records what was asked. */
async function stubPhoton(page: Page) {
  const asked: URL[] = [];
  await page.route(/^https:\/\/(?!localhost)/, (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "photon.komoot.io" && url.pathname === "/reverse") {
      asked.push(url);
      const street = { geometry: { coordinates: [2.3654, 48.8557] }, properties: { osm_key: "highway", name: "Rue Roger Verlomme", postcode: "75003", city: "Paris", country: "France" } };
      const janou = { geometry: { coordinates: [2.3655, 48.8556] }, properties: { osm_key: "amenity", osm_value: "restaurant", name: "Chez Janou", housenumber: "2", street: "Rue Roger Verlomme", postcode: "75003", city: "Paris", country: "France" } };
      return route.fulfill({ json: { features: [street, janou] } });
    }
    return route.abort();
  });
  return asked;
}

type StoredPlace = { id: string; title: string; address?: string; geo?: [number, number] | null };

async function placeNamed(page: Page, title: string): Promise<StoredPlace | undefined> {
  const all = await inCore(page, async (core, type: string) => (await core.documentsOf(type)) as never, PLACE);
  return (all as StoredPlace[]).find((p) => p.title === title);
}

async function openAddPlace(page: Page) {
  await page.goto("/app/places");
  await workLocally(page);
  await page.getByRole("button", { name: "Add place", exact: true }).click();
  return page.getByRole("dialog", { name: "Add a place" });
}

/** Everything the page keeps: every Document, localStorage and sessionStorage, as one string. */
async function everythingKept(page: Page): Promise<string> {
  const docs = await inCore(page, async (core) => JSON.stringify(await core.documentsTable().toArray()), null);
  const storage = await page.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }]));
  return docs + storage;
}

test.describe("with the position granted", () => {
  test.use({ geolocation: HERE, permissions: ["geolocation"] });

  test("Here lists the places around me; a pick fills the name, address and coordinates, and the position is kept nowhere", async ({ page }) => {
    const logged: string[] = [];
    page.on("console", (m) => logged.push(m.text()));
    const asked = await stubPhoton(page);
    const dialog = await openAddPlace(page);
    await dialog.getByRole("button", { name: "Here" }).click();

    const nearby = dialog.getByRole("group", { name: "Places here" });
    // A street is no place to pick: only the restaurant is offered.
    await expect(nearby.getByRole("button", { name: /Rue Roger Verlomme, 75003/ })).toHaveCount(1);
    await nearby.getByRole("button", { name: /^Chez Janou/ }).click();
    await expect(dialog.getByLabel("Name")).toHaveValue("Chez Janou");
    await expect(dialog.getByLabel("Address")).toHaveValue("2 Rue Roger Verlomme, 75003 Paris, France");
    await expect(dialog.getByText("On the map at 48.8556, 2.3655")).toBeVisible();
    await expect(nearby).toBeHidden();

    // The position went to Photon, once.
    expect(asked.map((u) => [u.searchParams.get("lat"), u.searchParams.get("lon")])).toEqual([["48.85561", "2.36549"]]);

    await dialog.getByRole("button", { name: "Add", exact: true }).click();
    await expect.poll(() => placeNamed(page, "Chez Janou")).toMatchObject({ address: "2 Rue Roger Verlomme, 75003 Paris, France", geo: [48.8556, 2.3655] });

    // Only the picked place's coordinates are kept; the position itself is stored and logged nowhere.
    const kept = await everythingKept(page);
    expect(kept).toContain("48.8556");
    expect(kept).not.toContain("48.85561");
    expect(kept).not.toContain("2.36549");
    expect(logged.join("\n")).not.toMatch(/48\.8556|2\.3654/);
  });

  test("Just here keeps the position as the coordinates of the name I type", async ({ page }) => {
    await stubPhoton(page);
    const dialog = await openAddPlace(page);
    await dialog.getByLabel("Name").fill("The viewpoint");
    await dialog.getByRole("button", { name: "Here" }).click();
    await dialog.getByRole("group", { name: "Places here" }).getByRole("button", { name: "Just here" }).click();
    await expect(dialog.getByLabel("Name")).toHaveValue("The viewpoint");
    await expect(dialog.getByText("On the map at 48.8556, 2.3655")).toBeVisible();
    await dialog.getByRole("button", { name: "Add", exact: true }).click();
    await expect.poll(() => placeNamed(page, "The viewpoint")).toMatchObject({ address: "", geo: [48.85561, 2.36549] });
  });
});

test.describe("with the position refused", () => {
  test.use({ permissions: [] });

  test("Here says to type the name instead, and asks Photon nothing", async ({ page, context }) => {
    await context.clearPermissions();
    const asked = await stubPhoton(page);
    const dialog = await openAddPlace(page);
    await dialog.getByRole("button", { name: "Here" }).click();
    await expect(dialog.getByRole("alert")).toHaveText(/type its name instead/);
    await expect(dialog.getByRole("group", { name: "Places here" })).toHaveCount(0);
    expect(asked).toHaveLength(0);
  });
});

test("with no geolocation in the browser, there is no Here", async ({ page }) => {
  await page.addInitScript(() => {
    delete (Navigator.prototype as { geolocation?: unknown }).geolocation;
  });
  await stubPhoton(page);
  const dialog = await openAddPlace(page);
  await expect(dialog.getByLabel("Name")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Here" })).toHaveCount(0);
});
// timing run for #633; not to merge
