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
