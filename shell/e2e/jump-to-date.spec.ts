import { test, expect, type Page } from "@playwright/test";
import { openCalendar, pickDate } from "./support/date-picker";
import { CORE_URL } from "./support/seed";

/**
 * "Jump to date" is a Date picker button (ADR 0087): picking a day goes there
 * at once. On a phone the Calendar's sits in its Phone dock (ADR 0064). A
 * Part's "Read on another day" is one too, capped at today.
 */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

/** Runs in the page against the app's own Core module. */
async function inCore<A, R>(page: Page, fn: (core: any, arg: A) => Promise<R>, arg: A): Promise<R> {
  return page.evaluate(
    async ({ coreUrl, src, arg }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      return new Function("core", "arg", `return (${src})(core, arg);`)(core, arg);
    },
    { coreUrl: CORE_URL, src: fn.toString(), arg },
  );
}

/** The page's local day `offset` days from today, `YYYY-MM-DD`. */
const pageDay = (page: Page, offset = 0) =>
  page.evaluate((n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, offset);

test("the Calendar jumps to a picked day and shows it", async ({ page }) => {
  await page.goto("/calendar?view=month");
  await workLocally(page);
  const jump = page.getByRole("button", { name: "Jump to date" });
  await expect(jump).toBeVisible();
  if ((page.viewportSize()?.width ?? 0) < 768) {
    // In the Phone dock, below the calendar it pages.
    const box = (await jump.boundingBox())!;
    expect(box.y, "the button sits low on the screen").toBeGreaterThan((page.viewportSize()!.height * 2) / 3);
  }
  await pickDate(page, jump, "2027-02-14");
  await expect(page).toHaveURL(/[?&]d=2027-02-14/);
  await expect(page.getByText("February 2027").first()).toBeVisible();
});

test("the Journal jumps to a picked day", async ({ page }) => {
  await page.goto("/app/journal");
  await workLocally(page);
  // Today's Day is written on first open and its editor comes up after, lazily: opened at
  // once, the picker must not be closed by that editor taking focus.
  await pickDate(page, page.getByRole("button", { name: "Jump to date" }), "2025-06-03");
  await expect(page).toHaveURL(/[?&]d=2025-06-03/);
});

test("a Part is marked read on a day picked before today, and no later day can be picked", async ({ page }) => {
  const title = `Chaptered ${Date.now()}`;
  await page.goto("/app/library");
  await workLocally(page);
  const id = await inCore(
    page,
    async (core, t: string) =>
      (
        await core.putDocument({
          type: "book",
          title: t,
          tags: [],
          authors: [],
          externalKey: "",
          coverUrl: "",
          size: 0,
          year: 0,
          reason: "",
          slot: 0,
          addedOn: "2026-01-01",
          acquiredOn: "",
          slottedOn: "",
          startedOn: "2026-01-01",
          finishedOn: "",
          liked: false,
          rating: 0,
          engagement: "IN_PROGRESS",
          acquisition: "OWNED",
          partsTracked: true,
          partCount: 5,
          caughtUpGroup: 0,
          caughtUpPart: 0,
        })
      ).id as string,
    title,
  );
  await page.getByRole("button", { name: `Open ${title}` }).first().click();
  const work = page.getByRole("dialog").first();
  // A tap opens the Part rather than marking it: a switch on the desk, a Select on a phone (ADR 0064).
  if ((page.viewportSize()?.width ?? 0) < 768) {
    await work.getByRole("combobox", { name: "A tap" }).click();
    await page.getByRole("option", { name: "Tap opens" }).click();
  } else {
    await work.getByRole("radio", { name: "Tap opens" }).click();
  }
  await work.locator('[title^="Chapter 2"]').click();
  const another = page.getByRole("button", { name: "Read on another day" });

  await another.click();
  const [today, tomorrow] = [await pageDay(page), await pageDay(page, 1)];
  const calendar = openCalendar(page);
  await expect(calendar).toBeVisible();
  if (tomorrow.slice(0, 7) === today.slice(0, 7)) await expect(calendar.locator(`[data-day="${tomorrow}"] button`)).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(calendar).toBeHidden();

  await pickDate(page, another, "2026-01-15");
  await expect
    .poll(() =>
      inCore(
        page,
        async (core, workId: string) =>
          (await core.documentsWhere("library_part", "work", workId)).map((p: any) => `${p.number}:${p.readOn}`),
        id,
      ),
    )
    .toEqual(["2:2026-01-15"]);
});
