import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";

/**
 * A Place's address and the Map (#500, ADR 0128, ADR 0135): typing a Place's name
 * offers real places (Photon, stubbed here), and one pick fills its name,
 * address and coordinates; a typed address is Located (Nominatim, stubbed).
 * The Place then stands on the Map beside People's Addresses, told apart
 * by App, filtered by Kind, and drawing the map looks nothing up.
 */

const PLACE = "atlas_place";

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

/** Photon and Nominatim answer from here; every other outside request (the map tiles) is refused. Counts the lookups made. */
async function stubGeocoders(page: Page) {
  const asked = { photon: 0, nominatim: 0 };
  await page.route(/^https:\/\/(?!localhost)/, (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "photon.komoot.io") {
      asked.photon++;
      const q = url.searchParams.get("q") ?? "";
      const janou = { geometry: { coordinates: [2.3655, 48.8556] }, properties: { osm_key: "amenity", osm_value: "restaurant", name: "Chez Janou", housenumber: "2", street: "Rue Roger Verlomme", postcode: "75003", city: "Paris", country: "France" } };
      return route.fulfill({ json: { features: /jan/i.test(q) ? [janou] : [] } });
    }
    if (url.hostname === "nominatim.openstreetmap.org") {
      asked.nominatim++;
      const hit = url.searchParams.get("q") === "150 Avenue du Prado, Marseille";
      return route.fulfill({ json: hit ? [{ lat: "43.2722", lon: "5.3889", display_name: "150 Avenue du Prado, Marseille" }] : [] });
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

test("a Place added by picking its name from the lookup stands on the Map beside an Address, filtered by Kind", async ({ page }) => {
  const asked = await stubGeocoders(page);
  const dialog = await openAddPlace(page);
  await dialog.getByLabel("Name").fill("chez jan");
  await page.getByRole("option", { name: /Chez Janou/ }).click();
  await expect(dialog.getByLabel("Name")).toHaveValue("Chez Janou");
  await expect(dialog.getByLabel("Address")).toHaveValue("2 Rue Roger Verlomme, 75003 Paris, France");
  await expect(dialog.getByText("On the map at 48.8556, 2.3655")).toBeVisible();
  await dialog.getByRole("combobox", { name: "Kind" }).click();
  await page.getByRole("option", { name: "Restaurant", exact: true }).click();
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await expect.poll(() => placeNamed(page, "Chez Janou")).toMatchObject({ address: "2 Rue Roger Verlomme, 75003 Paris, France", geo: [48.8556, 2.3655] });
  // The pick gave the coordinates: Nominatim was never asked.
  expect(asked.nominatim).toBe(0);

  // A Person with a current Address on the map, beside it.
  await inCore(
    page,
    async (core, type: string) => {
      await core.createDocument({ type, title: "Marc Petit", fields: { aliases: [], relationship: "", addresses: [{ id: "a1", label: "Home", text: "12 Rue Example, Paris", lat: 48.85, lon: 2.35, former: false }] } });
    },
    "contacts_person",
  );

  const before = { ...asked };
  await page.goto("/map");
  await workLocally(page);
  await expect(page.getByRole("button", { name: /^Places 1$/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^People 1$/ })).toBeVisible();
  await expect(page.getByText("2 pins")).toBeVisible();

  // A Kind narrows the Places and leaves the Addresses.
  await page.getByRole("combobox", { name: "Kind" }).click();
  await page.getByRole("option", { name: "Café", exact: true }).click();
  await expect(page.getByText("1 pin", { exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Kind" }).click();
  await page.getByRole("option", { name: "Restaurant", exact: true }).click();
  await expect(page.getByText("2 pins")).toBeVisible();
  // People's chip turns their Addresses off.
  await page.getByRole("button", { name: /^People 1$/ }).click();
  await expect(page.getByText("1 pin", { exact: true })).toBeVisible();

  // Drawing the map looked nothing up.
  expect(asked).toEqual(before);
});

test("a typed address is Located, the Place's page shows its spot, and the Map Surface has its Pin", async ({ page }) => {
  const asked = await stubGeocoders(page);
  const dialog = await openAddPlace(page);
  await dialog.getByLabel("Name").fill("Lidl Prado");
  await dialog.getByLabel("Address").fill("150 Avenue du Prado, Marseille");
  await expect(dialog.getByText(/^Not on the map yet/)).toBeVisible();
  await dialog.getByRole("button", { name: "Locate" }).click();
  await expect(dialog.getByText("On the map at 43.2722, 5.3889")).toBeVisible();
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await expect.poll(() => placeNamed(page, "Lidl Prado")).toMatchObject({ address: "150 Avenue du Prado, Marseille", geo: [43.2722, 5.3889] });
  expect(asked.nominatim).toBe(1);

  const id = (await placeNamed(page, "Lidl Prado"))!.id;
  await page.goto(`/app/places/place/${id}`);
  await workLocally(page);
  await expect(page.getByRole("region", { name: "On the map" })).toBeVisible();

  await page.goto("/map");
  await workLocally(page);
  await expect(page.getByRole("button", { name: /^Places 1$/ })).toBeVisible();
});

test("a Place with no coordinates is no Pin; editing its address finds them", async ({ page }) => {
  await stubGeocoders(page);
  await page.goto("/app/places");
  await workLocally(page);
  const id = await inCore(page, async (core, type: string) => (await core.createDocument({ type, title: "The stall", folder: "Places", fields: { aliases: [], kind: "", address: "Somewhere unknown", geo: null } })).id as string, PLACE);

  await page.goto("/map");
  await workLocally(page);
  await expect(page.getByRole("button", { name: /^Places 0$/ })).toBeVisible();

  await page.goto(`/app/places/place/${id}`);
  await workLocally(page);
  const details = page.getByRole("region", { name: "Details" });
  await expect(details.getByText(/^Not on the map yet/)).toBeVisible();
  await details.getByLabel("Address").fill("150 Avenue du Prado, Marseille");
  await details.getByRole("button", { name: "Save address" }).click();
  await expect(details.getByText("On the map at 43.2722, 5.3889")).toBeVisible();
  await expect(page.getByRole("region", { name: "On the map" })).toBeVisible();

  await page.goto("/map");
  await workLocally(page);
  await expect(page.getByRole("button", { name: /^Places 1$/ })).toBeVisible();
});

test("the map stays where you put it: chips, a Kind and To try leave the Pin you were looking at in place", async ({ page }) => {
  await page.goto("/app/places");
  await workLocally(page);
  await inCore(
    page,
    async (core, type: string) => {
      for (const t of [type, "contacts_person"]) for (const d of await core.documentsOf(t)) await core.removeDocument(d.id);
      const make = (title: string, kind: string, geo: [number, number]) => core.createDocument({ type, title, folder: "Places", fields: { aliases: [], address: "Paris", kind, geo } });
      await make("Chez Janou", "restaurant", [48.8556, 2.3655]);
      await make("Café de Flore", "cafe", [48.8576, 2.3675]);
    },
    PLACE,
  );

  await page.goto("/map");
  await workLocally(page);
  await expect(page.getByText("2 pins")).toBeVisible();
  const markers = page.locator(".leaflet-marker-icon");
  await expect(markers).toHaveCount(2);

  // Zoom in on the map.
  await page.getByRole("button", { name: "Zoom in" }).click();
  // Chez Janou is the westernmost Pin and stays under every filter below: follow it, not
  // whichever marker Leaflet happens to draw first.
  const janou = async () =>
    (await markers.evaluateAll((els) => els.map((el) => { const r = el.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y)] as const; })))
      .sort((a, b) => a[0] - b[0])[0];
  // Leaflet animates the zoom: wait until the view has settled before noting where the Pin is.
  let before: readonly [number, number] | undefined;
  await expect
    .poll(async () => {
      const now = await janou();
      const settled = JSON.stringify(now) === JSON.stringify(before);
      before = now;
      return settled;
    }, { intervals: [300] })
    .toBe(true);
  const stays = async () => expect.poll(janou).toEqual(before);

  const places = page.getByRole("button", { name: /^Places \d/ });
  await places.click(); // off: 0 pins
  await expect(page.getByText("0 pins")).toBeVisible();
  await places.click();
  await expect(markers).toHaveCount(2);
  await stays();

  await page.getByRole("combobox", { name: "Kind" }).click();
  await page.getByRole("option", { name: "Restaurant", exact: true }).click();
  await expect(page.getByText("1 pin", { exact: true })).toBeVisible();
  await stays();
  await page.getByRole("combobox", { name: "Kind" }).click();
  await page.getByRole("option", { name: "Any kind", exact: true }).click();
  await expect(markers).toHaveCount(2);
  await stays();

  // To try on leaves 0 pins (neither Place is marked): the map stays where it was.
  await page.getByRole("button", { name: "To try", exact: true }).click();
  await expect(page.getByText("0 pins")).toBeVisible();
  await page.getByRole("button", { name: "To try", exact: true }).click();
  await expect(markers).toHaveCount(2);
  await stays();
});
