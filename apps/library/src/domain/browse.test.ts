import { describe, expect, it } from "vitest";
import type { Work } from "./types";
import { matchesSearch, sameSeries, sortGallery } from "./browse";

function item(p: Partial<Work>): Work {
  return {
    id: p.id ?? "x",
    updatedAt: "",
    deleted: 0,
    type: "book",
    title: "t",
    tags: [],
    folder: "",
    createdAt: "2026-01-01",
    authors: [],
    externalKey: "",
    coverUrl: "",
    size: 0,
    year: 0,
    acquisition: "WANTED",
    engagement: "UNSTARTED",
    reason: "",
    slot: 0,
    addedOn: "2026-01-01",
    acquiredOn: "",
    slottedOn: "",
    startedOn: "",
    finishedOn: "",
    liked: false,
    rating: 0,
    partsTracked: false,
    caughtUpGroup: 0,
    caughtUpPart: 0,
    partCount: 0,
    synopsis: "",
    series: "",
    seriesNumber: 0,
    originalTitle: "",
    originalLanguage: "",
    ...p,
  };
}

describe("matchesSearch", () => {
  it("empty needle matches all; otherwise title/author/reason, case-insensitive", () => {
    const names = (w: Work) => (w.authors.includes("a1") ? ["Herbert"] : []);
    const m = item({ title: "Dune", authors: ["a1"], reason: "Recommended by Sam" });
    expect(matchesSearch(m, "  ")).toBe(true);
    expect(matchesSearch(m, "dune")).toBe(true);
    expect(matchesSearch(m, "HERB", names)).toBe(true);
    expect(matchesSearch(m, "HERB")).toBe(false);
    expect(matchesSearch(m, "sam")).toBe(true);
    expect(matchesSearch(m, "zzz")).toBe(false);
  });
  it("finds a work by its series", () => {
    const m = item({ title: "Dune", series: "Dune Chronicles" });
    expect(matchesSearch(m, "chronicles")).toBe(true);
    expect(matchesSearch(item({ title: "Dune" }), "chronicles")).toBe(false);
  });
  it("matches tags, with or without a leading #; # restricts to tags", () => {
    const m = item({ title: "Dune", tags: ["garden", "sci-fi"] });
    expect(matchesSearch(m, "garden")).toBe(true);
    expect(matchesSearch(m, "#garden")).toBe(true);
    expect(matchesSearch(m, "#GARD")).toBe(true);
    expect(matchesSearch(m, "#dune")).toBe(false);
    expect(matchesSearch(m, "#")).toBe(true);
    expect(matchesSearch(item({ title: "Dune" }), "garden")).toBe(false);
  });
});

describe("sortGallery", () => {
  const a = item({ id: "a", title: "Alpha", addedOn: "2026-01-01", finishedOn: "", year: 2001 });
  const b = item({ id: "b", title: "Beta", addedOn: "2026-03-01", finishedOn: "2026-04-01", year: 0 });
  const c = item({ id: "c", title: "Gamma", addedOn: "2026-02-01", finishedOn: "2026-05-01", year: 1999 });
  const ids = (xs: Work[]) => xs.map((x) => x.id);

  it("does not mutate input", () => {
    const input = [c, b, a];
    sortGallery(input, "TITLE");
    expect(ids(input)).toEqual(["c", "b", "a"]);
  });
  it("TITLE is alphabetical", () => {
    expect(ids(sortGallery([c, b, a], "TITLE"))).toEqual(["a", "b", "c"]);
  });
  it("ADDED is newest first", () => {
    expect(ids(sortGallery([a, b, c], "ADDED"))).toEqual(["b", "c", "a"]);
  });
  it("FINISHED is newest first, never-finished last", () => {
    expect(ids(sortGallery([a, b, c], "FINISHED"))).toEqual(["c", "b", "a"]);
  });
  it("YEAR is newest release first, unknown year last", () => {
    expect(ids(sortGallery([a, b, c], "YEAR"))).toEqual(["a", "c", "b"]);
  });
});

describe("sameSeries", () => {
  it("lists the works of a series on the shelf in series order, unnumbered last", () => {
    const dune = item({ id: "1", title: "Dune", series: "Dune Chronicles", seriesNumber: 1 });
    const all = [
      item({ id: "3", title: "Children of Dune", series: "Dune Chronicles", seriesNumber: 3 }),
      item({ id: "x", title: "Hyperion", series: "Hyperion Cantos", seriesNumber: 1 }),
      item({ id: "0", title: "Tales", series: "Dune Chronicles" }),
      dune,
      item({ id: "2", title: "Dune Messiah", series: "Dune Chronicles", seriesNumber: 2 }),
      item({ id: "15", title: "A novella", series: "Dune Chronicles", seriesNumber: 1.5 }),
    ];
    expect(sameSeries(dune, all).map((w) => w.id)).toEqual(["1", "15", "2", "3", "0"]);
  });
  it("matches the series text whatever its case and punctuation, in any script", () => {
    const op = item({ id: "a", series: "ワンピース", seriesNumber: 1 });
    expect(sameSeries(item({ id: "b", series: "dune  chronicles!" }), [item({ id: "c", series: "Dune: Chronicles" })]).map((w) => w.id)).toEqual(["c"]);
    expect(sameSeries(op, [op, item({ id: "d", series: "ワンピース", seriesNumber: 2 }), item({ id: "e", series: "ナルト" })]).map((w) => w.id)).toEqual(["a", "d"]);
  });
  it("is empty for a work outside any series", () => {
    expect(sameSeries(item({ id: "a" }), [item({ id: "b" })])).toEqual([]);
  });
});
