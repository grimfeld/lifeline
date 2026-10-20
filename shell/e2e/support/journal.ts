import { expect, type Locator, type Page } from "@playwright/test";
import { CORE_URL } from "./seed";

/**
 * Helpers for the Journal navigation spec (spec #204): seed a Journal's Days,
 * reviews and Persons, open a Day or a period, and find the Journal's parts.
 * Each test starts from the layout seed, in its own browser context, so what
 * one test seeds never reaches another; dates in 2000–2001 keep clear of the
 * seed's own Days (dated today).
 */

/** Click "Work locally" when the sign-in screen offers it. */
export async function workLocally(page: Page): Promise<void> {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

/** A Day's own Template, nothing typed into it (DAILY_TEMPLATE): a Day with this body is not written. */
export const TEMPLATE = "```daylog\n```\n\n### Histoire du jour\n\n---\n### Citation du jour\n\n---\n### Quoi de neuf ?\n\n---\n### Et maintenant ?\n\n";

/** What to write into the store before opening the Journal. */
export interface JournalSeed {
  /** Days, by date (`YYYY-MM-DD`), each with its body. */
  days?: Record<string, string>;
  /** Period reviews to create, by key (`2001-W07`, `2001-02`, `2001-Q1`, `2001`), each with its body ("" for a blank one). */
  reviews?: Record<string, string>;
  /** Titles of Persons to create (a linkable type homed in the Journal, so `[[Name]]` in a Day counts in Reports). */
  persons?: string[];
}

/** The Person type `seedJournal` makes for `persons`. */
export const PERSON_TYPE = "e2ejnperson";

/**
 * Write `seed` into the store, from the Journal (the core module is imported
 * in the page). Returns the ids of what it made, by Day date / review key /
 * Person title.
 */
export async function seedJournal(page: Page, seed: JournalSeed): Promise<Record<string, string>> {
  await page.goto("/app/journal");
  await workLocally(page);
  return page.evaluate(
    async ({ coreUrl, seed, personType }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      const ids: Record<string, string> = {};
      if (seed.persons?.length) {
        await core.saveDocumentType({ typeId: personType, label: "Persons", fields: [], icon: "user", folder: "", body: "optional", linkable: true, module: "journal", order: 0 });
        for (let i = 0; i < 40 && !core.documentTypeSync(personType); i++) await new Promise((r) => setTimeout(r, 50));
        for (const title of seed.persons) ids[title] = (await core.createDocument({ type: personType, title })).id;
      }
      const kindOf = (key: string) => (/^\d{4}-W\d{2}$/.test(key) ? "week" : /^\d{4}-\d{2}$/.test(key) ? "month" : /^\d{4}-Q[1-4]$/.test(key) ? "quarter" : "year");
      for (const [key, body] of Object.entries(seed.reviews ?? {})) ids[key] = (await core.createDocument({ type: kindOf(key), title: key, body })).id;
      for (const [date, body] of Object.entries(seed.days ?? {})) ids[date] = (await core.createDocument({ type: "daily", title: date, body })).id;
      return ids;
    },
    { coreUrl: CORE_URL, seed, personType: PERSON_TYPE },
  );
}

/** Open the Journal's Day page at `date`. */
export async function openDay(page: Page, date: string): Promise<void> {
  await page.goto(`/app/journal?d=${date}`);
  await workLocally(page);
  await expect(page.getByRole("button", { name: "Previous day" })).toBeVisible();
}

/** Open a period's page (`2001-W07`, `2001-02`, `2001-Q1`, `2001`). */
export async function openPeriod(page: Page, key: string): Promise<void> {
  await page.goto(`/app/journal/p/${key}`);
  await workLocally(page);
  // The page's own arrow comes first; the sidebar calendar has a "Previous month" and "Previous year" too.
  await expect(page.getByRole("button", { name: /^Previous (week|month|quarter|year)$/ }).first()).toBeVisible();
}

/** The Journal's side column, on a Day or a period page (desk only: hidden below `lg`). */
export const sidebar = (page: Page): Locator => page.getByRole("complementary", { name: "Journal" });

/** The Day / period page's Links and Backlinks, as the sidebar shows them on a Document. */
export const linkHeadings = (page: Page): Locator => sidebar(page).getByText(/^(Backlinks|Unlinked names) · \d+$/);

/** Every Document of `type`, as titles (to check that navigating made nothing). */
export async function titlesOf(page: Page, type: string): Promise<string[]> {
  return page.evaluate(
    async ({ coreUrl, type }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      return ((await core.documentsOf(type)) as { title: string }[]).map((d) => d.title).sort();
    },
    { coreUrl: CORE_URL, type },
  );
}

/** True when the sidebar is laid out at this width (it is hidden below `lg`, 1024px). */
export const hasSidebar = (page: Page): boolean => (page.viewportSize()?.width ?? 0) >= 1024;

/** The sidebar's month calendar (desk only). */
export const calendar = (page: Page): Locator => sidebar(page).getByRole("group", { name: "Calendar" });

/** The calendar's title as it reads now ("February 2001"): waits until it shows `title`. */
export async function expectCalendarAt(page: Page, title: string): Promise<void> {
  await expect(calendar(page).getByText(title, { exact: true })).toBeVisible();
}

/** A day, month or year tile in the calendar (or the sidebar), by its key (`2001-02-14`, `2001-02`, `2001`): named by the key, ", written" after it when written. */
export const calendarTile = (scope: Locator, key: string): Locator => scope.getByRole("button", { name: new RegExp(`^${key}(, written)?$`) });
