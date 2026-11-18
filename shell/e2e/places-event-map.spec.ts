import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";

/**
 * An Event At a Place stands on the World map (#505, ADR 0122): at the
 * Place's Pin, under its own title and day, and opens the Event. An Event
 * At a Person stands at their Home Address; one At a Person with no
 * current Address is off the map. Prior art: places-map.spec.ts.
 */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

test("an Event At a Place stands on the World map, shows its title and day, and opens the Event", async ({ page }) => {
  // The map tiles are refused: drawing the map needs no outside request.
  await page.route(/^https:\/\/(?!localhost)/, (route) => route.abort());
  const stamp = Date.now();
  const title = `Dinner at Janou ${stamp}`;
  await page.goto("/app/places");
  await workLocally(page);
  await inCore(
    page,
    async (core, a: { title: string; stamp: number }) => {
      const event = (fields: Record<string, unknown>, t: string) =>
        core.createDocument({ type: "event", title: t, folder: "", fields: { date: "2026-11-10", endDate: null, start: "20:00", end: "22:00", notes: "", with: [], ...fields } });
      const place = await core.createDocument({ type: "atlas_place", title: `Chez Janou ${a.stamp}`, folder: "Places", fields: { aliases: [], kind: "restaurant", address: "2 Rue Roger Verlomme, Paris", geo: [48.8556, 2.3655] } });
      const marc = await core.createDocument({
        type: "contacts_person",
        title: `Marc ${a.stamp}`,
        folder: "People",
        fields: { aliases: [], relationship: "", addresses: [{ id: "w", label: "Work", text: "1 Rue du Travail", lat: 48.9, lon: 2.4, former: false }, { id: "h", label: "Home", text: "12 Rue Example", lat: 48.85, lon: 2.35, former: false }] },
      });
      const léa = await core.createDocument({ type: "contacts_person", title: `Léa ${a.stamp}`, folder: "People", fields: { aliases: [], relationship: "" } });
      await event({ at: place.id }, a.title);
      await event({ at: marc.id }, `Tea at Marc's ${a.stamp}`);
      await event({ at: léa.id }, `Cat at Léa's ${a.stamp}`);
    },
    { title, stamp },
  );

  await page.goto("/module/people");
  await workLocally(page);
  // The Place's Event and the Person's: the one At a Person with no Address is off the map.
  await expect(page.getByRole("button", { name: /^Events 2$/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Places 1$/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^People 2$/ })).toBeVisible();

  // Only the Place's Event left: the Places and People chips off, and the Event At Marc's moved to nowhere.
  await inCore(page, async (core, t: string) => {
    const tea = ((await core.documentsOf("event")) as { id: string; title: string }[]).find((e) => e.title === t)!;
    await core.patchDocument(tea.id, { at: "" });
  }, `Tea at Marc's ${stamp}`);
  await expect(page.getByRole("button", { name: /^Events 1$/ })).toBeVisible();
  await page.getByRole("button", { name: /^Places 1$/ }).click();
  await page.getByRole("button", { name: /^People 2$/ }).click();
  await expect(page.getByText("1 pin", { exact: true })).toBeVisible();

  await page.locator(".ll-pin").click();
  const popup = page.locator(".ll-popup");
  await expect(popup.locator(".ll-popup-name")).toHaveText(title);
  await expect(popup.locator(".ll-popup-sub")).toContainText(/^Event · .*10/);
  await popup.getByRole("button", { name: "Open →" }).click();
  await expect(page.getByRole("dialog", { name: title })).toBeVisible();
});
