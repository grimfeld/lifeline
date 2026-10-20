import { test, expect, type Page } from "@playwright/test";
import { CORE_URL } from "./support/seed";

/**
 * Inline arguments in the palette (ADR 0091, #232): `!` marks a Command, each
 * argument carries its own mark, a preview row shows what was understood, and
 * Enter runs a complete headless Command — or opens its dialog.
 */
test.describe("Palette · inline arguments (#232)", () => {
  // The palette is opened with Mod+K, on the desk only (ADR 0021).
  test.skip(({ isMobile }) => isMobile, "the palette is not opened on a phone");

  async function workLocally(page: Page) {
    const local = page.getByRole("button", { name: "Work locally" });
    await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
  }

  const palette = (page: Page) => page.getByRole("dialog").getByRole("combobox");
  const options = (page: Page) => page.getByRole("dialog").getByRole("option");

  async function openPalette(page: Page) {
    await page.goto("/screens");
    await workLocally(page);
    await page.keyboard.press("Control+k");
    await expect(palette(page)).toBeFocused();
  }

  async function titled(page: Page, title: string) {
    return page.evaluate(
      async ({ coreUrl, title }) => {
        const core = await import(/* @vite-ignore */ coreUrl);
        return ((await core.allDocuments()) as { type: string; title: string; tags?: string[] }[]).filter((d) => d.title === title).map((d) => ({ type: d.type, tags: d.tags ?? [] }));
      },
      { coreUrl: CORE_URL, title },
    );
  }

  test("! suggests Commands, narrows as typed, and Enter puts the picked one in the line", async ({ page }) => {
    await openPalette(page);
    await palette(page).pressSequentially("call mum !ta");
    await expect(options(page).first()).toContainText("Add task");
    await page.keyboard.press("Enter");
    await expect(palette(page)).toHaveValue("call mum !add-task ");
    await expect(page.getByTestId("inline-preview")).toContainText("Add task · call mum");
  });

  test("a complete line previews each argument, and Enter records it", async ({ page }) => {
    const title = `call mum ${Date.now()}`;
    await openPalette(page);
    await palette(page).fill(`!task ${title} #family`);
    await expect(options(page).first()).toContainText(`Add task · ${title} · #family`);
    await page.keyboard.press("Enter");
    await expect(palette(page)).toHaveCount(0);
    await expect.poll(() => titled(page, title)).toEqual([{ type: expect.any(String), tags: ["family"] }]);
  });

  test("a refusal is shown in the palette and nothing is written", async ({ page }) => {
    const thing = `Oat milk ${Date.now()}`;
    await openPalette(page);
    await palette(page).fill(`!need "${thing}"`);
    await page.keyboard.press("Enter");
    await expect.poll(() => titled(page, thing).then((l) => l.length)).toBe(1);
    await page.keyboard.press("Control+k");
    await palette(page).fill(`!need "${thing}"`);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText("already on the shopping list");
    expect(await titled(page, thing)).toHaveLength(1);
  });

  test("a missing argument opens the Command's dialog", async ({ page }) => {
    await openPalette(page);
    await palette(page).fill("!task #family");
    await expect(options(page).first()).toContainText("Missing title");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: "New task" })).toBeVisible();
  });
});
