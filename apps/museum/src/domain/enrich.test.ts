import { describe, expect, it } from "vitest";
import type { ArtworkHit } from "../data/wikidata";
import { applyHit, confidentMatch, normalizeTitle, refreshFromHit } from "./enrich";

const hit: ArtworkHit = { externalKey: "wikidata:Q12418", title: "Mona Lisa", description: "painting", artistName: "Leonardo da Vinci", artistKey: "wikidata:Q762", year: "c. 1503", imageUrl: "https://x/mona.jpg", materials: "oil paint, poplar wood", dimensions: "77 × 53 cm", location: "Louvre" };
const empty = { year: "", imageUrl: "", location: "", materials: "", dimensions: "", externalKey: "" };

describe("applyHit", () => {
  it("fills every empty field", () => {
    expect(applyHit(empty, hit)).toEqual({ year: "c. 1503", imageUrl: "https://x/mona.jpg", location: "Louvre", materials: "oil paint, poplar wood", dimensions: "77 × 53 cm", externalKey: "wikidata:Q12418" });
  });
  it("never overwrites what the user typed", () => {
    expect(applyHit({ ...empty, year: "1503–1506", location: "the Louvre" }, hit)).toEqual({ imageUrl: "https://x/mona.jpg", materials: "oil paint, poplar wood", dimensions: "77 × 53 cm", externalKey: "wikidata:Q12418" });
  });
  it("skips empty hit values", () => {
    expect(applyHit(empty, { ...hit, imageUrl: "", materials: "", dimensions: "", location: "" })).toEqual({ year: "c. 1503", externalKey: "wikidata:Q12418" });
  });
});

describe("refreshFromHit", () => {
  it("overwrites the image only, and fills a missing key", () => {
    expect(refreshFromHit({ ...empty, year: "1503", imageUrl: "old" }, hit)).toEqual({ imageUrl: "https://x/mona.jpg", externalKey: "wikidata:Q12418" });
  });
  it("is a no-op when nothing changed", () => {
    expect(refreshFromHit({ ...empty, imageUrl: "https://x/mona.jpg", externalKey: "k" }, hit)).toEqual({});
  });
});

describe("confidentMatch", () => {
  it("matches one exact title, diacritics and punctuation aside", () => {
    expect(normalizeTitle("La Grande Jatte — étude")).toBe("la grande jatte etude");
    expect(confidentMatch("mona lisa", [hit])).toBe(hit);
    expect(confidentMatch("Mona Lisa", [hit, { ...hit, externalKey: "wikidata:Q999" }])).toBeNull();
    expect(confidentMatch("Something else", [hit])).toBeNull();
  });
});
