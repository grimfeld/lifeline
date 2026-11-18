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

test("an Exchange stands on its People's Timeline, names others as mentioned, gets a line in its Day's Daylog and stays off the Calendar", async ({ page }) => {
  const stamp = Date.now();
  const grandma = `Grandma ${stamp}`;
  const lucie = `Lucie ${stamp}`;
  // A day nothing else in the store uses, and today.
  const DAY = "1998-07-14";
  await page.goto("/app/people");
  await workLocally(page);
  const g = await makePerson(page, grandma);
  const l = await makePerson(page, lucie);
  await inCore(
    page,
    async (core, a: { type: string; g: string; lucie: string; day: string }) => {
      await core.createDocument({ type: a.type, title: "", body: `[[${a.lucie}]] starts university in Lyon.`, fields: { kind: "call", date: a.day, with: [a.g] } });
      await core.createDocument({ type: a.type, title: "", body: "", fields: { kind: "message", date: core.todayStr(), with: [a.g] } });
      await core.createDocument({ type: "daily", title: a.day, body: "```daylog\n```\n" });
      // An Event with her today: the Calendar shows it, and not the Exchange beside it.
      await core.createDocument({ type: "event", title: `Lunch ${a.g}`, fields: { date: core.todayStr(), with: [a.g] } });
    },
    { type: EXCHANGE, g, lucie, day: DAY },
  );

  await page.goto(`/app/people/person/${g}`);
  await workLocally(page);
  const timeline = page.getByRole("region", { name: "Timeline" });
  await expect(timeline).toContainText(`Call · ${grandma}`);
  await expect(timeline).toContainText(`Message · ${grandma}`);
  await expect(timeline).toContainText("via With");

  await page.goto(`/app/people/person/${l}`);
  await workLocally(page);
  await expect(page.getByRole("region", { name: "Timeline" })).toContainText(`Call · ${grandma}`);
  await expect(page.getByRole("region", { name: "Timeline" })).toContainText("mentioned");

  await page.goto(`/app/journal?d=${DAY}`);
  await workLocally(page);
  const line = page.getByRole("listitem").filter({ hasText: grandma });
  await expect(line).toContainText("Called");

  await page.goto("/calendar?view=month");
  await workLocally(page);
  await expect(page.getByText(`Lunch ${g}`).first()).toBeVisible();
  await expect(page.getByText(`Message · ${grandma}`)).toHaveCount(0);
});

test("an Exchange opened from the Timeline is edited in its Peek, retitled, and deleted with Undo", async ({ page }) => {
  const name = `Léa ${Date.now()}`;
  await page.goto("/app/people");
  await workLocally(page);
  const id = await makePerson(page, name);
  await inCore(page, async (core, a: { type: string; id: string }) => void (await core.createDocument({ type: a.type, title: "", body: "She got the job.", fields: { kind: "call", date: core.addDays(core.todayStr(), -3), with: [a.id] } })), { type: EXCHANGE, id });
  await page.goto(`/app/people/person/${id}`);
  await workLocally(page);

  await page.getByRole("region", { name: "Timeline" }).getByText(`Call · ${name}`).click();
  const peek = page.getByRole("dialog", { name: `Call · ${name}` });
  await expect(peek).toContainText("She got the job.");
  await peek.getByRole("combobox", { name: "Kind" }).click();
  await page.getByRole("option", { name: "Video call", exact: true }).click();
  await expect(page.getByRole("dialog", { name: `Video call · ${name}` })).toBeVisible();
  await expect.poll(() => exchangesWith(page, id)).toEqual([expect.objectContaining({ kind: "video", title: `Video call · ${name}` })]);

  await page.getByRole("dialog", { name: `Video call · ${name}` }).getByRole("button", { name: "Delete exchange" }).click();
  await expect.poll(() => exchangesWith(page, id)).toEqual([]);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => exchangesWith(page, id)).toEqual([expect.objectContaining({ title: `Video call · ${name}`, body: "She got the job." })]);
});

test("a Person's page shows Last time: the newest Exchange or Event with text, clamped with More, and nothing when there is none", async ({ page }) => {
  const name = `Anne ${Date.now()}`;
  await page.goto("/app/people");
  await workLocally(page);
  const id = await makePerson(page, name);
  await page.goto(`/app/people/person/${id}`);
  await workLocally(page);
  await expect(page.getByRole("region", { name: "Last time" })).toHaveCount(0);

  const long = Array.from({ length: 30 }, (_, i) => `Line ${i + 1} of what she said.`).join("\n");
  await inCore(
    page,
    async (core, a: { type: string; id: string; long: string }) => {
      const day = (n: number) => core.addDays(core.todayStr(), n);
      await core.createDocument({ type: a.type, title: "", body: "Older news.", fields: { kind: "message", date: day(-9), with: [a.id] } });
      // Newer, but nothing said: it is not Last time.
      await core.createDocument({ type: a.type, title: "", body: "", fields: { kind: "call", date: day(-1), with: [a.id] } });
      await core.createDocument({ type: a.type, title: "", body: a.long, fields: { kind: "video", date: day(-3), with: [a.id] } });
    },
    { type: EXCHANGE, id, long },
  );

  const block = page.getByRole("region", { name: "Last time" });
  await expect(block).toContainText("Video call");
  await expect(block).toContainText("3 days ago");
  await expect(block).toContainText("Line 1 of what she said.");
  await expect(block).not.toContainText("Older news.");
  const text = block.getByText("Line 1 of what she said.");
  const clamped = (await text.boundingBox())!.height;
  await block.getByRole("button", { name: "More" }).click();
  await expect.poll(async () => (await text.boundingBox())!.height).toBeGreaterThan(clamped * 4);
  await block.getByRole("button", { name: "Less" }).click();
  await expect(block.getByRole("button", { name: "More" })).toBeVisible();

  // An Event's Notes count too, once it is newer.
  await inCore(page, async (core, a: { id: string }) => void (await core.createDocument({ type: "event", title: "Coffee", fields: { date: core.addDays(core.todayStr(), -2), with: [a.id], notes: "She moved to Lyon." } })), { id });
  await expect(block).toContainText("Event · Coffee");
  await expect(block).toContainText("She moved to Lyon.");
  await expect(block.getByRole("button", { name: "More" })).toHaveCount(0);
});
