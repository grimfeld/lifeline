import { describe, expect, it } from "vitest";
import { describeLookup, lookupFor, resolveHit } from "./lookup";

describe("lookupFor / describeLookup", () => {
  it("games need a RAWG key", () => {
    expect(lookupFor("game", {})).toBeNull();
    expect(lookupFor("game", { rawgKey: "k" })).toBeTypeOf("function");
    expect(describeLookup("game", {})).toBe("RAWG (key needed)");
    expect(describeLookup("game", { rawgKey: "k" })).toBe("RAWG");
  });
});

describe("resolveHit", () => {
  const base = { externalKey: "rawg:1", title: "GTA V", creator: "", year: 0, size: 0, coverUrl: "" };
  it("merges lazy fields, dropping empties", async () => {
    const hit = { ...base, resolve: async () => ({ creator: "Rockstar North", size: 0 }) };
    expect(await resolveHit(hit)).toEqual({ ...base, creator: "Rockstar North" });
  });
  it("keeps the plain hit when resolve fails", async () => {
    const hit = { ...base, resolve: async () => { throw new Error("boom"); } };
    expect(await resolveHit(hit)).toEqual(hit);
  });
});
