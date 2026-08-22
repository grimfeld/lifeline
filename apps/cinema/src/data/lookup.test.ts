import { describe, expect, it } from "vitest";
import { describeLookup, lookupFor, resolveHit } from "./lookup";

describe("lookupFor / describeLookup", () => {
  it("movies and series need a TMDB key", () => {
    expect(lookupFor("movie", {})).toBeNull();
    expect(lookupFor("series", {})).toBeNull();
    expect(lookupFor("movie", { tmdbKey: "k" })).toBeTypeOf("function");
    expect(describeLookup("movie", {})).toBe("TMDB (key needed)");
    expect(describeLookup("series", { tmdbKey: "k" })).toBe("TMDB");
  });
});

describe("resolveHit", () => {
  const base = { externalKey: "tmdb:movie/949", title: "Heat", creator: "", year: 0, size: 0, coverUrl: "" };
  it("merges lazy fields, dropping empties", async () => {
    const hit = { ...base, resolve: async () => ({ creator: "Michael Mann", size: 0 }) };
    expect(await resolveHit(hit)).toEqual({ ...base, creator: "Michael Mann" });
  });
  it("keeps the plain hit when resolve fails", async () => {
    const hit = { ...base, resolve: async () => { throw new Error("boom"); } };
    expect(await resolveHit(hit)).toEqual(hit);
  });
});
