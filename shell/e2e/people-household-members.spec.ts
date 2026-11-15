import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";

/** Households (ADR 0117, #460): made, given members, joined from a Person's page, linked, and left by a deleted Person. */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 8000 }).then(() => local.click(), () => {});
}

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
  await line.getByRole("button", { name: "Add to a Household…" }).click();
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
