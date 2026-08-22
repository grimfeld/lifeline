import { describe, expect, it } from "vitest";
import { describeLookup, lookupFor, lookupGapMs, resolveHit } from "./lookup";

describe("lookupFor / describeLookup", () => {
  it("books and comics never need a key; ComicVine joins with one", () => {
    expect(lookupFor("book", {})).toBeTypeOf("function");
    expect(lookupFor("comic", {})).toBeTypeOf("function");
    expect(lookupFor("comic", { comicvineKey: "k" })).toBeTypeOf("function");
  });
  it("describes providers and missing keys", () => {
    expect(describeLookup("comic", {})).toContain("ComicVine: key needed");
    expect(describeLookup("comic", { comicvineKey: "k" })).toBe("Open Library, then ComicVine, then Google Books");
    expect(describeLookup("book", {})).toBe("Open Library, then Google Books");
  });
  it("paces every lookup the same", () => {
    expect(lookupGapMs("book")).toBe(300);
    expect(lookupGapMs("comic")).toBe(300);
  });
});

describe("resolveHit", () => {
  const base = { externalKey: "openlibrary:/works/1", title: "Dune", creator: "", year: 0, size: 0, coverUrl: "" };
  it("merges lazy fields, dropping empties", async () => {
    const hit = { ...base, resolve: async () => ({ creator: "Frank Herbert", size: 0 }) };
    expect(await resolveHit(hit)).toEqual({ ...base, creator: "Frank Herbert" });
  });
  it("keeps the plain hit when resolve fails", async () => {
    const hit = { ...base, resolve: async () => { throw new Error("boom"); } };
    expect(await resolveHit(hit)).toEqual(hit);
  });
});
