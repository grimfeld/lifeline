import { describe, expect, it } from "vitest";
import { matchesWorkSearch, onShelf, pickIndex, shelfName, shelfQueries, sortGallery, type ShelfMedium, type ShelvedWork } from "./shelf";

type Id = "movie" | "series";
interface W extends ShelvedWork<Id> {
  id: string;
  owned?: boolean;
}

const WATCH = { UNSTARTED: "Unwatched", IN_PROGRESS: "Watching", DONE: "Watched", ABANDONED: "Abandoned" };
const TYPES: ShelfMedium<Id>[] = [
  { id: "movie", label: "Movie", plural: "Movies", wantLabel: "To watch", engagement: WATCH },
  { id: "series", label: "Series", plural: "Series", wantLabel: "To watch", engagement: WATCH },
];

function item(p: Partial<W>): W {
  return { id: "x", type: "movie", title: "t", reason: "", tags: [], engagement: "UNSTARTED", year: 0, addedOn: "2026-01-01", startedOn: "", finishedOn: "", ...p };
}
const ids = (xs: W[]) => xs.map((x) => x.id);

const q = shelfQueries<Id, W>(TYPES);

describe("matchesWorkSearch", () => {
  it("empty needle matches all; otherwise title/reason/the App's names, case-insensitive", () => {
    const m = item({ title: "Dune", reason: "Recommended by Sam" });
    expect(matchesWorkSearch(m, "  ")).toBe(true);
    expect(matchesWorkSearch(m, "dune")).toBe(true);
    expect(matchesWorkSearch(m, "HERB", ["Herbert"])).toBe(true);
    expect(matchesWorkSearch(m, "herb")).toBe(false);
    expect(matchesWorkSearch(m, "sam")).toBe(true);
    expect(matchesWorkSearch(m, "zzz")).toBe(false);
  });
  it("matches tags, with or without a leading #; # restricts to tags", () => {
    const m = item({ title: "Dune", tags: ["garden", "sci-fi"] });
    expect(matchesWorkSearch(m, "garden")).toBe(true);
    expect(matchesWorkSearch(m, "#GARD")).toBe(true);
    expect(matchesWorkSearch(m, "#dune")).toBe(false);
    expect(matchesWorkSearch(m, "#")).toBe(true);
    expect(matchesWorkSearch(item({ title: "Dune" }), "garden")).toBe(false);
  });
});

describe("sortGallery", () => {
  const a = item({ id: "a", title: "Alpha", addedOn: "2026-01-01", finishedOn: "", year: 2001 });
  const b = item({ id: "b", title: "Beta", addedOn: "2026-03-01", finishedOn: "2026-04-01", year: 0 });
  const c = item({ id: "c", title: "Gamma", addedOn: "2026-02-01", finishedOn: "2026-05-01", year: 1999 });

  it("does not mutate input", () => {
    const input = [c, b, a];
    sortGallery(input, "TITLE");
    expect(ids(input)).toEqual(["c", "b", "a"]);
  });
  it("TITLE, ADDED, FINISHED and YEAR", () => {
    expect(ids(sortGallery([c, b, a], "TITLE"))).toEqual(["a", "b", "c"]);
    expect(ids(sortGallery([a, b, c], "ADDED"))).toEqual(["b", "c", "a"]);
    expect(ids(sortGallery([a, b, c], "FINISHED"))).toEqual(["c", "b", "a"]);
    expect(ids(sortGallery([a, b, c], "YEAR"))).toEqual(["a", "c", "b"]);
  });
  it("RATING is highest first, unrated last, title breaking ties", () => {
    const r5 = item({ id: "r5", title: "Zeta", rating: 5 });
    const r3 = item({ id: "r3", title: "Beta", rating: 3 });
    const r3b = item({ id: "r3b", title: "Alpha", rating: 3 });
    const none = item({ id: "none", title: "Aardvark" });
    expect(ids(sortGallery([none, r3, r5, r3b], "RATING"))).toEqual(["r5", "r3b", "r3", "none"]);
  });
});

describe("the Shelf", () => {
  it("labels in the medium's words, or neutrally", () => {
    expect(q.shelfLabel("UNSTARTED", "movie")).toBe("To watch");
    expect(q.shelfLabel("UNSTARTED", "all")).toBe("To do");
    expect(shelfName("ABANDONED")).toBe("Dropped");
    expect(shelfName("ALL")).toBe("All");
  });
  it("filters by one Engagement or ALL", () => {
    expect(onShelf(item({ engagement: "DONE" }), "DONE")).toBe(true);
    expect(onShelf(item({ engagement: "DONE" }), "UNSTARTED")).toBe(false);
    expect(onShelf(item({}), "ALL")).toBe(true);
  });
});

describe("shelfQueries", () => {
  it("inProgress keeps IN_PROGRESS only, newest start first, optionally by medium", () => {
    const items = [
      item({ id: "a", engagement: "IN_PROGRESS", startedOn: "2026-01-01" }),
      item({ id: "b", engagement: "IN_PROGRESS", startedOn: "2026-02-01" }),
      item({ id: "s", type: "series", engagement: "IN_PROGRESS", startedOn: "2026-03-01" }),
      item({ id: "c", engagement: "DONE" }),
    ];
    expect(ids(q.inProgress(items))).toEqual(["s", "b", "a"]);
    expect(ids(q.inProgress(items, "movie"))).toEqual(["b", "a"]);
  });
  it("finishedIn filters DONE by year, latest first", () => {
    const items = [
      item({ id: "a", engagement: "DONE", finishedOn: "2026-02-01" }),
      item({ id: "b", engagement: "DONE", finishedOn: "2026-06-01" }),
      item({ id: "old", engagement: "DONE", finishedOn: "2025-06-01" }),
      item({ id: "going", engagement: "IN_PROGRESS" }),
    ];
    expect(ids(q.finishedIn(items, 2026))).toEqual(["b", "a"]);
  });
  it("the Surprise pool is the unstarted, narrowed by the App", () => {
    const items = [item({ id: "ok", owned: true }), item({ id: "wanted" }), item({ id: "going", engagement: "IN_PROGRESS", owned: true })];
    expect(ids(q.surprisePool(items))).toEqual(["ok", "wanted"]);
    expect(ids(shelfQueries<Id, W>(TYPES, (m) => !!m.owned).surprisePool(items))).toEqual(["ok"]);
  });
  it("counts and pluralises in registry order", () => {
    const items = [item({ type: "series" }), item({}), item({})];
    expect(q.countByMedium(items)).toEqual([{ medium: "movie", count: 2 }, { medium: "series", count: 1 }]);
    expect(q.mediumBreakdown(items)).toBe("2 movies · 1 series");
    expect(q.titleWithMedium("Watching", "movie")).toBe("Watching · Movies");
    expect(q.titleWithMedium("Watching", "")).toBe("Watching");
  });
  it("defaultCaptureItem prefers the latest-started in-progress item, else the most recently added", () => {
    const items = [
      item({ id: "a", engagement: "IN_PROGRESS", startedOn: "2026-01-01" }),
      item({ id: "b", engagement: "IN_PROGRESS", startedOn: "2026-02-01" }),
      item({ id: "c", addedOn: "2026-03-01" }),
    ];
    expect(q.defaultCaptureItem(items)?.id).toBe("b");
    expect(q.defaultCaptureItem([item({ id: "c", addedOn: "2026-03-01" }), item({ id: "d" })])?.id).toBe("c");
    expect(q.defaultCaptureItem([])).toBeUndefined();
  });
  it("daylogFacts: one line per item, finished > started > acquired > added, in the medium's verb", () => {
    const D = "2026-03-10";
    const facts = q.daylogFacts(
      [item({ id: "f", finishedOn: D }), item({ id: "s", startedOn: D }), item({ id: "a", acquiredOn: D, addedOn: D }), item({ id: "n", addedOn: D }), item({ id: "both", addedOn: D, finishedOn: D })],
      D,
    );
    expect(facts.map((f) => [f.item.id, f.kind])).toEqual([
      ["f", "Watched"],
      ["s", "Started"],
      ["a", "Acquired"],
      ["n", "Added"],
      ["both", "Watched"],
    ]);
  });
});

describe("pickIndex", () => {
  it("avoids the given index when the pool allows it", () => {
    expect(pickIndex(0, null)).toBe(-1);
    expect(pickIndex(1, 0)).toBe(0);
    for (let i = 0; i < 20; i++) expect(pickIndex(5, 2)).not.toBe(2);
  });
});
