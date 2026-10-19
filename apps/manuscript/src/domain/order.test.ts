import { describe, expect, it } from "vitest";
import { cutPassage, inOrder, moveChapter, nextPosition } from "./order";

const ch = (id: string, position: number, createdAt = "2026-01-01") => ({ id, position, createdAt });

describe("chapter order", () => {
  it("reads by position, ties by creation", () => {
    expect(inOrder([ch("c", 2), ch("a", 1), ch("b", 2, "2025-12-31")]).map((c) => c.id)).toEqual(["a", "b", "c"]);
    expect(nextPosition([ch("a", 1), ch("b", 7)])).toBe(8);
    expect(nextPosition([])).toBe(1);
  });

  it("moves one Chapter and renumbers only what changed", () => {
    const list = [ch("a", 1), ch("b", 2), ch("c", 3)];
    expect(moveChapter(list, "c", -1)).toEqual([
      { id: "c", position: 2 },
      { id: "b", position: 3 },
    ]);
    expect(moveChapter(list, "a", -1)).toEqual([]);
    expect(moveChapter(list, "c", 1)).toEqual([]);
  });

  it("heals gaps and ties as it moves", () => {
    expect(moveChapter([ch("a", 5), ch("b", 5, "2026-02-01"), ch("c", 9)], "c", -1)).toEqual([
      { id: "a", position: 1 },
      { id: "c", position: 2 },
      { id: "b", position: 3 },
    ]);
  });
});

describe("cutPassage", () => {
  it("takes the passage out once and tidies the gap", () => {
    expect(cutPassage("One.\n\nTwo is cut.\n\nThree.", "Two is cut.")).toBe("One.\n\nThree.");
    expect(cutPassage("Same same", "same")).toBe("Same ");
  });
  it("is undefined when the passage is not in the body", () => {
    expect(cutPassage("One.", "Two")).toBeUndefined();
    expect(cutPassage("One.", "  ")).toBeUndefined();
  });
});
