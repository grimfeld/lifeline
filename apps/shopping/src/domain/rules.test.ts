import { describe, expect, it } from "vitest";
import type { Aisle, Need } from "./types";
import { addOutcome, appendNote, boughtRecently, groupByAisle, moveAisle, nextRank, renameClash, sortAisles, suggestions, titleKey } from "./rules";

const need = (id: string, over: Partial<Need> = {}): Need =>
  ({ id, type: "need", title: id, aisleId: "", note: "", boughtOn: "", listedAt: "2026-09-01T10:00:00.000Z", tags: [], folder: "", createdAt: "2026-09-01", updatedAt: 0, ...over }) as unknown as Need;
const aisle = (id: string, rank: number, title = id): Aisle => ({ id, type: "aisle", title, rank, tags: [], folder: "", createdAt: "2026-09-01", updatedAt: 0 }) as unknown as Aisle;

describe("one Need per thing", () => {
  it("same title is case and outer spaces aside", () => {
    expect(titleKey("  Milk ")).toBe(titleKey("milk"));
    expect(titleKey("oat milk")).not.toBe(titleKey("milk"));
  });
  it("a new title makes a Need", () => {
    expect(addOutcome([need("milk")], "oat milk").kind).toBe("new");
  });
  it("a Bought title comes back rather than being made again", () => {
    const out = addOutcome([need("milk", { boughtOn: "2026-09-10" })], "Milk");
    expect(out.kind).toBe("revive");
  });
  it("a title already listed makes nothing", () => {
    expect(addOutcome([need("milk")], "MILK ").kind).toBe("listed");
  });
  it("a blank title matches nothing", () => {
    expect(addOutcome([need("milk")], "   ").kind).toBe("new");
  });
  it("renaming onto another Need's title clashes, onto its own does not", () => {
    const list = [need("a", { title: "milk" }), need("b", { title: "semi milk" })];
    expect(renameClash(list, "b", "Milk")?.id).toBe("a");
    expect(renameClash(list, "a", "MILK")).toBeUndefined();
  });
});

describe("appendNote", () => {
  it("adds to the note, never replaces it", () => {
    expect(appendNote("2 L", "semi-skimmed")).toBe("2 L; semi-skimmed");
    expect(appendNote("", "2 L")).toBe("2 L");
    expect(appendNote("2 L", "  ")).toBe("2 L");
    expect(appendNote("2 L", "2 L")).toBe("2 L");
  });
});

describe("groupByAisle", () => {
  const aisles = [aisle("pharma", 1, "Pharmacy"), aisle("super", 0, "Supermarket")];
  it("Anywhere heads the list, then Aisles in my order", () => {
    const groups = groupByAisle([], aisles);
    expect(groups.map((g) => g.aisle?.id ?? null)).toEqual([null, "super", "pharma"]);
  });
  it("oldest onto the list first inside a group", () => {
    const groups = groupByAisle([need("late", { aisleId: "super", listedAt: "2026-09-03" }), need("early", { aisleId: "super", listedAt: "2026-09-02" })], aisles);
    expect(groups[1]!.needs.map((n) => n.id)).toEqual(["early", "late"]);
  });
  it("a Need pointing at a deleted Aisle is buyable anywhere", () => {
    const groups = groupByAisle([need("x", { aisleId: "gone" })], aisles);
    expect(groups[0]!.needs.map((n) => n.id)).toEqual(["x"]);
  });
});

describe("boughtRecently & suggestions", () => {
  const list = [need("milk", { boughtOn: "2026-09-20" }), need("old", { boughtOn: "2026-08-01" }), need("eggs", { boughtOn: "2026-09-22" }), need("bread")];
  it("keeps only the window, latest first", () => {
    expect(boughtRecently(list, "2026-09-16").map((n) => n.id)).toEqual(["eggs", "milk"]);
  });
  it("offers back every Bought title, never a listed one", () => {
    expect(suggestions(list)).toEqual(["eggs", "milk", "old"]);
  });
});

describe("Aisle order", () => {
  const aisles = [aisle("a", 0), aisle("b", 1), aisle("c", 2)];
  it("sorts by rank", () => {
    expect(sortAisles([aisles[2]!, aisles[0]!, aisles[1]!]).map((a) => a.id)).toEqual(["a", "b", "c"]);
  });
  it("moving swaps neighbours and reports only changed ranks", () => {
    expect(moveAisle(aisles, "c", -1)).toEqual([
      { id: "c", rank: 1 },
      { id: "b", rank: 2 },
    ]);
  });
  it("moving past an end does nothing", () => {
    expect(moveAisle(aisles, "a", -1)).toEqual([]);
    expect(moveAisle(aisles, "c", 1)).toEqual([]);
  });
  it("a new Aisle goes last", () => {
    expect(nextRank(aisles)).toBe(3);
    expect(nextRank([])).toBe(0);
  });
});
