import type { Locator } from "@playwright/test";

/**
 * Set a kit Time field the way a person does: type the time into it and press
 * Enter. `text` is anything the field reads — "14:30", "930", "2pm" — so specs
 * don't depend on the quarter-hour list's markup or the browser's 12h/24h clock.
 */
export async function setTime(field: Locator, text: string) {
  await field.fill(text);
  await field.press("Enter");
}
