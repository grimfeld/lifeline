import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";
import { datePickerLabelled, dayFromToday, pickDate } from "./support/date-picker";

/**
 * Exchanges (ADR 0131): a call, video call, message or letter with People,
 * logged from a Person's page or the phone's capture sheet. Which days are
 * refused and how the title is derived are exchanges.test's.
 */

const PERSON = "contacts_person";
const EXCHANGE = "contacts_exchange";

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

/** A Person made in the store; their id. */
const makePerson = (page: Page, title: string) => inCore(page, async (core, a: { type: string; title: string }) => (await core.createDocument({ type: a.type, title: a.title })).id as string, { type: PERSON, title });

/** The stored Exchanges that are with `personId`. */
const exchangesWith = (page: Page, personId: string) =>
  inCore(page, async (core, a: { type: string; id: string }) => ((await core.documentsOf(a.type)) as { with?: string[] }[]).filter((x) => x.with?.includes(a.id)) as never, { type: EXCHANGE, id: personId }) as Promise<{ title: string; kind: string; date: string; body?: string }[]>;

test("Log exchange on a Person's page logs a call with them, refusing a day to come and nobody", async ({ page }) => {
  const stamp = Date.now();
  const name = `Grandma ${stamp}`;
  await page.goto("/app/people");
  await workLocally(page);
  const id = await makePerson(page, name);
  await page.goto(`/app/people/person/${id}`);
  await workLocally(page);

  await page.getByRole("button", { name: "Log exchange" }).click();
  const dialog = page.getByRole("dialog", { name: "Log an exchange" });
  // With them already, a call, today.
  await expect(dialog.getByRole("button", { name: `Remove ${name}`, exact: true })).toBeVisible();
  const save = dialog.getByRole("button", { name: "Save", exact: true });
  await expect(save).toBeEnabled();

  await pickDate(page, datePickerLabelled(dialog, "Day"), dayFromToday(1));
  await expect(dialog.getByText("An exchange is something that happened. Plan a call as a Task or an Event.")).toBeVisible();
  await pickDate(page, datePickerLabelled(dialog, "Day"), dayFromToday(-2));
  await expect(dialog.getByText("An exchange is something that happened.")).toBeHidden();

  // Nobody: Save waits for someone.
  await dialog.getByRole("button", { name: `Remove ${name}`, exact: true }).click();
  await expect(save).toBeDisabled();
  await dialog.getByRole("combobox", { name: "With" }).fill(name);
  await page.getByRole("option", { name: new RegExp(name) }).first().click();
  await expect(save).toBeEnabled();

  await dialog.getByLabel("What was said").fill("The hip surgery went well. Lucie starts university in Lyon.");
  await save.click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => exchangesWith(page, id)).toEqual([expect.objectContaining({ title: `Call · ${name}`, kind: "call", date: dayFromToday(-2), body: "The hip surgery went well. Lucie starts university in Lyon." })]);
});

test("the phone's capture sheet offers Log an exchange, of any kind", { tag: "@phone" }, async ({ page }) => {
  const name = `Marc ${Date.now()}`;
  await page.goto("/app/people");
  await workLocally(page);
  const id = await makePerson(page, name);
  await page.getByRole("button", { name: "Capture" }).click();
  await page.getByRole("dialog", { name: "Capture" }).getByRole("button", { name: /Log an exchange/ }).click();

  const dialog = page.getByRole("dialog", { name: "Log an exchange" });
  await dialog.getByRole("combobox", { name: "With" }).fill(name);
  await page.getByRole("option", { name: new RegExp(name) }).first().click();
  await dialog.getByRole("combobox", { name: "Kind" }).click();
  await page.getByRole("option", { name: "Message", exact: true }).click();
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect.poll(() => exchangesWith(page, id)).toEqual([expect.objectContaining({ title: `Message · ${name}`, kind: "message", date: dayFromToday(0) })]);
});
