import { test, expect, type Page } from "@playwright/test";
import { CORE_URL } from "./support/seed";

/**
 * A body's image from another site waits for a click (#270): reading the
 * body must not tell that site anything, so no request leaves until Load,
 * and "Always from …" trusts the host on this device.
 */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

const DATE = "2001-03-04";
const PIXEL = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");

async function readDay(page: Page, body: string) {
  await page.goto("/app/journal");
  await workLocally(page);
  await page.evaluate(
    async ({ coreUrl, body, date }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      await core.createDocument({ type: "daily", title: date, body });
    },
    { coreUrl: CORE_URL, body, date: DATE },
  );
  await page.goto(`/app/journal?d=${DATE}`);
  await workLocally(page);
  await page.locator(".cm-content").click();
  await page.keyboard.press("Control+e");
}

test("a remote image loads only when asked, and Always trusts its host", async ({ page }) => {
  let hits = 0;
  await page.route("https://tracker.example/**", (route) => {
    hits++;
    return route.fulfill({ contentType: "image/png", body: PIXEL });
  });
  await readDay(page, "Clipped. ![pixel](https://tracker.example/p.png)");

  const note = page.locator(".prose-note");
  await expect(note).toContainText("image from tracker.example");
  await expect(note.locator("img")).toHaveCount(0);
  expect(hits).toBe(0);

  await note.getByRole("button", { name: "Load", exact: true }).click();
  await expect(note.locator('img[src="https://tracker.example/p.png"]')).toHaveCount(1);
  await expect.poll(() => hits).toBeGreaterThan(0);

  await page.reload();
  await workLocally(page);
  await page.locator(".cm-content").click();
  await page.keyboard.press("Control+e");
  await expect(note).toContainText("image from tracker.example");
  await note.getByRole("button", { name: "Always from tracker.example" }).click();
  await page.reload();
  await workLocally(page);
  await page.locator(".cm-content").click();
  await page.keyboard.press("Control+e");
  await expect(note.locator('img[src="https://tracker.example/p.png"]')).toHaveCount(1);
});
