import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";

/**
 * To try and closed (#504, ADR 0128): the Places screen lists the Places To
 * try and the closed ones apart; World's map narrows to To try and a Kind
 * together; an Event At a To try Place that has happened clears the mark, a
 * future one leaves it; a closed Place leaves the map and the lists until it
 * is reopened.
 */

const PLACE = "atlas_place";

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  // Longer than other specs wait: on a busy machine the sign-in screen comes late, and then hides the page.
  await local.waitFor({ timeout: 8000 }).then(() => local.click(), () => {});
}

/** A Place made in the store, on the map; its id. */
async function makePlace(page: Page, title: string, fields: Record<string, unknown>): Promise<string> {
  return inCore(
    page,
    async (core, a: { type: string; title: string; fields: Record<string, unknown> }) => (await core.createDocument({ type: a.type, title: a.title, folder: "Places", fields: { aliases: [], address: "Paris", ...a.fields } })).id as string,
    { type: PLACE, title, fields },
  );
}

/** An Event At a Place, `days` from today (negative: past), saved as Calendar saves one. */
async function eventAt(page: Page, placeId: string, days: number) {
  await inCore(
    page,
    async (core, a: { at: string; days: number }) => {
      await core.putDocument({ type: "event", title: "Dinner", notes: "", date: core.addDays(core.todayStr(), a.days), endDate: null, start: null, end: null, with: [], at: a.at });
    },
    { at: placeId, days },
  );
}

/** The seed's Places (and People's Addresses) out of the way, so the counts are the test's own. */
async function onlyOurs(page: Page) {
  await inCore(
    page,
    async (core, types: string[]) => {
      for (const t of types) for (const d of await core.documentsOf(t)) await core.removeDocument(d.id);
    },
    [PLACE, "contacts_person"],
  );
}

const listed = (page: Page) => page.getByRole("list", { name: "Places" }).getByRole("link", { name: /^(Chez Janou|Café de Flore|Café Kitsuné)/ });

/** Switch the Places screen to one of its lists, with the switch the desktop width shows. */
async function showList(page: Page, name: "All" | "To try" | "Closed") {
  await page.getByRole("radio", { name, exact: true }).click();
}

test("To try has its own list, and filters World's map with a Kind; a past Event At it clears it, a future one does not", async ({ page }) => {
  await page.goto("/app/places");
  await workLocally(page);
  await onlyOurs(page);
  const janou = await makePlace(page, "Chez Janou", { kind: "restaurant", toTry: true, geo: [48.8556, 2.3655] });
  const flore = await makePlace(page, "Café de Flore", { kind: "cafe", toTry: true, geo: [48.854, 2.3325] });
  await makePlace(page, "Café Kitsuné", { kind: "cafe", geo: [48.863, 2.337] });

  await showList(page, "To try");
  await expect(listed(page)).toHaveText([/^Café de Flore/, /^Chez Janou/]);

  // The map: three Places, two To try, one of them a café.
  await page.goto("/module/people");
  await workLocally(page);
  await expect(page.getByText("3 pins")).toBeVisible();
  await page.getByRole("button", { name: "To try", exact: true }).click();
  await expect(page.getByText("2 pins")).toBeVisible();
  await page.getByRole("combobox", { name: "Kind" }).click();
  await page.getByRole("option", { name: "Café", exact: true }).click();
  await expect(page.getByText("1 pin", { exact: true })).toBeVisible();

  // Dinner at Chez Janou next week leaves it To try; dinner there yesterday clears it.
  await eventAt(page, janou, 7);
  await eventAt(page, flore, -1);
  await page.goto("/app/places");
  await workLocally(page);
  await showList(page, "To try");
  await expect(listed(page)).toHaveText([/^Chez Janou/]);
});

test("a closed Place leaves the map and the lists, shows under Closed with its backlinks, and is reopened", async ({ page }) => {
  await page.goto("/app/places");
  await workLocally(page);
  await onlyOurs(page);
  const janou = await makePlace(page, "Chez Janou", { kind: "restaurant", toTry: true, geo: [48.8556, 2.3655] });
  await makePlace(page, "Café de Flore", { kind: "cafe", geo: [48.854, 2.3325] });
  await inCore(page, async (core) => void (await core.createDocument({ type: "daily", title: "2026-11-01", body: "Lunch at [[Chez Janou]]." })), null);

  await page.goto(`/app/places/place/${janou}`);
  await workLocally(page);
  const details = page.getByRole("region", { name: "Details" });
  await details.getByRole("checkbox", { name: "Closed" }).click();
  await expect(page.getByText(/^Closed: off the map/)).toBeVisible();
  await expect(page.getByRole("region", { name: "On the map" })).toHaveCount(0);
  await expect(page.getByText("Lunch at", { exact: false }).first()).toBeVisible();

  await page.goto("/app/places");
  await workLocally(page);
  await expect(listed(page)).toHaveText([/^Café de Flore/]);
  await showList(page, "To try");
  await expect(listed(page)).toHaveCount(0);
  await showList(page, "Closed");
  await expect(listed(page)).toHaveText([/^Chez Janou/]);

  await page.goto("/module/people");
  await workLocally(page);
  await expect(page.getByRole("button", { name: /^Places 1$/ })).toBeVisible();

  // Reopened: back on the map and in the lists.
  await page.goto(`/app/places/place/${janou}`);
  await workLocally(page);
  await page.getByRole("region", { name: "Details" }).getByRole("checkbox", { name: "Closed" }).click();
  await expect(page.getByRole("region", { name: "On the map" })).toBeVisible();
  await page.goto("/module/people");
  await workLocally(page);
  await expect(page.getByRole("button", { name: /^Places 2$/ })).toBeVisible();
});

test("a Place gone to before is marked To try again, and opening its page keeps the mark", async ({ page }) => {
  await page.goto("/app/places");
  await workLocally(page);
  await onlyOurs(page);
  const janou = await makePlace(page, "Chez Janou", { kind: "restaurant", geo: [48.8556, 2.3655] });
  await eventAt(page, janou, -30);

  await page.goto(`/app/places/place/${janou}`);
  await workLocally(page);
  const toTry = page.getByRole("region", { name: "Details" }).getByRole("checkbox", { name: "To try" });
  await toTry.click();
  await expect(toTry).toBeChecked();
  await page.reload();
  await workLocally(page);
  await expect(page.getByRole("region", { name: "Details" }).getByRole("checkbox", { name: "To try" })).toBeChecked();
});

// On a phone the sort sits in the Filters sheet: this case is the Places screen's phone filters' cover.
test("the Places screen sorts by last visit, the Places never visited last", { tag: "@also-phone" }, async ({ page, isMobile }) => {
  await page.goto("/app/places");
  await workLocally(page);
  await onlyOurs(page);
  const janou = await makePlace(page, "Chez Janou", { kind: "restaurant" });
  const flore = await makePlace(page, "Café de Flore", { kind: "cafe" });
  await makePlace(page, "Café Kitsuné", { kind: "cafe" });
  await eventAt(page, flore, -10);
  await eventAt(page, janou, -2);

  await expect(listed(page)).toHaveText([/^Café de Flore/, /^Café Kitsuné/, /^Chez Janou/]);
  if (isMobile) await page.getByRole("button", { name: /^Filters/ }).click();
  await page.getByRole("combobox", { name: "Sort" }).click();
  await page.getByRole("option", { name: "Last visit", exact: true }).click();
  if (isMobile) await page.keyboard.press("Escape");
  await expect(listed(page)).toHaveText([/^Chez Janou/, /^Café de Flore/, /^Café Kitsuné/]);
});
// timing run for #633; not to merge
