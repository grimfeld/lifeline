import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";

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
    await hub(page).getByRole("link", { name: "Calendar" }).click();
    const calendar = win(page, "Calendar");
    await expect(calendar).toBeVisible();
    const corner = calendar.locator("[data-window-corner]");
    const c = (await corner.boundingBox())!;
    await page.mouse.move(c.x + 4, c.y + 4);
    await page.mouse.down();
    await page.mouse.move(c.x - 2000, c.y, { steps: 5 });
    await page.mouse.up();
    await expect.poll(async () => Math.round((await calendar.boundingBox())!.width)).toBe(320);
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

  test.describe("snapping", () => {
    const stageBox = async (page: Page) => (await page.locator("[data-hub-stage]").boundingBox())!;
    const near = (a: number, b: number) => Math.abs(a - b) <= 2;

    test("dragging to the left edge shows the outline and fills the left half; dragging away restores the size", async ({ page }) => {
      await emptyDesk(page);
      await hub(page).getByRole("link", { name: "Map" }).click();
      const map = win(page, "Map");
      await expect(map).toBeVisible();
      const before = (await map.boundingBox())!;
      const stage = await stageBox(page);
      const bar = (await map.locator("[data-window-bar]").boundingBox())!;
      await page.mouse.move(bar.x + 30, bar.y + 18);
      await page.mouse.down();
      await page.mouse.move(stage.x + 5, stage.y + stage.height / 2, { steps: 8 });
      await expect(page.locator("[data-snap-outline]")).toBeVisible();
      await page.mouse.up();
      await expect(page.locator("[data-snap-outline]")).toHaveCount(0);
      await expect.poll(async () => {
        const b = (await map.boundingBox())!;
        return near(b.x, stage.x) && near(b.y, stage.y) && near(b.width, stage.width / 2) && near(b.height, stage.height);
      }).toBe(true);

      // Away from the edge: the size it had before the snap.
      const snapped = (await map.locator("[data-window-bar]").boundingBox())!;
      await page.mouse.move(snapped.x + 30, snapped.y + 18);
      await page.mouse.down();
      await page.mouse.move(stage.x + stage.width / 2, stage.y + stage.height / 2, { steps: 8 });
      await page.mouse.up();
      await expect.poll(async () => Math.round((await map.boundingBox())!.width)).toBe(Math.round(before.width));
      expect(Math.round((await map.boundingBox())!.height)).toBe(Math.round(before.height));
    });

    test("the bar's snap buttons fill a half, a double-click maximises and restores, and a reload keeps the snap", async ({ page }) => {
      await emptyDesk(page);
      await hub(page).getByRole("link", { name: "Graph" }).click();
      const graph = win(page, "Graph");
      await expect(graph).toBeVisible();
      const stage = await stageBox(page);
      const before = (await graph.boundingBox())!;
      await graph.getByRole("button", { name: "Snap right half" }).click();
      const isRightHalf = async () => {
        const b = (await graph.boundingBox())!;
        return near(b.x, stage.x + stage.width / 2) && near(b.width, stage.width / 2) && near(b.height, stage.height);
      };
      await expect.poll(isRightHalf).toBe(true);

      // A double-click restores a snapped Window to the box it had; on a normal one it maximises, then restores.
      const title = graph.locator("[data-window-bar] > span");
      await title.dblclick();
      await expect.poll(async () => Math.round((await graph.boundingBox())!.width)).toBe(Math.round(before.width));
      await title.dblclick();
      await expect.poll(async () => near((await graph.boundingBox())!.width, stage.width)).toBe(true);
      await title.dblclick();
      await expect.poll(async () => Math.round((await graph.boundingBox())!.width)).toBe(Math.round(before.width));

      await graph.getByRole("button", { name: "Snap left half" }).click();
      await page.reload();
      await workLocally(page);
      await expect.poll(async () => {
        const b = (await win(page, "Graph").boundingBox())!;
        return near(b.x, stage.x) && near(b.width, stage.width / 2);
      }).toBe(true);
    });

    test("a click or a small wobble on a maximised Window's bar leaves it maximised", async ({ page }) => {
      await page.goto("/calendar");
      await workLocally(page);
      const calendar = win(page, "Calendar");
      const stage = await stageBox(page);
      await expect.poll(async () => near((await calendar.boundingBox())!.width, stage.width)).toBe(true);
      const bar = (await calendar.locator("[data-window-bar]").boundingBox())!;
      await page.mouse.move(bar.x + 40, bar.y + 18);
      await page.mouse.down();
      await page.mouse.move(bar.x + 42, bar.y + 19, { steps: 2 });
      await page.mouse.up();
      await page.mouse.move(bar.x + 40, bar.y + 18);
      await page.mouse.down();
      await page.mouse.move(bar.x + 52, bar.y + 20, { steps: 3 });
      await page.mouse.up();
      await expect(page.locator("[data-snap-outline]")).toHaveCount(0);
      const after = (await calendar.boundingBox())!;
      expect(near(after.width, stage.width) || after.width < stage.width).toBe(true);
      expect(near(after.width, stage.width / 2)).toBe(false);
    });
  });

  test.describe("maximise, full screen and full-screen pages", () => {
    const stageBox = async (page: Page) => (await page.locator("[data-hub-stage]").boundingBox())!;
    const near = (a: number, b: number) => Math.abs(a - b) <= 2;

    test("Maximise fills the stage and keeps the Hub; Restore puts the Window back", async ({ page }) => {
      await emptyDesk(page);
      await hub(page).getByRole("link", { name: "Map" }).click();
      const map = win(page, "Map");
      const before = (await map.boundingBox())!;
      await map.getByRole("button", { name: "Maximise" }).click();
      const stage = await stageBox(page);
      await expect.poll(async () => near((await map.boundingBox())!.width, stage.width)).toBe(true);
      await expect(hub(page)).toBeVisible();
      await map.getByRole("button", { name: "Restore" }).click();
      await expect.poll(async () => Math.round((await map.boundingBox())!.width)).toBe(Math.round(before.width));
    });

    test("full screen hides the Hub; Esc or Hub · Esc brings it back, and a reload keeps it", async ({ page }) => {
      await emptyDesk(page);
      await hub(page).getByRole("link", { name: "Graph" }).click();
      const graph = win(page, "Graph");
      const before = (await graph.boundingBox())!;
      await graph.getByRole("button", { name: "Full screen" }).click();
      await expect(hub(page)).toHaveCount(0);
      const display = await page.evaluate(() => document.documentElement.clientWidth);
      await expect.poll(async () => near((await graph.boundingBox())!.width, display)).toBe(true);
      await page.keyboard.press("Escape");
      await expect(hub(page)).toBeVisible();
      await expect.poll(async () => Math.round((await graph.boundingBox())!.width)).toBe(Math.round(before.width));

      await graph.getByRole("button", { name: "Full screen" }).click();
      await page.reload();
      await workLocally(page);
      await expect(win(page, "Graph")).toBeVisible();
      await expect(hub(page)).toHaveCount(0);
      await win(page, "Graph").getByRole("button", { name: "Hub · Esc" }).click();
      await expect(hub(page)).toBeVisible();
    });

    test("Settings and Bases open full screen over the Hub, never as Windows; Esc and the close button return to the Hub as it was", async ({ page }) => {
      await emptyDesk(page);
      await hub(page).getByRole("link", { name: "Map" }).click();
      await expect(page).toHaveURL(/\/map/);
      await hub(page).getByRole("link", { name: "Settings" }).click();
      const settings = page.getByRole("region", { name: "Settings", exact: true });
      await expect(settings).toBeVisible();
      await expect(page.locator("[data-window]")).toHaveCount(1);
      await page.keyboard.press("Escape");
      await expect(settings).toHaveCount(0);
      await expect(page).toHaveURL(/\/map/);
      await expect(win(page, "Map")).toBeVisible();

      await page.getByRole("link", { name: "Bases" }).click();
      const bases = page.locator("[data-full-page]");
      await expect(bases).toBeVisible();
      // A reload opens it again over the Hub.
      await page.reload();
      await workLocally(page);
      await expect(page.locator("[data-full-page]")).toBeVisible();
      await page.locator("[data-full-page]").getByRole("button", { name: /^Close / }).click();
      await expect(page.locator("[data-full-page]")).toHaveCount(0);
      await expect(page).toHaveURL(/\/map/);
      await expect(page.locator("[data-window]")).toHaveCount(1);

      // From the palette over a Window: the Vault opens over the Hub too, and a Module's route opens its Window.
      await page.keyboard.press("Control+k");
      await page.getByRole("combobox").fill("Go to Vault");
      await page.getByRole("option", { name: /Go to Vault/ }).first().click();
      await expect(page.locator("[data-full-page]")).toBeVisible();
      await expect(page).toHaveURL(/\/vault/);
      await page.keyboard.press("Control+k");
      await page.getByRole("combobox").fill("Go to Graph");
      await page.getByRole("option", { name: /Go to Graph/ }).first().click();
      await expect(page.locator("[data-full-page]")).toHaveCount(0);
      await expect(win(page, "Graph")).toBeVisible();
    });

    test("a Peek opens above a Window and above a full-screen page", async ({ page }) => {
      await page.goto("/calendar");
      await workLocally(page);
      await expect(win(page, "Calendar")).toBeVisible();
      const id = await inCore(page, async (core) => (await core.createDocument({ type: "contacts_person", title: "Hub Peek Person" })).id as string, null);
      await inCore(page, async (core, docId: string) => core.openPeek(docId), id);
      const peek = page.getByRole("dialog").first();
      await expect(peek).toBeVisible();
      await peek.getByText("Hub Peek Person").first().click();
      await page.keyboard.press("Escape");
      await expect(peek).toHaveCount(0);
      // Esc went to the Peek, not to the Hub: the Calendar stays.
      await expect(win(page, "Calendar")).toBeVisible();

      await page.goto("/settings");
      await workLocally(page);
      await expect(page.locator("[data-full-page]")).toBeVisible();
      await inCore(page, async (core, docId: string) => core.openPeek(docId), id);
      await expect(page.getByRole("dialog").first()).toBeVisible();
      await page.getByRole("dialog").first().getByText("Hub Peek Person").first().click();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.locator("[data-full-page]")).toBeVisible();
    });

    test("the palette offers the Window Commands only with a Window open, and a bound one acts on the front Window", async ({ page }) => {
      await emptyDesk(page);
      await page.keyboard.press("Control+k");
      await page.getByRole("combobox").fill("Snap Window left");
      await expect(page.getByRole("option", { name: /Snap Window left/ })).toHaveCount(0);
      await page.keyboard.press("Escape");

      await hub(page).getByRole("link", { name: "Map" }).click();
      await hub(page).getByRole("link", { name: "Graph" }).click();
      await expect(win(page, "Graph")).toBeVisible();
      await page.keyboard.press("Control+k");
      await page.getByRole("combobox").fill("Snap Window left");
      await page.getByRole("option", { name: /Snap Window left/ }).first().click();
      const stage = await stageBox(page);
      await expect.poll(async () => {
        const b = (await win(page, "Graph").boundingBox())!;
        return near(b.x, stage.x) && near(b.width, stage.width / 2);
      }).toBe(true);

      // Over a full-screen page no Window is in view: the palette offers none of them.
      await page.goto("/settings/keys");
      await workLocally(page);
      const keys = page.locator("[data-full-page]");
      await expect(keys).toBeVisible();
      await page.keyboard.press("Control+k");
      await page.getByRole("combobox").fill("Close Window");
      await expect(page.getByRole("option", { name: /Close Window/ })).toHaveCount(0);
      await page.keyboard.press("Escape");

      // Bound in Settings › Keys, a key runs it on the front Window.
      await keys.getByRole("button", { name: "Bind a key" }).click();
      const dialog = page.getByRole("dialog", { name: "Bind a key" });
      await dialog.getByRole("combobox", { name: "Command" }).fill("Close Window");
      await page.getByRole("option", { name: /Close Window/ }).first().click();
      await dialog.getByRole("button", { name: "Key", exact: true }).press("Control+Shift+Y");
      await dialog.getByRole("button", { name: "Bind", exact: true }).click();
      await expect(dialog).toBeHidden();
      await keys.getByRole("button", { name: /^Close / }).click();
      await expect(keys).toHaveCount(0);
      await expect(win(page, "Graph")).toBeVisible();
      await page.keyboard.press("Control+Shift+Y");
      await expect(win(page, "Graph")).toHaveCount(0);
      await expect(win(page, "Map")).toBeVisible();
    });

    test("Back from a full-screen page returns to the Window's place, not a step back inside it", async ({ page }) => {
      await page.goto("/calendar?view=week");
      await workLocally(page);
      const calendar = win(page, "Calendar");
      await calendar.getByRole("tab", { name: "Day", exact: true }).click();
      await expect(page).toHaveURL(/view=day/);
      await hub(page).getByRole("link", { name: "Settings" }).click();
      await expect(page.locator("[data-full-page]")).toBeVisible();
      await page.goBack();
      await expect(page.locator("[data-full-page]")).toHaveCount(0);
      await expect(page).toHaveURL(/view=day/);
      // The next Back is a step inside the Calendar's own history.
      await page.goBack();
      await expect(page).toHaveURL(/view=week/);
    });

    test("Esc while typing in a field on a full-screen page is the field's", async ({ page }) => {
      await page.goto("/base/task");
      await workLocally(page);
      const bases = page.locator("[data-full-page]");
      await bases.getByRole("textbox", { name: "Search" }).fill("anything");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
      await expect(bases).toBeVisible();
      await bases.focus();
      await page.keyboard.press("Escape");
      await expect(bases).toHaveCount(0);
    });
  });
});

/** On a phone there are no Windows: the Phone bar's Hub slot opens a grid of every place (#664). */
test.describe("The phone's Hub", { tag: "@phone" }, () => {
  const bar = (page: Page) => page.locator("nav").filter({ has: page.getByRole("button", { name: "Capture" }) });
  const hubSlot = (page: Page) => bar(page).getByRole("button", { name: "Hub", exact: true });
  const grid = (page: Page) => page.getByRole("region", { name: "Hub" });

  test("the bar reads Calendar · slot · Capture · slot · Hub, and there is no ☰ and no Window", async ({ page }) => {
    await page.goto("/calendar");
    await workLocally(page);
    const cells = bar(page).getByRole("button");
    await expect(cells).toHaveCount(5);
    await expect(cells.nth(0)).toContainText("Calendar");
    await expect(cells.nth(2)).toContainText("Capture");
    await expect(cells.nth(4)).toContainText("Hub");
    await expect(page.getByRole("button", { name: "Menu" })).toHaveCount(0);
    await expect(page.locator("[data-window]")).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Hub" })).toHaveCount(0);
  });

  test("the Hub slot opens the grid, marked; a tile opens its place full screen and the mark goes", async ({ page }) => {
    await page.goto("/calendar");
    await workLocally(page);
    await hubSlot(page).click();
    await expect(page).toHaveURL(/\/hub$/);
    await expect(grid(page)).toBeVisible();
    await expect(hubSlot(page)).toHaveAttribute("aria-current", "page");
    await expect(grid(page)).toBeFocused();
    const places = grid(page).getByRole("list", { name: "Places" });
    await expect(places.getByRole("link", { name: "Map" })).toBeVisible();
    await expect(grid(page).getByRole("link", { name: "Settings" })).toBeVisible();
    await expect(grid(page).getByRole("link", { name: "Bases" })).toBeVisible();
    await expect(grid(page).getByRole("link", { name: "Guide" })).toBeVisible();

    await places.getByRole("link", { name: "Map" }).click();
    await expect(page).toHaveURL(/\/map/);
    await expect(hubSlot(page)).not.toHaveAttribute("aria-current", "page");
  });

  test("Find narrows the tiles, and a search with no match says so", async ({ page }) => {
    await page.goto("/hub");
    await workLocally(page);
    const places = grid(page).getByRole("list", { name: "Places" });
    await expect(places.getByRole("link", { name: "Graph" })).toBeVisible();
    const find = page.getByRole("searchbox", { name: "Find a place" });
    await find.fill("gra");
    await expect(places.getByRole("link", { name: "Graph" })).toBeVisible();
    await expect(places.getByRole("link", { name: "Map" })).toHaveCount(0);
    await find.fill("zzzz nothing");
    await expect(grid(page).getByRole("status")).toContainText("“zzzz nothing”");
    await grid(page).getByRole("button", { name: "Clear the search" }).click();
    await expect(places.getByRole("link", { name: "Map" })).toBeVisible();
  });
});

