import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";
import { datePickerLabelled, pickDate } from "./support/date-picker";

/**
 * Occasions (#404 stories 22-31): added on a Person's page, they head Upcoming
 * on the People home (#416) and stand on the Calendar as all-day markers, not
 * Events and not Deadlines. Which Occasions fall when, and with what age, is
 * occasions.test's.
 */

const PERSON = "contacts_person";

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

const today = new Date();
const pad = (n: number) => String(n).padStart(2, "0");
const month = pad(today.getMonth() + 1);
const dom = pad(today.getDate());
const age = today.getFullYear() - 1961;

test("a Birthday added on a Person's page shows their age there, heads Upcoming on the People home and stands on the Calendar as an all-day marker", async ({ page }) => {
  await page.goto("/app/people");
  await workLocally(page);
  const id = await inCore(page, async (core, type: string) => (await core.createDocument({ type, title: "Anne Dupont", fields: { aliases: [], relationship: "my mother" } })).id as string, PERSON);
  await page.goto(`/app/people/person/${id}`);
  await workLocally(page);

  await page.getByRole("button", { name: "Add occasion" }).click();
  const dialog = page.getByRole("dialog", { name: "Add an occasion" });
  await dialog.getByLabel("Label").fill("Birthday");
  await pickDate(page, datePickerLabelled(dialog, "Day"), `1961-${month}-${dom}`);
  await dialog.getByRole("button", { name: "Save" }).click();

  const occasions = page.getByRole("region", { name: "Occasions" });
  await expect(occasions).toContainText("Birthday");
  await expect(occasions).toContainText("every year");
  await expect(page.getByText(`${age} years old`)).toBeVisible();

  // Today's Birthday heads Upcoming on the People home, with the age reached, and opens the Person.
  await page.goto("/app/people");
  await workLocally(page);
  const upcoming = page.getByRole("region", { name: "Upcoming" }).getByRole("link", { name: new RegExp(`today.*Anne Dupont.*Birthday · turns ${age}`) });
  await expect(upcoming).toBeVisible();
  await upcoming.click();
  await expect(page).toHaveURL(new RegExp(`/app/people/person/${id}`));

  await page.goto("/calendar?view=month");
  await workLocally(page);
  await expect(page.getByText(`🎂 Anne Dupont · ${age}`)).toBeVisible();
  // Not a missed Deadline: never drawn red.
  await expect(page.getByText(`🎂 Anne Dupont · ${age}`).first()).not.toHaveClass(/text-destructive/);
});

test("an Occasion can be edited and removed", async ({ page }) => {
  await page.goto("/app/people");
  await workLocally(page);
  const id = await inCore(page, async (core, type: string) => (await core.createDocument({ type, title: "Marc", fields: { aliases: [], relationship: "", occasions: [{ id: "o1", label: "Surgery", day: "2026-05-12", yearly: false }] } })).id as string, PERSON);
  await page.goto(`/app/people/person/${id}`);
  await workLocally(page);
  const occasions = page.getByRole("region", { name: "Occasions" });
  await expect(occasions).toContainText("Surgery");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await occasions.getByRole("button", { name: "Edit Surgery: 12 May 2026" }).click();
  await page.getByRole("dialog", { name: "Edit occasion" }).getByLabel("Label").fill("Operation");
  await page.getByRole("dialog", { name: "Edit occasion" }).getByRole("button", { name: "Save" }).click();
  await expect(occasions).toContainText("Operation");
  await occasions.getByRole("button", { name: "Remove Operation" }).click();
  await expect(occasions).not.toContainText("Operation");
});
