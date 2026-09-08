import { describe, expect, it } from "vitest";
import { mapOlAuthor, mapOlAuthorDoc, mapOlDoc, mapOlWorkEntry, olAuthorId, olAuthorKey, openLibrarySearchUrl } from "./openlibrary";

describe("open library search url", () => {
  const params = (u: URL) => Object.fromEntries(u.searchParams.entries());
  it("free text goes to q; title and author apart; page and limit", () => {
    expect(params(openLibrarySearchUrl({ text: "dune" }))).toMatchObject({ q: "dune", limit: "20", page: "1" });
    expect(params(openLibrarySearchUrl({ title: "Dune", author: "Herbert", page: 3 }))).toMatchObject({ title: "Dune", author: "Herbert", page: "3" });
    expect(params(openLibrarySearchUrl({ author: "Herbert" }))).not.toHaveProperty("q");
  });
  it("an author key beats the name", () => {
    expect(params(openLibrarySearchUrl({ author: "Frank Herbert", authorKey: "openlibrary:/authors/OL79034A" })).author).toBe("OL79034A");
  });
});

describe("open library mapping", () => {
  it("maps a work with its authors' keys", () => {
    expect(mapOlDoc({ key: "/works/OL893415W", title: "Dune", author_name: ["Frank Herbert", "Someone"], author_key: ["OL79034A"], first_publish_year: 1965, number_of_pages_median: 604, cover_i: 12 })).toEqual({
      externalKey: "openlibrary:/works/OL893415W",
      title: "Dune",
      authors: [{ name: "Frank Herbert", externalKey: "openlibrary:/authors/OL79034A" }, { name: "Someone" }],
      year: 1965,
      size: 604,
      coverUrl: "https://covers.openlibrary.org/b/id/12-M.jpg",
    });
  });
  it("author keys round-trip", () => {
    expect(olAuthorKey("OL79034A")).toBe("openlibrary:/authors/OL79034A");
    expect(olAuthorKey("/authors/OL79034A")).toBe("openlibrary:/authors/OL79034A");
    expect(olAuthorId("openlibrary:/authors/OL79034A")).toBe("OL79034A");
    expect(olAuthorId("googlebooks:x")).toBe("");
  });
  it("maps an author search doc and an author record (first real photo)", () => {
    expect(mapOlAuthorDoc({ key: "OL79034A", name: "Frank Herbert", alternate_names: ["Herbert, Frank"], birth_date: "8 October 1920", death_date: "11 February 1986", top_work: "Dune", work_count: 120 })).toEqual({
      externalKey: "openlibrary:/authors/OL79034A", name: "Frank Herbert", alternateNames: ["Herbert, Frank"], born: "8 October 1920", died: "11 February 1986", topWork: "Dune", workCount: 120,
    });
    expect(mapOlAuthor({ key: "/authors/OL79034A", name: "Frank Herbert", photos: [-1, 6257] })).toMatchObject({ externalKey: "openlibrary:/authors/OL79034A", photoUrl: "https://covers.openlibrary.org/a/id/6257-M.jpg", alternateNames: [], born: "" });
  });
  it("maps a works entry, reading the year out of any date form", () => {
    expect(mapOlWorkEntry({ key: "/works/OL1W", title: "Dune", covers: [-1, 5], first_publish_date: "August 1, 1965" })).toEqual({ externalKey: "openlibrary:/works/OL1W", title: "Dune", year: 1965, coverUrl: "https://covers.openlibrary.org/b/id/5-M.jpg" });
    expect(mapOlWorkEntry({ key: "/works/OL2W", title: "X" })).toEqual({ externalKey: "openlibrary:/works/OL2W", title: "X", year: 0, coverUrl: "" });
  });
});
