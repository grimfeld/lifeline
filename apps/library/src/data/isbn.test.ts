import { describe, expect, it } from "vitest";
import { isbnOf } from "./isbn";
import { isEmptyQuery, olIsbnUrl, olIsbnWorkKey, openLibraryWorkUrl } from "./openlibrary";
import { googleBooksQuery } from "./providers/googlebooks";
import { withIsbn } from "./lookup";

describe("isbn detection", () => {
  it("accepts a valid ISBN-13, bare, hyphenated or spaced", () => {
    expect(isbnOf("9780441172719")).toBe("9780441172719");
    expect(isbnOf("978-0-441-17271-9")).toBe("9780441172719");
    expect(isbnOf(" 978 0 441 17271 9 ")).toBe("9780441172719");
  });
  it("accepts a valid ISBN-10, including an X check digit", () => {
    expect(isbnOf("0441172717")).toBe("0441172717");
    expect(isbnOf("0-8044-2957-X")).toBe("080442957X");
    expect(isbnOf("080442957x")).toBe("080442957X");
  });
  it("rejects a failed checksum, wrong lengths and anything with other characters", () => {
    expect(isbnOf("9780441172718")).toBeNull();
    expect(isbnOf("0441172718")).toBeNull();
    expect(isbnOf("12345")).toBeNull();
    expect(isbnOf("dune 9780441172719")).toBeNull();
    expect(isbnOf("X441172717")).toBeNull();
    expect(isbnOf("")).toBeNull();
  });
});

describe("isbn queries", () => {
  it("a valid ISBN in free text becomes an isbn query; an invalid one stays text", () => {
    expect(withIsbn({ text: "978-0-441-17271-9" })).toEqual({ isbn: "9780441172719" });
    expect(withIsbn({ text: "9780441172718" })).toEqual({ text: "9780441172718" });
    expect(withIsbn({ title: "9780441172719" })).toEqual({ isbn: "9780441172719" });
    expect(isEmptyQuery({ isbn: "9780441172719" })).toBe(false);
  });
  it("Open Library: edition lookup url, edition -> work key, work search url", () => {
    expect(olIsbnUrl("9780441172719").toString()).toBe("https://openlibrary.org/isbn/9780441172719.json");
    expect(olIsbnWorkKey({ works: [{ key: "/works/OL893415W" }] })).toBe("/works/OL893415W");
    expect(olIsbnWorkKey({})).toBe("");
    const u = openLibraryWorkUrl("/works/OL893415W");
    expect(u.searchParams.get("q")).toBe("key:/works/OL893415W");
  });
  it("Google Books asks isbn:", () => {
    expect(googleBooksQuery({ isbn: "9780441172719" })).toBe("isbn:9780441172719");
  });
});
