import { describe, expect, it } from "vitest";
import { describeLookup, lookupFor, lookupGapMs, providerOf, resolveHit } from "./lookup";

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
  const base = { externalKey: "openlibrary:/works/1", title: "Dune", authors: [], year: 0, size: 0, coverUrl: "" };
  it("merges lazy fields, dropping empties", async () => {
    const hit = { ...base, resolve: async () => ({ authors: [{ name: "Frank Herbert" }], size: 0, coverUrl: "" }) };
    expect(await resolveHit(hit)).toEqual({ ...base, authors: [{ name: "Frank Herbert" }] });
    expect(await resolveHit({ ...base, resolve: async () => ({ authors: [] }) })).toEqual(base);
  });
  it("gives up on a provider that hangs, keeping the plain hit (CR-52)", async () => {
    const hang = (signal?: AbortSignal) => new Promise<never>((_, reject) => signal?.addEventListener("abort", () => reject(signal.reason)));
    const hit = { ...base, resolve: hang };
    expect(await resolveHit(hit, AbortSignal.timeout(5))).toBe(hit);
  });
  it("always hands the provider a signal to abort on", async () => {
    let got: AbortSignal | undefined;
    await resolveHit({ ...base, resolve: async (signal?: AbortSignal) => ((got = signal), {}) });
    expect(got).toBeInstanceOf(AbortSignal);
  });
  it("names a hit's provider", () => {
    expect(providerOf(base)).toBe("openlibrary");
    expect(providerOf({ externalKey: "googlebooks:x" })).toBe("googlebooks");
  });
  it("keeps the plain hit when resolve fails", async () => {
    const hit = { ...base, resolve: async () => { throw new Error("boom"); } };
    expect(await resolveHit(hit)).toEqual(hit);
  });
});
