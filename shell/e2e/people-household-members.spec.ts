import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";
import { workLocally } from "./support/journal";
import { openPalette } from "./support/palette";

/** Households (ADR 0117, #460): made, given members, joined from a Person's page, linked, and left by a deleted Person. */

async function makePerson(page: Page, title: string): Promise<string> {
  return inCore(page, async (core, t: string) => (await core.createDocument({ type: "contacts_person", title: t })).id as string, title);
}

test("a Household is made, takes members from its page and from a Person's, and loses a deleted one", async ({ page }) => {
  await page.goto("/app/people/households");
  await workLocally(page);
  const paul = await makePerson(page, "Paul Hhtest");
  const tom = await makePerson(page, "Tom Hhtest");

  await page.getByRole("button", { name: "Add household" }).first().click();
  const add = page.getByRole("dialog", { name: "Add a household" });
  await add.getByLabel("Name").fill("the Hhtests");
  await add.getByRole("button", { name: "Add" }).click();
  await expect(page).toHaveURL(/\/app\/people\/household\//);

  // A member from the Household's page.
  const members = page.getByRole("region", { name: "Members" });
  await members.getByRole("button", { name: "Add member" }).click();
  const pick = page.getByRole("dialog", { name: "Add a member" });
  await pick.getByRole("combobox").fill("Paul Hh");
  await page.getByRole("option", { name: /Paul Hhtest/ }).click();
  await expect(members.getByRole("link", { name: "Paul Hhtest" })).toBeVisible();

  // Another from Tom's page, where the line then names it.
  await page.goto(`/app/people/person/${tom}`);
  await workLocally(page);
  const line = page.getByTestId("person-households");
  await line.getByRole("button", { name: "Add to a household…" }).click();
  const join = page.getByRole("dialog", { name: "Add to a household" });
  await join.getByRole("combobox").fill("the Hht");
  await page.getByRole("option", { name: "the Hhtests" }).click();
  await expect(line.getByRole("link", { name: "the Hhtests" })).toBeVisible();

  // The Household lists both on the Households screen.
  await page.goto("/app/people/households");
  await workLocally(page);
  await expect(page.getByRole("link", { name: /the Hhtests/ })).toContainText("Paul Hhtest, Tom Hhtest");

  // Deleting Paul drops his membership; the Household stays with Tom.
  await inCore(page, async (core, id: string) => core.removeDocument(id), paul);
  await expect(page.getByRole("link", { name: /the Hhtests/ })).toContainText("Tom Hhtest");
  await expect(page.getByRole("link", { name: /the Hhtests/ })).not.toContainText("Paul");

  // Taken out from the Household's page, with Undo.
  await page.getByRole("link", { name: /the Hhtests/ }).click();
  await page.getByRole("button", { name: "Remove Tom Hhtest from the Hhtests" }).click();
  await expect(members).toContainText("No members yet.");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(members.getByRole("link", { name: "Tom Hhtest" })).toBeVisible();
});

test("Add person suggests joining a Household of the same Family name, and joins only when tapped", async ({ page }) => {
  await page.goto("/app/people");
  await workLocally(page);
  const paul = await inCore(page, async (core, _arg: string) => (await core.createDocument({ type: "contacts_person", title: "Paul Zzsmith", fields: { givenName: "Paul", familyName: "Zzsmith" } })).id as string, "x");
  await inCore(page, async (core, p: string) => { await core.createDocument({ type: "contacts_household", title: "the Zzsmiths", fields: { members: [{ personId: p }] } }); }, paul);
  const members = (title: string) => inCore(page, async (core, t: string) => ((await core.documentsOf("contacts_household")) as unknown as { title: string; members: unknown[] }[]).find((h) => h.title === t)?.members.length ?? -1, title);

  async function openDialog() {
    await openPalette(page);
    await page.keyboard.type("Add person");
    await page.getByRole("option", { name: /Add person/ }).first().click();
    return page.getByRole("dialog", { name: "Add a person" });
  }

  // Not tapped: they are added, and join nothing.
  let dialog = await openDialog();
  await dialog.getByLabel("Given name").fill("Una");
  await dialog.getByLabel("Family name").fill("zzsmith");
  await expect(dialog.getByRole("button", { name: "Join the Zzsmiths?" })).toBeVisible();
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Una zzsmith" })).toBeVisible();
  expect(await members("the Zzsmiths")).toBe(1);
  await page.keyboard.press("Escape");

  // No suggestion for another name; tapped: they join.
  dialog = await openDialog();
  await dialog.getByLabel("Family name").fill("Other");
  await expect(dialog.getByRole("button", { name: /Join/ })).toHaveCount(0);
  await dialog.getByLabel("Given name").fill("Ugo");
  await dialog.getByLabel("Family name").fill("Zzsmith");
  await dialog.getByRole("button", { name: "Join the Zzsmiths?" }).click();
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await expect.poll(() => members("the Zzsmiths")).toBe(2);
});

test("a member who moved out stays listed as a former member, and their days are edited from the page", async ({ page }) => {
  await page.goto("/app/people/households");
  await workLocally(page);
  const paul = await makePerson(page, "Paul Mvtest");
  const tom = await makePerson(page, "Tom Mvtest");
  const id = await inCore(
    page,
    async (core, a: { paul: string; tom: string }) =>
      (await core.createDocument({ type: "contacts_household", title: "the Mvtests", fields: { members: [{ personId: a.paul }, { personId: a.tom, since: "1990-01-01", until: "2001-02-03" }] } })).id as string,
    { paul, tom },
  );
  await page.goto(`/app/people/household/${id}`);
  await workLocally(page);

  // Tom left long ago: listed apart, with his days; Paul is a member.
  const former = page.getByRole("group", { name: "Former members" });
  await expect(former.getByRole("link", { name: "Tom Mvtest" })).toBeVisible();
  await expect(former).toContainText("since 1990-01-01 until 2001-02-03");
  const members = page.getByRole("region", { name: "Members" });
  await expect(members.getByRole("link", { name: "Paul Mvtest" })).toBeVisible();

  // Paul moves out: an until day (today) ends nothing yet; clearing Tom's until brings him back.
  await former.getByRole("button", { name: "Dates for Tom Mvtest in the Mvtests" }).click();
  const dialog = page.getByRole("dialog", { name: "Dates for Tom Mvtest" });
  await dialog.getByRole("button", { name: /^Until/ }).click();
  await page.getByRole("button", { name: "Clear" }).click();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(former).toHaveCount(0);
  await expect(members.getByRole("link", { name: "Tom Mvtest" })).toBeVisible();
  await expect(members).toContainText("since 1990-01-01");
  await expect(members).not.toContainText("until");
});
