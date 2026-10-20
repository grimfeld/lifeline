import { describe, expect, it } from "vitest";
import { quickAddFromLine, quickAddPlaceholder, startingMedium } from "./quickAdd";

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

describe("quickAddFromLine", () => {
  it("writes the title and the creator as the line QuickAdd reads, and names the medium", () => {
    expect(quickAddFromLine({ title: "Dune", creator: "Villeneuve", type: "movie" }, CINEMA)).toEqual({ text: "Dune — Villeneuve", medium: "movie" });
  });

  it("takes the creator under the App's own key", () => {
    expect(quickAddFromLine({ title: "Dune", author: "Herbert" }, CINEMA, "author")).toEqual({ text: "Dune — Herbert", medium: undefined });
  });

  it("leaves the medium to the App when the line names none, or one the App lacks", () => {
    expect(quickAddFromLine({ title: "Dune", type: "podcast" }, CINEMA)).toEqual({ text: "Dune", medium: undefined });
    expect(quickAddFromLine(undefined, CINEMA)).toEqual({ text: "", medium: undefined });
  });
});
