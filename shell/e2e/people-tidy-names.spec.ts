import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";
import { workLocally } from "./support/journal";

/** The one-off tidy-up of given-name aliases (ADR 0117), offered from the People home. */

const make = (page: Page, title: string, aliases: string[]) =>
  inCore(page, async (core, a: { title: string; aliases: string[] }) => (await core.createDocument({ type: "contacts_person", title: a.title, fields: { aliases: a.aliases } })).id as string, { title, aliases });

test("tidying fills the names, drops the duplicated alias, and the offer goes", async ({ page }) => {
  await page.goto("/app/people");
  await workLocally(page);
  const anne = await make(page, "Anne Dupont", ["Anne", "Annie"]);
  const skip = await make(page, "Paul Martin", ["Paul"]);

  await page.getByRole("button", { name: "Tidy given names…" }).click();
  const dialog = page.getByRole("dialog", { name: "Tidy given names" });
  await expect(dialog).toContainText("Given name Anne · Family name Dupont · drops alias Anne");
  await dialog.getByRole("checkbox", { name: "Tidy Paul Martin" }).click();
  await dialog.getByRole("button", { name: "Apply to 1" }).click();
  await expect(dialog).toBeHidden();

  const stored = await inCore(page, async (core, ids: string[]) => Promise.all(ids.map(async (i) => core.getDocument(i))), [anne, skip]);
  expect(stored[0]).toMatchObject({ givenName: "Anne", familyName: "Dupont", aliases: ["Annie"] });
  expect(stored[1]).toMatchObject({ aliases: ["Paul"] });
  expect(stored[1]!.givenName ?? "").toBe("");

  // Paul is still offered; tidy him and the offer goes.
  await page.getByRole("button", { name: "Tidy given names…" }).click();
  await page.getByRole("dialog", { name: "Tidy given names" }).getByRole("button", { name: "Apply to 1" }).click();
  await expect(page.getByRole("button", { name: "Tidy given names…" })).toHaveCount(0);
});
