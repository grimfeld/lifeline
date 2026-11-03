import { test, expect, type Page } from "@playwright/test";
import { inCore } from "./support/core";

/**
 * The Work page (ADR on a work's page): every book, comic and manga has a page
 * of its own. A Gallery tile opens it, its Fields are edited in place there,
 * its series is listed in order, and a Peek of the work links through to it.
 */

async function workLocally(page: Page) {
  const local = page.getByRole("button", { name: "Work locally" });
  await local.waitFor({ timeout: 3000 }).then(() => local.click(), () => {});
}

async function putBook(page: Page, title: string, fields: Record<string, unknown> = {}) {
  await expect.poll(() => inCore(page, async (core, t: string) => !!core.documentType(t), "book")).toBe(true);
  return inCore(
    page,
    async (core, a: { title: string; fields: Record<string, unknown> }) => (await core.putDocument({ type: "book", title: a.title, body: "", engagement: "UNSTARTED", acquisition: "WANTED", addedOn: "2026-01-01", ...a.fields })).id as string,
    { title, fields },
  );
}

const fieldOf = (page: Page, id: string, key: string) => inCore(page, async (core, a: { id: string; key: string }) => (await core.getDocument(a.id))![a.key], { id, key });

test("Library: a Gallery tile opens the work's page, where a Field edited in place persists", async ({ page }) => {
  await page.goto("/app/library");
  await workLocally(page);
  const title = `Dune ${Date.now()}`;
  const id = await putBook(page, title, { series: "Dune Chronicles", seriesNumber: 1 });
  await putBook(page, `Dune Messiah ${Date.now()}`, { series: "dune chronicles", seriesNumber: 2 });

  await page.getByRole("textbox", { name: "Search books" }).fill(title);
  await page.getByRole("button", { name: `Open ${title}` }).click();
  await expect(page).toHaveURL(new RegExp(`/app/library/works/${id}$`));
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();

  // Its series, on the shelf, in order.
  const series = page.getByRole("region", { name: "Series" });
  await expect(series.getByRole("listitem")).toHaveCount(2);
  await expect(series.getByRole("listitem").nth(1)).toContainText("Dune Messiah");

  await page.getByLabel("Synopsis").fill("A desert planet.");
  await expect.poll(() => fieldOf(page, id, "synopsis")).toBe("A desert planet.");
  await page.getByLabel("Original language").fill("English");
  await expect.poll(() => fieldOf(page, id, "originalLanguage")).toBe("English");

  // The guarded Shelf moves only through the Library's own transitions.
  await page.getByRole("button", { name: "Shelf" }).click();
  await page.getByRole("menuitem", { name: "Got it (owned)" }).click();
  await expect.poll(() => fieldOf(page, id, "acquisition")).toBe("OWNED");

  await page.reload();
  await expect(page.getByLabel("Synopsis")).toHaveValue("A desert planet.");
});

test("Library: a work's Peek links through to its page", async ({ page }) => {
  await page.goto("/vault");
  await workLocally(page);
  const title = `Hyperion ${Date.now()}`;
  const id = await putBook(page, title);
  await inCore(page, async (core, docId: string) => core.openPeek(docId), id);
  await page.getByRole("dialog").getByRole("button", { name: /^Open/ }).click();
  await expect(page).toHaveURL(new RegExp(`/app/library/works/${id}$`));
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
});

test("Library: Find metadata searches an ISBN typed in place of the title", async ({ page }) => {
  await page.route(/^https:\/\/(?!localhost)/, (route) => {
    const url = route.request().url();
    if (url === "https://openlibrary.org/isbn/9780441172719.json") return route.fulfill({ json: { works: [{ key: "/works/OL893415W" }] } });
    if (url.startsWith("https://openlibrary.org/search.json") && url.includes("OL893415W"))
      return route.fulfill({ json: { docs: [{ key: "/works/OL893415W", title: "Dune", author_name: ["Frank Herbert"], first_publish_year: 1965 }] } });
    if (url.startsWith("https://openlibrary.org/search.json")) return route.fulfill({ json: { docs: [] } });
    return route.abort();
  });
  await page.goto("/app/library");
  await workLocally(page);
  const title = `My copy ${Date.now()}`;
  const id = await putBook(page, title);
  await page.goto(`/app/library/works/${id}`);
  await workLocally(page);

  await page.getByRole("button", { name: "Find metadata" }).click();
  const dialog = page.getByRole("dialog");
  const search = dialog.getByRole("textbox", { name: "Search" });
  await expect(search).toHaveValue(title);

  await search.fill("978-0-441-17271-9");
  await search.press("Enter");
  await dialog.getByRole("button", { name: /^Dune/ }).click();
  await expect.poll(() => fieldOf(page, id, "year")).toBe(1965);
});
