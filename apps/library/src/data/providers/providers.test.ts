import { describe, expect, it } from "vitest";
import { mapGbVolume } from "./googlebooks";
import { mapCvVolume } from "./comicvine";

describe("google books mapping", () => {
  it("maps a volume, upgrading the thumbnail to https", () => {
    expect(
      mapGbVolume({ id: "abc", volumeInfo: { title: "Dune", authors: ["Frank Herbert", "X"], publishedDate: "1965-08", pageCount: 412, imageLinks: { thumbnail: "http://books.google.com/thumb?id=abc" } } }),
    ).toEqual({ externalKey: "googlebooks:abc", title: "Dune", creator: "Frank Herbert", year: 1965, size: 412, coverUrl: "https://books.google.com/thumb?id=abc" });
    expect(mapGbVolume({ id: "z" })).toMatchObject({ title: "", creator: "", year: 0, size: 0, coverUrl: "" });
  });
});

describe("comicvine mapping", () => {
  it("maps a volume", () => {
    expect(mapCvVolume({ id: 18166, name: "Saga", start_year: "2012", count_of_issues: 66, publisher: { name: "Image" }, image: { medium_url: "https://cv/saga.jpg" } })).toEqual({
      externalKey: "comicvine:volume/18166",
      title: "Saga",
      creator: "Image",
      year: 2012,
      size: 66,
      coverUrl: "https://cv/saga.jpg",
    });
    expect(mapCvVolume({ id: 1, name: "X", start_year: null, publisher: null, image: null })).toMatchObject({ creator: "", year: 0, size: 0, coverUrl: "" });
  });
});
