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

test("each row's checkbox is named with what Apply will change", async ({ page }) => {
  await page.goto("/app/people");
  await workLocally(page);
  await make(page, "Anne Dupont", ["Anne", "Annie"]);
  await page.getByRole("button", { name: "Tidy given names…" }).click();
  const dialog = page.getByRole("dialog", { name: "Tidy given names" });
  await expect(dialog.getByRole("checkbox", { name: /Anne Dupont.*Given name Anne.*Family name Dupont.*drops alias Anne/ })).toBeVisible();
});

test("a failed Apply is announced, and the dialog stays open", async ({ page }) => {
  await page.goto("/app/people");
  await workLocally(page);
  await make(page, "Anne Dupont", ["Anne"]);
  await page.getByRole("button", { name: "Tidy given names…" }).click();
  const dialog = page.getByRole("dialog", { name: "Tidy given names" });
  // Every write queues for push: a refused queue entry fails the write.
  await inCore(page, async (core) => {
    core.db()._outbox.hook("creating", () => {
      throw new Error("Disk full");
    });
  }, undefined);
  await dialog.getByRole("button", { name: "Apply to 1" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Disk full");
  await expect(dialog).toBeVisible();
});
