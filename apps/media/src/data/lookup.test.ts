import { describe, expect, it } from "vitest";
import { describeLookup, lookupFor, lookupGapMs, resolveHit } from "./lookup";

describe("lookupFor / describeLookup", () => {
  it("needs keys for TMDB and RAWG, never for books and music", () => {
    expect(lookupFor("movie", {})).toBeNull();
    expect(lookupFor("series", {})).toBeNull();
    expect(lookupFor("game", {})).toBeNull();
    expect(lookupFor("movie", { tmdbKey: "k" })).toBeTypeOf("function");
    expect(lookupFor("game", { rawgKey: "k" })).toBeTypeOf("function");
    expect(lookupFor("book", {})).toBeTypeOf("function");
    expect(lookupFor("comic", {})).toBeTypeOf("function");
    expect(lookupFor("music", {})).toBeTypeOf("function");
  });
  it("describes providers and missing keys", () => {
    expect(describeLookup("movie", {})).toBe("TMDB (key needed)");
    expect(describeLookup("series", { tmdbKey: "k" })).toBe("TMDB");
    expect(describeLookup("game", {})).toContain("key needed");
    expect(describeLookup("comic", {})).toContain("ComicVine: key needed");
    expect(describeLookup("comic", { comicvineKey: "k" })).toBe("Open Library, then ComicVine, then Google Books");
    expect(describeLookup("book", {})).toBe("Open Library, then Google Books");
    expect(describeLookup("music", {})).toBe("MusicBrainz");
  });
  it("paces MusicBrainz slower", () => {
    expect(lookupGapMs("music")).toBe(1100);
    expect(lookupGapMs("book")).toBe(300);
  });
});

describe("resolveHit", () => {
  const base = { externalKey: "k", title: "T", creator: "", year: 0, size: 0, coverUrl: "" };
  it("merges the lazy result and drops the resolver", async () => {
    const r = await resolveHit({ ...base, resolve: async () => ({ creator: "Dir", size: 100 }) });
    expect(r).toEqual({ ...base, creator: "Dir", size: 100 });
  });
  it("keeps the plain hit when there is nothing to resolve or it fails", async () => {
    expect(await resolveHit(base)).toBe(base);
    const r = await resolveHit({ ...base, creator: "kept", resolve: async () => ({ creator: "" }) });
    expect(r.creator).toBe("kept");
    const f = await resolveHit({ ...base, resolve: async () => Promise.reject(new Error("x")) });
    expect(f.title).toBe("T");
  });
});
