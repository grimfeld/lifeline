import { describe, expect, it } from "vitest";
import { googleBooksQuery, mapGbVolume } from "./googlebooks";
import { mapCvVolume } from "./comicvine";

describe("google books mapping", () => {
  it("maps a volume with every author, upgrading the thumbnail to https", () => {
    expect(
      mapGbVolume({ id: "abc", volumeInfo: { title: "Dune", authors: ["Frank Herbert", "X"], publishedDate: "1965-08", pageCount: 412, imageLinks: { thumbnail: "http://books.google.com/thumb?id=abc" } } }),
    ).toEqual({ externalKey: "googlebooks:abc", title: "Dune", authors: [{ name: "Frank Herbert" }, { name: "X" }], year: 1965, size: 412, coverUrl: "https://books.google.com/thumb?id=abc" });
    expect(mapGbVolume({ id: "z" })).toMatchObject({ title: "", authors: [], year: 0, size: 0, coverUrl: "" });
  });
  it("carries the description as the synopsis when the volume has one", () => {
    expect(mapGbVolume({ id: "abc", volumeInfo: { title: "Dune", description: "A desert planet." } })).toMatchObject({ synopsis: "A desert planet." });
    expect(mapGbVolume({ id: "abc", volumeInfo: { title: "Dune" } })).not.toHaveProperty("synopsis");
  });
  it("builds intitle/inauthor queries from the split fields", () => {
    expect(googleBooksQuery({ text: "dune herbert" })).toBe("dune herbert");
    expect(googleBooksQuery({ title: "Dune", author: 'Frank "F" Herbert' })).toBe('intitle:"Dune" inauthor:"Frank F Herbert"');
    expect(googleBooksQuery({ author: "Herbert" })).toBe('inauthor:"Herbert"');
    expect(googleBooksQuery({ authorKey: "openlibrary:/authors/OL1A" })).toBe("");
  });
});

describe("comicvine mapping", () => {
  it("maps a volume — the publisher is not an Author", () => {
    expect(mapCvVolume({ id: 18166, name: "Saga", start_year: "2012", count_of_issues: 66, publisher: { name: "Image" }, image: { medium_url: "https://cv/saga.jpg" } })).toEqual({
      externalKey: "comicvine:volume/18166",
      title: "Saga",
      authors: [],
      year: 2012,
      size: 66,
      coverUrl: "https://cv/saga.jpg",
    });
    expect(mapCvVolume({ id: 1, name: "X", start_year: null, publisher: null, image: null })).toMatchObject({ authors: [], year: 0, size: 0, coverUrl: "" });
  });
});
