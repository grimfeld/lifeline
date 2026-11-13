import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";

/**
 * A Person's Addresses and their Pins (#418): added on the Person page, looked
 * up when saved, a Pin each on the Map while current, none once former. A
 * failed lookup keeps the Address and offers it again.
 */

const PERSON = "contacts_person";

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

/** Nominatim answers for the places it knows; Photon and the map tiles are stubbed so nothing leaves the machine. `down` makes Nominatim fail. */
async function stubGeocoders(page: Page, state: { down: boolean }) {
  const places: Record<string, [string, string]> = { "12 Rue Example, Paris": ["48.85", "2.35"], "5 Quai Work, Lyon": ["45.76", "4.83"] };
  await page.route(/^https:\/\/(?!localhost)/, (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "nominatim.openstreetmap.org") {
      if (state.down) return route.fulfill({ status: 503, body: "down" });
      const hit = places[url.searchParams.get("q") ?? ""];
      return route.fulfill({ json: hit ? [{ lat: hit[0], lon: hit[1], display_name: "Somewhere" }] : [] });
    }
    if (url.hostname === "photon.komoot.io") return route.fulfill({ json: { features: [] } });
    return route.abort();
  });
}

async function newPerson(page: Page, title: string): Promise<string> {
  await page.goto("/app/people");
  await workLocally(page);
  const id = await inCore(page, async (core, a: { type: string; title: string }) => (await core.createDocument({ type: a.type, title: a.title, fields: { aliases: [], relationship: "" } })).id as string, { type: PERSON, title });
  await page.goto(`/app/people/person/${id}`);
  await workLocally(page);
  return id;
}

const addressesOf = (page: Page, id: string) =>
  inCore(page, async (core, i: string) => ((await core.getDocument(i)) as { addresses?: { label: string; text: string; lat?: number; former: boolean }[] }).addresses ?? [], id);

async function addAddress(page: Page, label: string, text: string) {
  await page.getByRole("button", { name: "Add address" }).click();
  const dialog = page.getByRole("dialog", { name: "Add an address" });
  await dialog.getByLabel("Label").fill(label);
  await dialog.getByLabel("Address", { exact: true }).fill(text);
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
}

test("two current Addresses stand on the Map twice; a former one leaves it", async ({ page }) => {
  await stubGeocoders(page, { down: false });
  const id = await newPerson(page, "Marc Petit");
  await addAddress(page, "Home", "12 Rue Example, Paris");
  await addAddress(page, "Work", "5 Quai Work, Lyon");
  await expect.poll(async () => (await addressesOf(page, id)).map((a) => [a.label, a.lat !== undefined])).toEqual([["Home", true], ["Work", true]]);

  await page.goto("/map");
  await workLocally(page);
  await expect(page.getByRole("button", { name: /^People 2$/ })).toBeVisible();

  await page.goto(`/app/people/person/${id}`);
  await workLocally(page);
  // Former is changed in Edit (#422).
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByTestId("address").filter({ hasText: "Home" }).getByRole("button", { name: "Mark Home former" }).click();
  await expect.poll(async () => (await addressesOf(page, id)).find((a) => a.label === "Home")?.former).toBe(true);
  // The former Address stays on the page, below the current one.
  await expect(page.getByTestId("address").nth(1)).toContainText("Home");
  await expect(page.getByTestId("address").nth(1)).toContainText("former");

  await page.goto("/map");
  await workLocally(page);
  await expect(page.getByRole("button", { name: /^People 1$/ })).toBeVisible();
});

test("a failed lookup keeps the Address with no Pin, and trying again finds it", async ({ page }) => {
  const state = { down: true };
  await stubGeocoders(page, state);
  const id = await newPerson(page, "Léa Martin");
  await addAddress(page, "Holiday house", "12 Rue Example, Paris");
  // An outage is said as one, not as text that matches no place.
  await expect(page.getByText("The map lookup could not be reached", { exact: false })).toBeVisible();

  const row = page.getByTestId("address");
  await expect(row).toContainText("Holiday house");
  await expect(row).toContainText(/not on the map/i);
  expect((await addressesOf(page, id))[0]).toMatchObject({ text: "12 Rue Example, Paris", former: false });
  expect((await addressesOf(page, id))[0]!.lat).toBeUndefined();

  state.down = false;
  await row.getByRole("button", { name: "Try again" }).click();
  await expect(row).not.toContainText(/not on the map/i);
  await expect.poll(async () => (await addressesOf(page, id))[0]?.lat).toBeCloseTo(48.85);
});

test("an Address is changed and removed", async ({ page }) => {
  await stubGeocoders(page, { down: false });
  const id = await newPerson(page, "Ada Roy");
  await addAddress(page, "Home", "12 Rue Example, Paris");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("button", { name: "Change Home: 12 Rue Example, Paris" }).click();
  const dialog = page.getByRole("dialog", { name: "Change address" });
  await dialog.getByLabel("Label").fill("Flat");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect.poll(async () => (await addressesOf(page, id))[0]).toMatchObject({ label: "Flat", text: "12 Rue Example, Paris" });
  await page.getByRole("button", { name: "Remove Flat" }).click();
  await expect.poll(() => addressesOf(page, id)).toEqual([]);
});
