import { test, expect, type Page } from "@playwright/test";
import { CORE_URL } from "./support/seed";

/**
 * The Peek's back stack (ADR 0085): following a link inside a Peek replaces
 * what it shows, with a way back, and `Ctrl+Enter` on a wikilink in an editor
 * peeks it. Driven from a Day in the Journal, where both start.
 */

const DAY_START = "Thinking about [[";

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

/** Two Thoughts, A linking to B, and today's Day linking to A — written through the app's own Core. */
async function seedDay(page: Page, stamp: string) {
  const a = `Peek A ${stamp}`;
  const b = `Peek B ${stamp}`;
  await page.goto("/app/journal");
  await workLocally(page);
  await expect(page.locator(".cm-content").first()).toBeVisible();
  await page.evaluate(
    async ({ coreUrl, a, b, start }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      const pad = (n: number) => String(n).padStart(2, "0");
      const now = new Date();
      const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      await core.putDocument({ type: "thought", title: b, body: "The end of the trail." });
      await core.putDocument({ type: "thought", title: a, body: `Leads on to [[${b}]].` });
      const day = ((await core.documentsOf("daily")) as { id: string; title: string }[]).find((d) => d.title === today);
      if (!day) throw new Error("today's Day was not made");
      await core.patchDocument(day.id, { body: `${start}${a}]] today.\n` });
    },
    { coreUrl: CORE_URL, a, b, start: DAY_START },
  );
  return { a, b };
}

/**
 * Puts the cursor inside the Day's link, a few characters into its name — by
 * keyboard, since a long link wraps on a phone and its box's centre can fall
 * outside it.
 */
async function cursorInLink(page: Page, title: string) {
  await expect(page.locator(".cm-content")).toContainText(title);
  await page.locator(".cm-content .cm-line", { hasText: "Thinking about" }).first().click();
  await page.keyboard.press("ControlOrMeta+Home");
  for (let i = 0; i < DAY_START.length + 2; i++) await page.keyboard.press("ArrowRight");
}

test("Ctrl+Enter on a link in a Day peeks it; a link inside the Peek replaces it, and back returns", async ({ page }) => {
  const { a, b } = await seedDay(page, String(Date.now()));

  await cursorInLink(page, a);
  await page.keyboard.press("ControlOrMeta+Enter");
  const peekA = page.getByRole("dialog", { name: a });
  await expect(peekA).toBeVisible();
  await expect(peekA.getByRole("button", { name: "Back" }), "nothing to go back to yet").toHaveCount(0);

  await peekA.getByRole("link", { name: b }).click();
  const peekB = page.getByRole("dialog", { name: b });
  await expect(peekB).toBeVisible();
  await expect(page.getByRole("dialog"), "a Peek never opens over another Peek").toHaveCount(1);
  await expect(page).toHaveURL(/\/app\/journal/);

  await peekB.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("dialog", { name: a })).toBeVisible();
  await expect(page.getByRole("dialog", { name: a }).getByRole("button", { name: "Back" })).toHaveCount(0);

  // Closing clears the stack: the next Peek starts anew, with nothing behind it.
  await page.getByRole("dialog", { name: a }).getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await cursorInLink(page, a);
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByRole("dialog", { name: a })).toBeVisible();
  await expect(page.getByRole("dialog", { name: a }).getByRole("button", { name: "Back" })).toHaveCount(0);
});

test("Ctrl+Enter away from a link keeps the editor's own binding", async ({ page }) => {
  await seedDay(page, String(Date.now()));
  const line = page.locator(".cm-content .cm-line", { hasText: "Thinking about" }).first();
  await expect(line).toBeVisible();
  await line.click({ position: { x: 4, y: 4 } });
  const lines = await page.locator(".cm-content .cm-line").count();
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.locator(".cm-content .cm-line")).toHaveCount(lines + 1);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
