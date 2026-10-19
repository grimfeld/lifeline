import { describe, expect, it } from "vitest";
import { quickAddPlaceholder, startingMedium } from "./quickAdd";

const CINEMA = [
  { id: "movie", label: "Movie", wantLabel: "To watch", creatorLabel: "Director" },
  { id: "series", label: "Series", wantLabel: "To watch", creatorLabel: "Creator" },
] as const;

describe("startingMedium", () => {
  it("takes the medium the caller names", () => {
    expect(startingMedium(CINEMA, "series", "movie")).toBe("series");
  });

  it("else the one last added to, when this App has it", () => {
    expect(startingMedium(CINEMA, undefined, "series")).toBe("series");
  });

  it("else the App's first medium — another App's remembered one is not ours", () => {
    expect(startingMedium(CINEMA, undefined, "book")).toBe("movie");
    expect(startingMedium(CINEMA, undefined, null)).toBe("movie");
  });
});

describe("quickAddPlaceholder", () => {
  it("says what to type, with the medium's creator", () => {
    expect(quickAddPlaceholder(CINEMA[0])).toBe("Add a movie — director…");
  });

  it("takes “an” before a vowel", () => {
    expect(quickAddPlaceholder({ label: "Album", creatorLabel: "Artist" })).toBe("Add an album — artist…");
  });

  it("names the creator as the App asks", () => {
    expect(quickAddPlaceholder({ label: "Book", creatorLabel: "Authors" }, "author")).toBe("Add a book — author…");
  });
});
