import { describe, expect, it } from "vitest";
import { composeTagFilter, matchesTagFilter, normalizeTag, normalizeTags, parseTagList } from "./tags";

describe("normalizeTag", () => {
  it("lower-cases, strips #, maps spaces to dashes", () => {
    expect(normalizeTag("#Garden")).toBe("garden");
    expect(normalizeTag("  Home  Repairs ")).toBe("home-repairs");
    expect(normalizeTag("Health/Gym")).toBe("health/gym");
  });
  it("rejects bare numbers and empties", () => {
    expect(normalizeTag("2024")).toBeNull();
    expect(normalizeTag("#")).toBeNull();
    expect(normalizeTag("   ")).toBeNull();
    expect(normalizeTag("a b!")).toBeNull();
  });
  it("trims stray separators", () => {
    expect(normalizeTag("/work/")).toBe("work");
    expect(normalizeTag("--x--")).toBe("x");
  });
});

describe("normalizeTags / parseTagList", () => {
  it("dedupes and drops invalid", () => {
    expect(normalizeTags(["A", "a", "#a", "1", "b"])).toEqual(["a", "b"]);
    expect(parseTagList("garden, #Work  health/gym")).toEqual(["garden", "work", "health/gym"]);
  });
});

describe("matchesTagFilter", () => {
  it("empty filter passes everything, even untagged", () => {
    expect(matchesTagFilter([], undefined)).toBe(true);
    expect(matchesTagFilter(undefined, composeTagFilter([], undefined))).toBe(true);
  });
  it("any-of within a set", () => {
    const f = composeTagFilter(["garden", "plants"]);
    expect(matchesTagFilter(["plants"], f)).toBe(true);
    expect(matchesTagFilter(["work"], f)).toBe(false);
    expect(matchesTagFilter([], f)).toBe(false);
    expect(matchesTagFilter(undefined, f)).toBe(false);
  });
  it("screen ∧ card: every set must pass", () => {
    const f = composeTagFilter(["garden"], ["work"]);
    expect(matchesTagFilter(["garden", "work"], f)).toBe(true);
    expect(matchesTagFilter(["garden"], f)).toBe(false);
  });
});
