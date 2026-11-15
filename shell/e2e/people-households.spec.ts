import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";

/** A link to a Household reaches its members (ADR 0117, #461): "via the Smiths" on their Timeline, and counted as mentioned. */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 8000 }).then(() => local.click(), () => {});
}

test("a Day naming a Household of two stands on a member's Timeline, via the Household", async ({ page }) => {
  await page.goto("/app/people");
  await workLocally(page);
  const { paul, today } = await inCore(
    page,
    async (core) => {
      const paul = (await core.createDocument({ type: "contacts_person", title: "Paul Viatest" })).id as string;
      const mary = (await core.createDocument({ type: "contacts_person", title: "Mary Viatest" })).id as string;
      await core.createDocument({ type: "contacts_household", title: "the Viatests", fields: { aliases: [], members: [{ personId: paul }, { personId: mary }] } });
      const today = core.todayStr();
      // The seed may have written today's Day already: add to it, or start it.
      const day = (await core.documentsOf("daily")).find((d) => d.title === today);
      const line = "Dinner at [[the Viatests]]";
      if (day) await core.patchDocument(day.id, { body: `${day.body ?? ""}\n\n${line}` });
      else await core.createDocument({ type: "daily", title: today, body: line });
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
});
