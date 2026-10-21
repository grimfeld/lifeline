import { expect, type Page } from "@playwright/test";

/** The palette's input; present only while the palette is open (or closing). */
const input = (page: Page) => page.locator('[data-slot="command-input"]');

/**
 * Opens the command palette with Mod+K. The `desktop` project runs "Desktop Chrome"
 * (Windows user agent), so the app listens for Control: never the cross-platform modifier alias, which
 * presses ⌘ on a Mac host. Waits for any palette still open or closing first, since
 * Mod+K on an open palette closes it, then for the input to take focus.
 */
export async function openPalette(page: Page) {
  await expect(input(page)).toHaveCount(0);
  await page.keyboard.press("Control+k");
  await expect(input(page)).toBeFocused();
}
