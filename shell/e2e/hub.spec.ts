import { test, expect, type Page } from "@playwright/test";

/**
 * The Hub (ADR 0133, spec #661): on the desk, Modules and Surfaces open as
 * Windows on a stage, each keeping its own place; the URL is the front
 * Window's route.
 */

const hub = (page: Page) => page.getByRole("navigation", { name: "Hub" });
const win = (page: Page, name: string) => page.getByRole("region", { name, exact: true });

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

/** A fresh desk: the Calendar open, then everything closed. */
async function emptyDesk(page: Page) {
  await page.goto("/calendar");
  await workLocally(page);
  await expect(win(page, "Calendar")).toBeVisible();
  // The signed-out notice can land late and cover the page: dismiss it and close until the stage is empty.
  await expect(async () => {
    await workLocally(page);
    for (const close of await page.getByRole("button", { name: /^Close / }).all()) await close.click({ timeout: 2000 });
    await expect(page.getByText("Nothing is open.")).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 20_000 });
}

test.describe("The Hub", () => {
  test("the index opens two Modules as two Windows; picking an open one brings it to the front", async ({ page }) => {
    await emptyDesk(page);
    await expect(page.getByRole("navigation", { name: "Rail" })).toHaveCount(0);
    await hub(page).getByRole("link", { name: "Calendar" }).click();
    await expect(win(page, "Calendar")).toBeVisible();
    await expect(page).toHaveURL(/\/calendar/);
    await hub(page).getByRole("link", { name: "Map" }).click();
    await expect(win(page, "Map")).toBeVisible();
    await expect(win(page, "Calendar")).toBeAttached();
    await expect(page).toHaveURL(/\/map/);
    await expect(hub(page).getByRole("link", { name: "Map" })).toHaveAttribute("aria-current", "page");

    // Picking the open Calendar focuses it; no second Window.
    await hub(page).getByRole("link", { name: "Calendar" }).click();
    await expect(page).toHaveURL(/\/calendar/);
    await expect(page.getByRole("region", { name: "Calendar" })).toHaveCount(1);
    await expect(hub(page).getByRole("link", { name: "Calendar" })).toHaveAttribute("aria-current", "page");
  });

  test("closing the last Window shows the empty stage; reloading restores the Windows", async ({ page }) => {
    await emptyDesk(page);
    await hub(page).getByRole("link", { name: "Graph" }).click();
    await hub(page).getByRole("link", { name: "Calendar" }).click();
    await expect(win(page, "Calendar")).toBeVisible();
    await page.reload();
    await workLocally(page);
    await expect(win(page, "Graph")).toBeAttached();
    await expect(win(page, "Calendar")).toBeVisible();
    await expect(page).toHaveURL(/\/calendar/);
    await win(page, "Calendar").getByRole("button", { name: "Close Calendar" }).click();
    await expect(page).toHaveURL(/\/graph/);
    await win(page, "Graph").getByRole("button", { name: "Close Graph" }).click();
    await expect(page.getByText("Nothing is open.")).toBeVisible();
  });

  test("a Window moves by its bar and sizes from its corner, within limits", async ({ page }) => {
    await emptyDesk(page);
    await hub(page).getByRole("link", { name: "Map" }).click();
    const map = win(page, "Map");
    await expect(map).toBeVisible();
    const before = (await map.boundingBox())!;
    const bar = map.locator("[data-window-bar]");
    const b = (await bar.boundingBox())!;
    await page.mouse.move(b.x + 40, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + 140, b.y + b.height / 2 + 60, { steps: 5 });
    await page.mouse.up();
    await expect.poll(async () => Math.round((await map.boundingBox())!.x - before.x)).toBe(100);

    // Sizing never goes below 320 × 240.
    const corner = map.locator("[data-window-corner]");
    const c = (await corner.boundingBox())!;
    await page.mouse.move(c.x + 4, c.y + 4);
    await page.mouse.down();
    await page.mouse.move(c.x - 2000, c.y - 2000, { steps: 5 });
    await page.mouse.up();
    await expect.poll(async () => Math.round((await map.boundingBox())!.width)).toBe(320);
    expect(Math.round((await map.boundingBox())!.height)).toBe(240);
  });

  test("each Window keeps its own route; a link opens or focuses its Module's Window", async ({ page }) => {
    await emptyDesk(page);
    await page.goto("/calendar?view=week");
    await workLocally(page);
    await expect(win(page, "Calendar")).toBeVisible();
    await page.goto("/map");
    await workLocally(page);
    await expect(win(page, "Map")).toBeVisible();
    await hub(page).getByRole("link", { name: "Calendar" }).click();
    await expect(page).toHaveURL(/\/calendar\?view=week/);
  });

  test("a narrow Window shows its narrow layout without the Phone bar", async ({ page }) => {
    await emptyDesk(page);
    await hub(page).getByRole("link", { name: "Settings" }).click();
    const settings = win(page, "Settings");
    await expect(settings).toBeVisible();
    const corner = settings.locator("[data-window-corner]");
    const c = (await corner.boundingBox())!;
    await page.mouse.move(c.x + 4, c.y + 4);
    await page.mouse.down();
    await page.mouse.move(c.x - 2000, c.y, { steps: 5 });
    await page.mouse.up();
    await expect.poll(async () => Math.round((await settings.boundingBox())!.width)).toBe(320);
    await expect(page.getByRole("navigation", { name: "Phone bar" })).toHaveCount(0);
  });

  test("Back and Forward move within the front Window, after another has been in front", async ({ page }) => {
    await page.goto("/calendar?view=week");
    await workLocally(page);
    const calendar = win(page, "Calendar");
    await calendar.getByRole("tab", { name: "Day", exact: true }).click();
    await expect(page).toHaveURL(/view=day/);
    await calendar.getByRole("tab", { name: "Month", exact: true }).click();
    await expect(page).toHaveURL(/view=month/);
    await hub(page).getByRole("link", { name: "Map" }).click();
    await expect(page).toHaveURL(/\/map/);
    await expect(hub(page).getByRole("link", { name: "Map" })).toHaveAttribute("aria-current", "page");
    await hub(page).getByRole("link", { name: "Calendar" }).click();
    await expect(page).toHaveURL(/view=month/);

    await page.goBack();
    await expect(page).toHaveURL(/view=day/);
    await expect(hub(page).getByRole("link", { name: "Calendar" })).toHaveAttribute("aria-current", "page");
    await expect(win(page, "Map")).toBeAttached();
    await page.goForward();
    await expect(page).toHaveURL(/view=month/);
    await expect(hub(page).getByRole("link", { name: "Calendar" })).toHaveAttribute("aria-current", "page");
  });

  test("a Window behind another can be dragged by its bar, and comes to the front", async ({ page }) => {
    await emptyDesk(page);
    await hub(page).getByRole("link", { name: "Map" }).click();
    await hub(page).getByRole("link", { name: "Graph" }).click();
    await expect(win(page, "Graph")).toBeVisible();
    const map = win(page, "Map");
    const before = (await map.boundingBox())!;
    // The cascade leaves the left of Map's bar uncovered.
    await page.mouse.move(before.x + 12, before.y + 18);
    await page.mouse.down();
    await page.mouse.move(before.x + 112, before.y + 78, { steps: 5 });
    await page.mouse.up();
    await expect.poll(async () => Math.round((await map.boundingBox())!.x - before.x)).toBe(100);
    await expect(hub(page).getByRole("link", { name: "Map" })).toHaveAttribute("aria-current", "page");
  });
});
