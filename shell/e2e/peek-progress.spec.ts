import { expect, type Page } from "@playwright/test";
import { test } from "./support/test";
import { inCore, type Core } from "./support/core";

/**
 * An editable Peek (ADR 0085), the guarded-field pattern: a Stat is edited
 * where it is peeked, through the App's own controls, its edit persists, and
 * its guarded kind stays fixed. Each App's one-field edits are component
 * tests of its Peek part (`@lifeline/parts/testing`, #561).
 */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

/** Put the Documents `make` returns the id of, then open its Peek over the Vault. */
async function peekNew(page: Page, make: (core: Core, stamp: number) => Promise<string>) {
  await page.goto("/vault");
  await workLocally(page);
  const id = await inCore(page, make, Date.now());
  await inCore(page, async (core, docId: string) => core.openPeek(docId), id);
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  return { id, dialog };
}

const field = (page: Page, id: string, key: string) => inCore(page, async (core, a: { id: string; key: string }) => (await core.getDocument(a.id))?.[a.key], { id, key });

test("Stats: a Stat's unit is edited in its Peek; its kind stays fixed", async ({ page }) => {
  const { id, dialog } = await peekNew(page, async (core, stamp) => (await core.putDocument({ type: "stat", title: `Push-ups ${stamp}`, kind: "additive", unit: "reps", color: "blue", defaultIncrement: 10 })).id);
  await dialog.getByLabel("Unit").fill("sets");
  // Written on leaving the field (Escape in it would put the stored value back).
  await dialog.getByLabel("Unit").blur();
  await expect.poll(() => field(page, id, "unit")).toBe("sets");
  expect(await field(page, id, "kind")).toBe("additive");
});
