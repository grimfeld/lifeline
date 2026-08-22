import { describe, expect, it } from "vitest";
import { describeLookup, lookupFor, lookupGapMs, resolveHit } from "./lookup";

describe("lookupFor / describeLookup", () => {
  it("albums never need a key, and MusicBrainz is paced slower", () => {
    expect(lookupFor("music")).toBeTypeOf("function");
    expect(describeLookup("music")).toBe("MusicBrainz");
    expect(lookupGapMs("music")).toBe(1100);
  });
});

describe("resolveHit", () => {
  const base = { externalKey: "musicbrainz:rg/1", title: "Kind of Blue", creator: "", year: 0, size: 0, coverUrl: "" };
  it("merges lazy fields, dropping empties", async () => {
    const hit = { ...base, resolve: async () => ({ creator: "Miles Davis", size: 0 }) };
    expect(await resolveHit(hit)).toEqual({ ...base, creator: "Miles Davis" });
  });
  it("keeps the plain hit when resolve fails", async () => {
    const hit = { ...base, resolve: async () => { throw new Error("boom"); } };
    expect(await resolveHit(hit)).toEqual(hit);
  });
});
