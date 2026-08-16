import { describe, expect, it } from "vitest";
import type { MediaItem } from "./types";
import { countByMedium, finishedIn, inProgress, mediumBreakdown, pickIndex, surprisePool, titleWithMedium } from "./cardQueries";

function item(p: Partial<MediaItem>): MediaItem {
  return {
    id: p.id ?? "x",
    updatedAt: "",
    deleted: 0,
    type: "book",
    title: "t",
    creator: "",
    externalKey: "",
    coverUrl: "",
    size: 0,
    year: 0,
    acquisition: "WANTED",
    engagement: "UNSTARTED",
    studied: false,
    reason: "",
    slot: 0,
    addedOn: "2026-01-01",
    acquiredOn: "",
    slottedOn: "",
    startedOn: "",
    finishedOn: "",
    ...p,
  };
}

describe("inProgress", () => {
  it("keeps IN_PROGRESS only, newest start first, optionally by medium", () => {
    const items = [
      item({ id: "a", engagement: "IN_PROGRESS", startedOn: "2026-01-05" }),
      item({ id: "b", engagement: "IN_PROGRESS", startedOn: "2026-02-01", type: "game" }),
      item({ id: "c", engagement: "DONE", startedOn: "2026-03-01" }),
      item({ id: "d", engagement: "IN_PROGRESS", startedOn: "" }),
    ];
    expect(inProgress(items).map((m) => m.id)).toEqual(["b", "a", "d"]);
    expect(inProgress(items, "game").map((m) => m.id)).toEqual(["b"]);
  });
});

describe("finishedIn", () => {
  it("filters DONE by year, latest first, and by medium", () => {
    const items = [
      item({ id: "a", engagement: "DONE", finishedOn: "2026-01-05" }),
      item({ id: "b", engagement: "DONE", finishedOn: "2026-06-01", type: "movie" }),
      item({ id: "c", engagement: "DONE", finishedOn: "2025-12-31" }),
      item({ id: "d", engagement: "ABANDONED", finishedOn: "2026-02-02" }),
    ];
    expect(finishedIn(items, 2026).map((m) => m.id)).toEqual(["b", "a"]);
    expect(finishedIn(items, 2026, "book").map((m) => m.id)).toEqual(["a"]);
    expect(finishedIn(items, 2024)).toEqual([]);
  });
});

describe("surprisePool", () => {
  it("is backlog + unstarted + owned/borrowed", () => {
    const items = [
      item({ id: "ok1", acquisition: "OWNED" }),
      item({ id: "ok2", acquisition: "BORROWED", type: "game" }),
      item({ id: "wanted", acquisition: "WANTED" }),
      item({ id: "slotted", acquisition: "OWNED", slot: 1 }),
      item({ id: "started", acquisition: "OWNED", engagement: "IN_PROGRESS" }),
      item({ id: "gone", acquisition: "GONE" }),
    ];
    expect(surprisePool(items).map((m) => m.id)).toEqual(["ok1", "ok2"]);
    expect(surprisePool(items, "game").map((m) => m.id)).toEqual(["ok2"]);
  });
});

describe("countByMedium / breakdown", () => {
  it("counts in registry order, drops zeros, pluralises", () => {
    const items = [item({ type: "movie" }), item({ type: "book" }), item({ type: "book" })];
    expect(countByMedium(items)).toEqual([
      { type: "book", count: 2 },
      { type: "movie", count: 1 },
    ]);
    expect(mediumBreakdown(items)).toBe("2 books · 1 movie");
    expect(mediumBreakdown([])).toBe("");
  });
});

describe("pickIndex", () => {
  it("never repeats the avoided index when the pool has more than one", () => {
    for (let k = 0; k < 50; k++) expect(pickIndex(3, 1)).not.toBe(1);
    expect(pickIndex(1, 0)).toBe(0);
    expect(pickIndex(0, null)).toBe(-1);
    expect(pickIndex(4, null, () => 0.5)).toBe(2);
  });
});

describe("titleWithMedium", () => {
  it("appends the plural medium label", () => {
    expect(titleWithMedium("Nightstand", "")).toBe("Nightstand");
    expect(titleWithMedium("Nightstand", "book")).toBe("Nightstand · Books");
  });
});
