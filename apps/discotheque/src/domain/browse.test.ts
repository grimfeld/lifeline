import { describe, expect, it } from "vitest";
import type { Work } from "./types";
import { matchesSearch, sortGallery } from "./browse";

function item(p: Partial<Work>): Work {
  return {
    id: p.id ?? "x",
    updatedAt: "",
    deleted: 0,
    type: "music",
    title: "t",
    tags: [],
    folder: "",
    createdAt: "2026-01-01",
    creator: "",
    externalKey: "",
    coverUrl: "",
    size: 0,
    year: 0,
    engagement: "UNSTARTED",
    reason: "",
    addedOn: "2026-01-01",
    startedOn: "",
    finishedOn: "",
    ...p,
  };
}

describe("matchesSearch", () => {
  it("empty needle matches all; otherwise title/creator/reason, case-insensitive", () => {
    const m = item({ title: "Dune", creator: "Herbert", reason: "Recommended by Sam" });
    expect(matchesSearch(m, "  ")).toBe(true);
    expect(matchesSearch(m, "dune")).toBe(true);
    expect(matchesSearch(m, "HERB")).toBe(true);
    expect(matchesSearch(m, "sam")).toBe(true);
    expect(matchesSearch(m, "zzz")).toBe(false);
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
