import { test, expect } from "@playwright/test";
import { inCore } from "./support/core";
import { workLocally } from "./support/journal";

/** A link to a Household reaches its members (ADR 0117, #461): "via the Smiths" on their Timeline, counted as mentioned and seen, so not Drifting. */

test("a Day and an Event naming a Household of two stand on a member's Timeline, via the Household, and keep him off Drifting", async ({ page }) => {
  await page.goto("/app/people");
  await workLocally(page);
  const { paul, today } = await inCore(
    page,
    async (core) => {
      // A Relationship puts him on Drifting until he is seen.
      const paul = (await core.createDocument({ type: "contacts_person", title: "Paul Viatest", fields: { relationship: "old friend" } })).id as string;
      const mary = (await core.createDocument({ type: "contacts_person", title: "Mary Viatest" })).id as string;
      await core.createDocument({ type: "contacts_household", title: "the Viatests", fields: { aliases: [], members: [{ personId: paul }, { personId: mary }] } });
      const today = core.todayStr();
      // The seed may have written today's Day already: add to it, or start it.
      const day = (await core.documentsOf("daily")).find((d) => d.title === today);
      const line = "Dinner at [[the Viatests]]";
      if (day) await core.patchDocument(day.id, { body: `${day.body ?? ""}\n\n${line}` });
      else await core.createDocument({ type: "daily", title: today, body: line });
      await core.createDocument({ type: "event", title: "Lunch with the Viatests", fields: { date: today, notes: "at [[the Viatests]]" } });
      return { paul, today };
    },
    undefined,
  );

  await page.goto(`/app/people/person/${paul}`);
  await workLocally(page);
  const timeline = page.getByRole("region", { name: "Timeline" });
  const entry = timeline.getByRole("button", { name: new RegExp(`^${today}`) });
  await expect(entry).toHaveCount(1);
  await expect(entry).toContainText("via the Viatests");
  // It counts as mentioning him: Last mentioned is today.
  await expect(page.getByRole("region", { name: "Reports" })).toContainText("today");

  // Seen today through the Household: not Drifting, though never seen by name.
  await page.goto("/app/people");
  await workLocally(page);
  await expect(page.getByRole("region", { name: "Everyone" }).getByRole("link", { name: /Paul Viatest/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Drifting" }).getByText("Paul Viatest")).toHaveCount(0);
});

test("a Household's page has its own Timeline and Reports: what links to it, by name", async ({ page }) => {
  await page.goto("/app/people");
  await workLocally(page);
  const { household } = await inCore(
    page,
    async (core) => {
      const ann = (await core.createDocument({ type: "contacts_person", title: "Ann Hometest" })).id as string;
      const household = (await core.createDocument({ type: "contacts_household", title: "the Hometests", fields: { aliases: [], members: [{ personId: ann }] } })).id as string;
      const today = core.todayStr();
      await core.createDocument({ type: "event", title: "Tea at the Hometests", fields: { date: today, notes: "at [[the Hometests]]" } });
      return { household };
    },
    undefined,
  );

  await page.goto(`/app/people/household/${household}`);
  await workLocally(page);
  const entry = page.getByRole("region", { name: "Timeline" }).getByRole("button", { name: /Tea at the Hometests/ });
  await expect(entry).toBeVisible();
  // Its own link, by name in the Event's Notes: nothing "via" about it.
  await expect(entry).toContainText("mentioned");
  await expect(entry).not.toContainText("via");
  await expect(page.getByRole("region", { name: "Reports" })).toContainText("today");
});

test("on a phone, Add household sits in the Phone dock", async ({ page, isMobile }) => {
  test.skip(!isMobile, "the Phone dock is the phone's");
  await page.goto("/app/people/households");
  await workLocally(page);
  const dock = page.locator("[data-phone-dock-line]");
  await expect(dock.getByRole("button", { name: "Add household" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("button", { name: "Add household" })).toHaveCount(0);
});
