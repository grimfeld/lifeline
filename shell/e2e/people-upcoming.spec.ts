import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";

/** Upcoming (#416): the Occasions in the next 30 days, heading the People home. */

const PERSON = "contacts_person";

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const inDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};

test("Upcoming heads the People home with the Occasions coming, the age reached, and each row opens the Person", async ({ page }) => {
  await page.goto("/app/people");
  await workLocally(page);
  const upcoming = page.getByRole("region", { name: "Upcoming" });
  await expect(upcoming).toBeVisible();
  const rows = upcoming.getByRole("listitem");
  const before = await rows.count();

  const soon = inDays(3);
  const born = soon.getFullYear() - 40;
  const id = await inCore(
    page,
    async (core, a: { type: string; day: string; once: string; far: string }) =>
      (await core.createDocument({
        type: a.type,
        title: "Zelda Upcoming",
        fields: {
          aliases: [],
          relationship: "",
          occasions: [
            { id: "b", label: "Birthday", day: a.day, yearly: true },
            { id: "c", label: "Surgery", day: a.once, yearly: false },
            { id: "d", label: "Far away", day: a.far, yearly: false },
          ],
        },
      })).id as string,
    { type: PERSON, day: `${born}-${pad(soon.getMonth() + 1)}-${pad(soon.getDate())}`, once: ymd(inDays(10)), far: ymd(inDays(200)) },
  );

  await page.goto("/app/people");
  await workLocally(page);
  await expect(rows).toHaveCount(before + 2);
  await expect(upcoming).toContainText("Zelda Upcoming · Birthday · turns 40");
  await expect(upcoming).toContainText("Surgery");
  await expect(upcoming).not.toContainText("Far away");

  await upcoming.getByRole("link", { name: /Zelda Upcoming · Birthday/ }).click();
  await expect(page).toHaveURL(new RegExp(`/app/people/person/${id}`));
});
