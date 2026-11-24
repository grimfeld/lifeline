import { expect, type Page } from "@playwright/test";
import { test } from "./support/test";
import { inCore } from "./support/core";

/** Ties between People (#412): entered once on either page, read from each side. */

const PERSON = "contacts_person";

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 8000 }).then(() => local.click(), () => {});
}

async function makePerson(page: Page, title: string): Promise<string> {
  return inCore(page, async (core, a: { type: string; title: string }) => (await core.createDocument({ type: a.type, title: a.title })).id as string, { type: PERSON, title });
}

test("a Tie entered on Anne's page reads from Léa's, is edited from there, and goes with a Person", async ({ page }) => {
  await page.goto("/app/people");
  await workLocally(page);
  const anne = await makePerson(page, "Anne");
  const lea = await makePerson(page, "Léa");

  await page.goto(`/app/people/person/${anne}`);
  await workLocally(page);
  const ties = page.getByRole("region", { name: "Ties" });
  await ties.getByRole("button", { name: "Add tie" }).click();
  const dialog = page.getByRole("dialog", { name: "Add a tie" });
  await dialog.getByRole("combobox").fill("Lé");
  await page.getByRole("option", { name: /Léa/ }).click();
  await dialog.getByLabel("Léa is Anne's…").fill("daughter");
  await dialog.getByLabel("Anne is Léa's…").fill("mother");
  await dialog.getByRole("button", { name: "Add" }).click();
  await expect(ties).toContainText("daughter: Léa");

  // Stored once.
  // (the seeded demo data holds Ties of its own: count those between these two.)
  const between = await inCore(page, async (core, ids: string[]) => (await core.documentsOf("contacts_tie")).filter((t) => ids.includes(t.a as string) && ids.includes(t.b as string)).length, [anne, lea]);
  expect(between).toBe(1);

  // Read from the other side, with the words swapped; edit it there.
  await ties.getByRole("link", { name: "Léa" }).click();
  await expect(page).toHaveURL(new RegExp(`/person/${lea}$`));
  await expect(ties).toContainText("mother: Anne");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await ties.getByRole("button", { name: "Edit mother: Anne" }).click();
  const edit = page.getByRole("dialog", { name: "Edit tie" });
  await edit.getByLabel("Anne is Léa's…").fill("mum");
  await edit.getByRole("button", { name: "Save" }).click();
  await expect(ties).toContainText("mum: Anne");
  await page.goto(`/app/people/person/${anne}`);
  await workLocally(page);
  await expect(ties).toContainText("daughter: Léa");

  // Deleting a Person takes the Tie; the other page is whole.
  await inCore(page, async (core, id: string) => core.removeDocument(id), anne);
  await page.goto(`/app/people/person/${lea}`);
  await workLocally(page);
  await expect(ties).toContainText("No ties yet.");
});

test("a preset chip fills both words and sets the kind, which survives editing a word and clears on a second tap", async ({ page }) => {
  await page.goto("/app/people");
  await workLocally(page);
  const paul = await makePerson(page, "Paul");
  const tom = await makePerson(page, "Tom");
  const lily = await makePerson(page, "Lily");
  const kindsOf = (ids: string[]) =>
    inCore(page, async (core, ids: string[]) => (await core.documentsOf("contacts_tie")).filter((t) => ids.includes(t.a as string) && ids.includes(t.b as string)).map((t) => ({ a: t.a, labelA: t.labelA, labelB: t.labelB, kind: t.kind ?? null })), ids);

  await page.goto(`/app/people/person/${paul}`);
  await workLocally(page);
  const ties = page.getByRole("region", { name: "Ties" });
  const addChild = async (name: string, chip: string) => {
    await ties.getByRole("button", { name: "Add tie" }).click();
    const dialog = page.getByRole("dialog", { name: "Add a tie" });
    await expect(dialog.getByRole("button", { name: chip, exact: true })).toHaveCount(0);
    await dialog.getByRole("combobox").fill(name);
    await page.getByRole("option", { name: new RegExp(name) }).click();
    await dialog.getByRole("button", { name: chip, exact: true }).click();
    await expect(dialog.getByRole("button", { name: chip, exact: true })).toHaveAttribute("aria-pressed", "true");
    return dialog;
  };

  // Tom, by chip: both words and the kind.
  const first = await addChild("Tom", "son");
  await expect(first.getByLabel("Tom is Paul's…")).toHaveValue("son");
  await expect(first.getByLabel("Paul is Tom's…")).toHaveValue("parent");
  await first.getByRole("button", { name: "Add", exact: true }).click();
  await expect(ties).toContainText("son: Tom");
  expect(await kindsOf([paul, tom])).toEqual([{ a: paul, labelA: "parent", labelB: "son", kind: "parent" }]);

  // Lily too; "parent" says nothing of Paul's gender, so it stays neutral (the gender reading is unit-tested).
  const second = await addChild("Lily", "daughter");
  await expect(second.getByLabel("Paul is Lily's…")).toHaveValue("parent");
  await second.getByRole("button", { name: "Add", exact: true }).click();
  await expect(ties).toContainText("daughter: Lily");

  // Editing a word keeps the kind.
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await ties.getByRole("button", { name: "Edit daughter: Lily" }).click();
  const edit = page.getByRole("dialog", { name: "Edit tie" });
  await expect(edit.getByRole("button", { name: "daughter", exact: true })).toHaveAttribute("aria-pressed", "true");
  await edit.getByLabel("Paul is Lily's…").fill("dad");
  await edit.getByRole("button", { name: "Save" }).click();
  await expect(edit).toBeHidden();
  await expect.poll(() => kindsOf([paul, lily])).toEqual([{ a: paul, labelA: "dad", labelB: "daughter", kind: "parent" }]);

  // Tapping the pressed chip clears the kind and leaves the words.
  await ties.getByRole("button", { name: "Edit daughter: Lily" }).click();
  await edit.getByRole("button", { name: "daughter", exact: true }).click();
  await expect(edit.getByRole("button", { name: "daughter", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(edit.getByLabel("Lily is Paul's…")).toHaveValue("daughter");
  await edit.getByRole("button", { name: "Save" }).click();
  await expect(edit).toBeHidden();
  await expect.poll(() => kindsOf([paul, lily])).toEqual([{ a: paul, labelA: "dad", labelB: "daughter", kind: null }]);
});

test("the Ties that follow are suggested: Add one from Lily's page, and a Dismiss stays gone after a reload", async ({ page }) => {
  await page.goto("/app/people");
  await workLocally(page);
  const [paul, tom, lily, alice] = [await makePerson(page, "Paul"), await makePerson(page, "Tom"), await makePerson(page, "Lily"), await makePerson(page, "Alice")];
  const tieUp = (a: string, b: string, labelA: string, labelB: string, kind: string) =>
    inCore(page, async (core, t: Record<string, string>) => void (await core.putDocument({ type: "contacts_tie", title: "", ...t } as never)), { a, b, labelA, labelB, kind });
  await tieUp(paul, tom, "father", "son", "parent");
  await tieUp(paul, lily, "father", "daughter", "parent");

  // Lily's card suggests her brother; Add makes it a real Tie on both pages.
  await page.goto(`/app/people/person/${lily}`);
  await workLocally(page);
  const ties = page.getByRole("region", { name: "Ties" });
  const suggested = ties.getByRole("group", { name: "Suggested" });
  await expect(suggested).toContainText("Tom is Lily's brother");
  await suggested.getByRole("button", { name: "Add Tom as Lily's brother", exact: true }).click();
  await expect(ties).toContainText("brother: Tom");
  await expect(suggested).toBeHidden();
  await ties.getByRole("link", { name: "Tom", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/person/${tom}$`));
  await expect(ties).toContainText("sister: Lily");
  await expect(suggested).toBeHidden();

  // Paul's wife Alice follows as their mother: two on Tom's card, so Add all shows; Dismiss one from Lily's.
  await tieUp(alice, paul, "wife", "husband", "partner");
  await expect(suggested).toContainText("Alice is Tom's mother");
  await page.goto(`/app/people/person/${lily}`);
  await workLocally(page);
  await expect(suggested).toContainText("Alice is Lily's mother");
  await suggested.getByRole("button", { name: "Dismiss Alice as Lily's mother", exact: true }).click();
  await expect(suggested).toBeHidden();
  await expect(page.getByText("Dismissed the suggestion", { exact: false })).toBeVisible();
  await page.reload();
  await workLocally(page);
  await expect(ties).toContainText("brother: Tom");
  await expect(suggested).toBeHidden();
});
