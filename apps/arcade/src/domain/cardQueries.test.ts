import { describe, expect, it } from "vitest";
import type { Work } from "./types";
import { countByMedium, daylogFacts, defaultCaptureItem, finishedIn, inProgress, mediumBreakdown, pickIndex, surprisePool, titleWithMedium } from "./cardQueries";

function item(p: Partial<Work>): Work {
  return {
    id: p.id ?? "x", updatedAt: "", deleted: 0, type: "game", title: "t", tags: [], folder: "", createdAt: "2026-01-01",
    creator: "", externalKey: "", coverUrl: "", size: 0, year: 0, acquisition: "WANTED", engagement: "UNSTARTED",
    reason: "", addedOn: "2026-01-01", acquiredOn: "", startedOn: "", finishedOn: "", ...p,
  } as Work;
}

describe("inProgress", () => {
  it("keeps IN_PROGRESS only, newest start first", () => {
    const items = [
      item({ id: "a", engagement: "IN_PROGRESS", startedOn: "2026-01-01" }),
      item({ id: "b", engagement: "IN_PROGRESS", startedOn: "2026-02-01" }),
      item({ id: "c", engagement: "DONE" }),
    ];
    expect(inProgress(items).map((m) => m.id)).toEqual(["b", "a"]);
  });
});

describe("finishedIn", () => {
  it("filters DONE by year, latest first", () => {
    const items = [
      item({ id: "a", engagement: "DONE", finishedOn: "2026-02-01" }),
      item({ id: "b", engagement: "DONE", finishedOn: "2026-06-01" }),
      item({ id: "old", engagement: "DONE", finishedOn: "2025-06-01" }),
      item({ id: "going", engagement: "IN_PROGRESS", finishedOn: "" }),
    ];
    expect(finishedIn(items, 2026).map((m) => m.id)).toEqual(["b", "a"]);
  });
});

describe("surprisePool", () => {
  it("is unstarted + owned/borrowed", () => {
    const items = [
      item({ id: "ok1", acquisition: "OWNED" }),
      item({ id: "ok2", acquisition: "BORROWED" }),
      item({ id: "wanted", acquisition: "WANTED" }),
      item({ id: "going", acquisition: "OWNED", engagement: "IN_PROGRESS" }),
    ];
    expect(surprisePool(items).map((m) => m.id)).toEqual(["ok1", "ok2"]);
  });
});

describe("counts", () => {
  it("counts and pluralises", () => {
    const items = [item({}), item({})];
    expect(countByMedium(items)).toEqual([{ medium: "game", count: 2 }]);
    expect(mediumBreakdown(items)).toBe("2 games");
    expect(titleWithMedium("Playing", "game")).toBe("Playing · Games");
    expect(titleWithMedium("Playing", "")).toBe("Playing");
  });
});

describe("daylogFacts", () => {
  const D = "2026-03-10";
  it("one line per item, finished > started > acquired > added, in the Arcade's verb", () => {
    const facts = daylogFacts(
      [item({ id: "f", finishedOn: D }), item({ id: "s", startedOn: D }), item({ id: "a", acquiredOn: D }), item({ id: "n", addedOn: D }), item({ id: "both", addedOn: D, finishedOn: D })],
      D,
    );
    expect(facts.map((f) => [f.item.id, f.kind])).toEqual([
      ["f", "Played"],
      ["s", "Started"],
      ["a", "Acquired"],
      ["n", "Added"],
      ["both", "Played"],
    ]);
  });
});

describe("defaultCaptureItem", () => {
  it("prefers the latest-started in-progress item, else the most recently added", () => {
    const items = [
      item({ id: "a", engagement: "IN_PROGRESS", startedOn: "2026-01-01" }),
      item({ id: "b", engagement: "IN_PROGRESS", startedOn: "2026-02-01" }),
      item({ id: "c", engagement: "UNSTARTED", addedOn: "2026-03-01" }),
    ];
    expect(defaultCaptureItem(items)?.id).toBe("b");
    expect(defaultCaptureItem([])).toBeUndefined();
  });
});

describe("pickIndex", () => {
  it("avoids the given index when the pool allows it", () => {
    expect(pickIndex(0, null)).toBe(-1);
    expect(pickIndex(1, 0)).toBe(0);
    for (let i = 0; i < 20; i++) expect(pickIndex(5, 2)).not.toBe(2);
  });
});
