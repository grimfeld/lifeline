import { test, expect } from "@playwright/test";
import { openPalette } from "./support/palette";
import { inCore } from "./support/core";
import { workLocally } from "./support/journal";

/** An Event's With offers Households (ADR 0117, #463): picking one adds its members of today as People, each removable; With keeps People only. */

test("a Household picked in an Event's With adds its current members; one is taken off and the Event saves People only", async ({ page }) => {
  const stamp = Date.now();
  const title = `Dinner at the Hwtests ${stamp}`;
  await page.goto("/app/events");
  await workLocally(page);
  const ids = await inCore(
    page,
    async (core, s: number) => {
      const make = async (t: string) => (await core.createDocument({ type: "contacts_person", title: t })).id as string;
      const [paul, mary, lily, tom] = [await make(`Paul Hwtest ${s}`), await make(`Mary Hwtest ${s}`), await make(`Lily Hwtest ${s}`), await make(`Tom Hwtest ${s}`)];
      const members = [{ personId: paul }, { personId: mary }, { personId: lily, since: "2001-01-01" }, { personId: tom, until: "2002-01-01" }];
      await core.createDocument({ type: "contacts_household", title: `the Hwtests ${s}`, fields: { members } });
      return { paul, mary, lily, tom };
    },
    stamp,
  );

  await openPalette(page);
  await page.getByPlaceholder("Type a command or search…").fill("Add event");
  await page.getByRole("option", { name: "Add event Calendar", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "New event" });
  await dialog.getByLabel("Title").fill(title);

  // Mary is there already: the Household adds the others who live there today, not Tom who moved out.
  const withBox = dialog.getByPlaceholder("Add a person or household…");
  await withBox.fill(`Mary Hwtest ${stamp}`);
  await page.getByRole("option", { name: new RegExp(`Mary Hwtest ${stamp}`) }).click();
  await withBox.fill(`the Hwtests ${stamp}`);
  const option = page.getByRole("option", { name: new RegExp(`the Hwtests ${stamp}`) });
  await expect(option).toContainText(`Household · Paul Hwtest ${stamp}, Lily Hwtest ${stamp}`);
  await option.click();
  for (const who of ["Mary", "Paul", "Lily"]) await expect(dialog.getByRole("button", { name: `Remove ${who} Hwtest ${stamp}` })).toBeVisible();
  await expect(dialog.getByRole("button", { name: `Remove Tom Hwtest ${stamp}` })).toHaveCount(0);

  // Lily was away.
  await dialog.getByRole("button", { name: `Remove Lily Hwtest ${stamp}` }).click();
  await dialog.getByRole("button", { name: "Add event" }).click();
  await expect(dialog).toBeHidden();

  const stored = () =>
    inCore(
      page,
      async (core, t: string) => ((await core.documentsOf("event")).find((d: { title: string }) => d.title === t) as { with?: string[] } | undefined)?.with ?? null,
      title,
    );
  await expect.poll(stored).toEqual([ids.mary, ids.paul]);
});
