import type { Page } from "@playwright/test";

/**
 * Presses the editor's Mod chord (CodeMirror's `Mod-`): Meta where the browser reports a Mac
 * platform, Control elsewhere. The `desktop` project fakes only the user agent, not
 * `navigator.platform`, so on a Mac host the editor wants ⌘. This is not the palette's key:
 * the app sniffs the user agent there, so use `openPalette`.
 */
export async function pressMod(page: Page, chord: string) {
  const mac = await page.evaluate(() => /^Mac/.test(navigator.platform));
  await page.keyboard.press(`${mac ? "Meta" : "Control"}+${chord}`);
}
