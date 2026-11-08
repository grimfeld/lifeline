import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";
import { datePickerLabelled, pickDate } from "./support/date-picker";

/**
 * Occasions (#404 stories 22-31): added on a Person's page, they stand on the
 * Calendar as all-day markers, not Events and not Deadlines.
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

test("a Birthday added on a Person's page shows their age there and stands on the Calendar as an all-day marker", async ({ page }) => {
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
  await occasions.getByRole("button", { name: "Edit Surgery" }).click();
  await page.getByRole("dialog", { name: "Edit occasion" }).getByLabel("Label").fill("Operation");
  await page.getByRole("dialog", { name: "Edit occasion" }).getByRole("button", { name: "Save" }).click();
  await expect(occasions).toContainText("Operation");
  await occasions.getByRole("button", { name: "Remove Operation" }).click();
  await expect(occasions).not.toContainText("Operation");
});

test("a Birthday whose year I don't know is given as a month and a day, and carries no age", async ({ page }) => {
  await page.goto("/app/people");
  await workLocally(page);
  const id = await inCore(page, async (core, type: string) => (await core.createDocument({ type, title: "Léa", fields: { aliases: [], relationship: "friend" } })).id as string, PERSON);
  await page.goto(`/app/people/person/${id}`);
  await workLocally(page);

  await page.getByRole("button", { name: "Add occasion" }).click();
  const dialog = page.getByRole("dialog", { name: "Add an occasion" });
  await dialog.getByLabel("Label").fill("Birthday");
  await dialog.getByLabel("I don't know the year").check();
  await dialog.getByRole("combobox", { name: "Month" }).click();
  await page.getByRole("option", { name: "February" }).click();
  await dialog.getByRole("combobox", { name: "Day" }).click();
  await page.getByRole("option", { name: "29", exact: true }).click();
  await dialog.getByRole("button", { name: "Save" }).click();

  const occasions = page.getByRole("region", { name: "Occasions" });
  await expect(occasions).toContainText("29 February · every year");
  await expect(page.getByText(/years old/)).toHaveCount(0);
});
