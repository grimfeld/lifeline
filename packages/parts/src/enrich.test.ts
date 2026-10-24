import { describe, expect, it } from "vitest";
import { applyHit, confidentMatch, normalizeTitle, refreshFromHit } from "./enrich";

const hit = { externalKey: "tmdb:movie/1", title: "Heat", creator: "Michael Mann", year: 1995, size: 170, coverUrl: "https://x/heat.jpg" };
const empty = { creator: "", year: 0, size: 0, coverUrl: "", externalKey: "" };
const FILLED = ["creator", "year", "size", "coverUrl"] as const;
const REFRESHED = ["coverUrl", "size", "year"] as const;

describe("applyHit", () => {
  it("fills every empty field and sets the external key", () => {
    expect(applyHit(empty, hit, FILLED)).toEqual({ creator: "Michael Mann", year: 1995, size: 170, coverUrl: "https://x/heat.jpg", externalKey: "tmdb:movie/1" });
  });
  it("never overwrites what the user typed", () => {
    expect(applyHit({ creator: "M. Mann", year: 1996, size: 0, coverUrl: "", externalKey: "" }, hit, FILLED)).toEqual({ size: 170, coverUrl: "https://x/heat.jpg", externalKey: "tmdb:movie/1" });
  });
  it("keeps an existing external key", () => {
    expect(applyHit({ ...empty, externalKey: "openlibrary:/works/1" }, hit, FILLED)).not.toHaveProperty("externalKey");
  });
  it("skips empty hit values", () => {
    expect(applyHit(empty, { ...hit, creator: "", size: 0, coverUrl: "" }, FILLED)).toEqual({ year: 1995, externalKey: "tmdb:movie/1" });
  });
  it("touches only the fields the App names", () => {
    expect(applyHit(empty, hit, ["year"])).toEqual({ year: 1995, externalKey: "tmdb:movie/1" });
  });
  it("fills text fields too (an Artwork's year is free text)", () => {
    const art = { externalKey: "wikidata:Q12418", year: "c. 1503", imageUrl: "https://x/mona.jpg" };
    expect(applyHit({ year: "1503–1506", imageUrl: "", externalKey: "" }, art, ["year", "imageUrl"])).toEqual({ imageUrl: "https://x/mona.jpg", externalKey: "wikidata:Q12418" });
  });
});

describe("refreshFromHit", () => {
  it("overwrites the named fields only", () => {
    const p = refreshFromHit({ creator: "me", year: 1990, size: 1, coverUrl: "old", externalKey: "tmdb:movie/1" }, hit, REFRESHED);
    expect(p).toEqual({ coverUrl: "https://x/heat.jpg", size: 170, year: 1995 });
    expect(p).not.toHaveProperty("creator");
  });
  it("fills a missing external key", () => {
    expect(refreshFromHit({ ...empty, year: 1995, size: 170, coverUrl: "https://x/heat.jpg" }, hit, REFRESHED)).toEqual({ externalKey: "tmdb:movie/1" });
  });
  it("is empty when nothing changed and ignores empty hit values", () => {
    expect(refreshFromHit({ creator: "", year: 1995, size: 170, coverUrl: "https://x/heat.jpg", externalKey: "k" }, hit, REFRESHED)).toEqual({});
    expect(refreshFromHit({ creator: "", year: 1995, size: 170, coverUrl: "https://x/heat.jpg", externalKey: "k" }, { ...hit, coverUrl: "", size: 0 }, REFRESHED)).toEqual({});
  });
});

describe("confidentMatch", () => {
  const hits = [hit, { ...hit, externalKey: "tmdb:movie/2", title: "Heat", year: 1986 }, { ...hit, externalKey: "tmdb:movie/3", title: "Heat 2" }];
  it("normalizes titles", () => {
    expect(normalizeTitle("  The Hobbit: Or, There & Back Again! ")).toBe("the hobbit or there back again");
    expect(normalizeTitle("Café")).toBe("cafe");
  });
  it("needs the year to disambiguate same titles", () => {
    expect(confidentMatch("heat", 0, hits)).toBeNull();
    expect(confidentMatch("HEAT", 1995, hits)?.externalKey).toBe("tmdb:movie/1");
  });
  it("matches on title alone when the item has no year and the title is unique", () => {
    expect(confidentMatch("Heat 2", 0, hits)?.externalKey).toBe("tmdb:movie/3");
    expect(confidentMatch("Heat 2", 2000, hits)).toBeNull();
    expect(confidentMatch("", 0, hits)).toBeNull();
  });
});
