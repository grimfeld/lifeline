import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";
import { openPalette } from "./support/palette";

/** An Event's With (a People field): completes People's names and aliases, and the Event shows on their page. */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

test("an Event added With someone, found by an alias, shows on their Person page under Events", async ({ page }) => {
  const title = `Dinner ${Date.now()}`;
  await page.goto("/app/events");
  await workLocally(page);
  const marc = await inCore(page, async (core) => (await core.createDocument({ type: "contacts_person", title: "Marc Lefèvre", fields: { aliases: ["Marco"] } })).id as string, null);

  await openPalette(page);
  await page.getByPlaceholder("Type a command or search…").fill("Add event");
  await page.getByRole("option", { name: "Add event Calendar", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "New event" });
  await dialog.getByLabel("Title").fill(title);
  await dialog.getByRole("combobox", { name: "With" }).fill("Marco");
  await page.getByRole("option", { name: /Marc Lefèvre/ }).click();
  await expect(dialog.getByText("Marc Lefèvre")).toBeVisible();
  await dialog.getByRole("button", { name: "Add event" }).click();
  await expect(dialog).toBeHidden();

  await page.goto(`/app/people/person/${marc}`);
  await workLocally(page);
  await expect(page.getByRole("region", { name: "Timeline" })).toContainText(title);
});

test("an Event With someone still to come stands above the Today line on their timeline, one gone by below it", async ({ page }) => {
  await page.goto("/app/people");
  await workLocally(page);
  const ids = await inCore(page, async (core) => {
    const marc = (await core.createDocument({ type: "contacts_person", title: "Marc Lefèvre" })).id as string;
    await core.createDocument({ type: "event", title: "Housewarming ahead", fields: { date: "2099-12-13", with: [marc] } });
    await core.createDocument({ type: "event", title: "Dinner gone by", fields: { date: "2001-02-03", with: [marc] } });
    return marc;
  }, null);

  await page.goto(`/app/people/person/${ids}`);
  await workLocally(page);
  const timeline = page.getByRole("region", { name: "Timeline" });
  await expect(timeline.getByRole("button", { name: /Housewarming ahead/ })).toBeVisible();
  await expect(timeline.getByRole("button", { name: /Dinner gone by/ })).toBeVisible();
  const order = await timeline.locator("li[aria-label='Today'], button").evaluateAll((els) => els.map((el) => el.getAttribute("aria-label") ?? el.textContent ?? ""));
  const at = (s: string) => order.findIndex((t) => t.includes(s));
  expect(at("Housewarming ahead")).toBeLessThan(at("Today"));
  expect(at("Dinner gone by")).toBeGreaterThan(at("Today"));
  await expect(timeline.getByRole("button", { name: /Housewarming ahead/ })).toContainText(/in \d+ days/);
});

test("an Event's Peek offers Households in With, as the dialog does: picking one stores its People at once", async ({ page }) => {
  const stamp = Date.now();
  await page.goto("/vault");
  await workLocally(page);
  const ids = await inCore(
    page,
    async (core, s: number) => {
      const make = async (t: string) => (await core.createDocument({ type: "contacts_person", title: t })).id as string;
      const [ines, joao] = [await make(`Ines Pkhw ${s}`), await make(`Joao Pkhw ${s}`)];
      await core.createDocument({ type: "contacts_household", title: `the Pkhws ${s}`, fields: { members: [{ personId: ines }, { personId: joao }] } });
      const event = (await core.putDocument({ type: "event", title: `Lunch ${s}`, date: "2026-03-02", endDate: null, start: null, end: null, notes: "", tags: [] })).id as string;
      await core.openPeek(event);
      return { ines, joao, event };
    },
    stamp,
  );
  const peek = page.getByRole("dialog", { name: `Lunch ${stamp}` });
  await peek.getByPlaceholder("Add a person or household…").fill(`the Pkhws ${stamp}`);
  await page.getByRole("option", { name: new RegExp(`the Pkhws ${stamp}`) }).click();
  const stored = () => inCore(page, async (core, id: string) => ((await core.getDocument(id)) as { with?: string[] }).with ?? [], ids.event);
  await expect.poll(stored).toEqual([ids.ines, ids.joao]);
});
// timing run for #633; not to merge
