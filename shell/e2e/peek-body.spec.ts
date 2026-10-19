import { test, expect, type Page } from "@playwright/test";
import { CORE_URL } from "./support/seed";

/**
 * A Peek writes the body (ADR 0085): read until the user asks with ✎ or
 * `Ctrl+E`, then the Vault's own editor, its edits saved as there. Opened over
 * a Day in the Journal, whose own editor must not answer the Peek's shortcut.
 * An empty body offers the type's Templates.
 */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

/** Makes Notes (and Templates) through the app's own Core, over the Journal's Day, and peeks the first. */
async function peekNoteOverDay(page: Page, notes: { title: string; body: string }[], templates: { title: string; body: string }[] = []) {
  await page.goto("/app/journal");
  await workLocally(page);
  await expect(page.locator(".cm-content").first()).toBeVisible();
  await page.evaluate(
    async ({ coreUrl, notes, templates }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      for (const t of templates) await core.putDocument({ type: "template", title: t.title, forType: "note", body: t.body, folder: "Templates" });
      const made = [];
      for (const n of notes) made.push(await core.putDocument({ type: "note", title: n.title, body: n.body }));
      core.openPeek(made[0].id);
    },
    { coreUrl: CORE_URL, notes, templates },
  );
  const peek = page.getByRole("dialog", { name: notes[0].title });
  await expect(peek).toBeVisible();
  return peek;
}

test("a Peek's body is read until written; what is typed is kept, and the page's own editor is left alone", async ({ page }) => {
  const title = `Peek body ${Date.now()}`;
  const peek = await peekNoteOverDay(page, [{ title, body: "First line." }]);

  await expect(peek.getByText("First line.")).toBeVisible();
  await expect(peek.locator(".cm-content"), "read until asked").toHaveCount(0);
  const readBox = await peek.boundingBox();

  await peek.getByRole("button", { name: "Write", exact: true }).click();
  const editor = peek.locator(".cm-content");
  await expect(editor).toBeVisible();
  const viewport = page.viewportSize()!;
  if (viewport.width >= 768) await expect.poll(async () => (await peek.boundingBox())!.width, { message: "wider while writing" }).toBeGreaterThan(readBox!.width + 150);
  else await expect.poll(async () => (await peek.boundingBox())!.height, { message: "the whole height on a phone" }).toBeGreaterThan(viewport.height * 0.95);

  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" Added in the Peek.");
  await expect(editor).toContainText("First line. Added in the Peek.");

  // Ctrl+E inside the Peek goes back to reading — the Day behind keeps its editor.
  await page.keyboard.press("Control+e");
  await expect(peek.locator(".cm-content")).toHaveCount(0);
  await expect(peek.getByText("First line. Added in the Peek.")).toBeVisible();
  await expect(page.locator(".cm-content"), "the Day's editor did not toggle").toHaveCount(1);
  await page.keyboard.press("Control+e");
  await expect(peek.locator(".cm-content")).toBeVisible();
  await expect(page.locator(".cm-content")).toHaveCount(2);

  await peek.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".cm-content"), "the Day still being written").toHaveCount(1);

  await page.evaluate(
    async ({ coreUrl, title }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      const doc = ((await core.documentsOf("note")) as { id: string; title: string }[]).find((d) => d.title === title);
      core.openPeek(doc!.id);
    },
    { coreUrl: CORE_URL, title },
  );
  const again = page.getByRole("dialog", { name: title });
  await expect(again.getByText("First line. Added in the Peek.")).toBeVisible();
  await expect(again.locator(".cm-content"), "a Peek opens reading again").toHaveCount(0);
});

test("an empty body offers the type's Templates, and picking one fills it once", async ({ page }) => {
  const stamp = Date.now();
  const title = `Empty peek ${stamp}`;
  const template = `Meeting ${stamp}`;
  const peek = await peekNoteOverDay(page, [{ title, body: "" }], [{ title: template, body: "Agenda for {{title}}" }]);

  await peek.getByRole("button", { name: "Write", exact: true }).click();
  await peek.getByRole("button", { name: template }).click();
  await expect(peek.locator(".cm-content")).toContainText(`Agenda for ${title}`);
  await peek.locator(".cm-content").click();
  await page.keyboard.press("Control+z");
  await expect(peek.locator(".cm-content"), "undone like any edit").not.toContainText("Agenda for");
  await page.keyboard.press("Control+y");
  await expect(peek.locator(".cm-content")).toContainText(`Agenda for ${title}`);
  await expect(peek.getByRole("button", { name: template }), "offered only while the body is empty").toHaveCount(0);
});
