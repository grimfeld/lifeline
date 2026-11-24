import { expect, type Page } from "@playwright/test";
import { test } from "./support/test";
import { inCore } from "./support/core";
import { workLocally } from "./support/journal";

/** The one-off tidy-up of given-name aliases (ADR 0117), offered from the People home. What it proposes is givenNames.test's. */

const make = (page: Page, title: string, aliases: string[]) =>
  inCore(page, async (core, a: { title: string; aliases: string[] }) => (await core.createDocument({ type: "contacts_person", title: a.title, fields: { aliases: a.aliases } })).id as string, { title, aliases });

test("tidying applies to the People left ticked, a failed Apply is announced with the dialog open, and the offer goes once none is left", async ({ page }) => {
  await page.goto("/app/people");
  await workLocally(page);
  const anne = await make(page, "Anne Dupont", ["Anne", "Annie"]);
  await make(page, "Paul Martin", ["Paul"]);

  await page.getByRole("button", { name: "Tidy given names…" }).click();
  const dialog = page.getByRole("dialog", { name: "Tidy given names" });
  await dialog.getByRole("checkbox", { name: "Tidy Paul Martin", exact: true }).click();

  // Every write queues for push: a refused queue entry fails the write.
  await inCore(page, async (core) => {
    const refuse = () => {
      throw new Error("Disk full");
    };
    (globalThis as { e2eRefuse?: () => never }).e2eRefuse = refuse;
    core.db()._outbox.hook("creating", refuse);
  }, undefined);
  await dialog.getByRole("button", { name: "Apply to 1" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Disk full");
  await expect(dialog).toBeVisible();

  // Once writes go through again, Apply tidies Anne alone.
  await inCore(page, async (core) => {
    core.db()._outbox.hook("creating").unsubscribe((globalThis as { e2eRefuse?: () => never }).e2eRefuse!);
  }, undefined);
  await dialog.getByRole("button", { name: "Apply to 1" }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => inCore(page, async (core, i: string) => (await core.getDocument(i)) as never as { givenName?: string }, anne)).toMatchObject({ givenName: "Anne" });

  // Paul is still offered; tidy him and the offer goes.
  await page.getByRole("button", { name: "Tidy given names…" }).click();
  await page.getByRole("dialog", { name: "Tidy given names" }).getByRole("button", { name: "Apply to 1" }).click();
  await expect(page.getByRole("button", { name: "Tidy given names…" })).toHaveCount(0);
});
