import { expect, type Page } from "@playwright/test";
import { test } from "./support/test";
import { pressMod } from "./support/keys";
import { CORE_URL } from "./support/seed";

/**
 * A Peek opened by `Ctrl+Enter` on a wikilink in a Day's editor hands the
 * focus back to the editor when it closes. The back stack inside a Peek and
 * which keys peek a link are unit tests (core's peek.test.ts, the editor's peekLink.test.ts).
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
  await pressMod(page, "Home");
  for (let i = 0; i < DAY_START.length + 2; i++) await page.keyboard.press("ArrowRight");
}

test("a Peek opened from a link by keyboard gives focus back to where it came from on Escape", async ({ page }) => {
  const { a } = await seedDay(page, String(Date.now()));
  await cursorInLink(page, a);
  await pressMod(page, "Enter");
  await expect(page.getByRole("dialog", { name: a })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // Opened without a Trigger, so not Radix's own return: the editor it came from (WCAG 2.4.3).
  await expect(page.locator(".cm-content").first()).toBeFocused();
});
