import { describe, expect, it } from "vitest";
import { textChange } from "./textDiff";

const apply = (prev: string, c: { from: number; to: number; insert: string } | null) =>
  c ? prev.slice(0, c.from) + c.insert + prev.slice(c.to) : prev;

describe("textChange", () => {
  it("is null when nothing changed", () => {
    expect(textChange("hello", "hello")).toBeNull();
  });

  it("touches only the erased character", () => {
    expect(textChange("abc", "ab")).toEqual({ from: 2, to: 3, insert: "" });
  });

  it("touches only the typed character", () => {
    expect(textChange("ab", "abc")).toEqual({ from: 2, to: 2, insert: "c" });
  });

  it("keeps the common prefix and suffix around an edit in the middle", () => {
    expect(textChange("one two three", "one TWO three")).toEqual({ from: 4, to: 7, insert: "TWO" });
  });

  it("replaces everything when nothing is shared", () => {
    expect(textChange("abc", "xyz")).toEqual({ from: 0, to: 3, insert: "xyz" });
  });

  it("rebuilds the next text for any pair", () => {
    const pairs: [string, string][] = [
      ["", "a"],
      ["a", ""],
      ["aaa", "aa"],
      ["line one\nline two", "line one\nline 2\nline three"],
      ["# Title\n\nbody", "# Title\n\nbody."],
    ];
    for (const [prev, next] of pairs) expect(apply(prev, textChange(prev, next))).toBe(next);
  });
});
