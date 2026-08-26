import { describe, expect, it } from "vitest";
import { onShelf, shelfLabel } from "./browse";
import { parseQuickTitle } from "../data/repo";
import type { Work } from "./types";
import { abandon, finish, rate, showsRating, start, toggleDone, toggleLiked } from "./rules";

function item(p: Partial<Work>): Work {
  return {
    id: p.id ?? "x", updatedAt: "", deleted: 0, type: "music", title: "t", tags: [], folder: "", createdAt: "2026-01-01",
    creator: "", externalKey: "", coverUrl: "", size: 0, year: 0, engagement: "UNSTARTED",
    reason: "", addedOn: "2026-01-01", startedOn: "", finishedOn: "", liked: false, rating: 0, ...p,
  } as Work;
}

describe("transitions", () => {
  it("start/finish stamp their days; abandon does not", () => {
    expect(start("2026-08-16")).toEqual({ engagement: "IN_PROGRESS", startedOn: "2026-08-16" });
    expect(finish("2026-08-16")).toEqual({ engagement: "DONE", finishedOn: "2026-08-16" });
    expect(abandon()).toEqual({ engagement: "ABANDONED" });
  });
});

describe("marks (ADR 0035)", () => {
  it("Done is one click from any shelf, and one click back", () => {
    expect(toggleDone(item({ engagement: "UNSTARTED" }), "2026-08-27")).toEqual({ engagement: "DONE", finishedOn: "2026-08-27" });
    expect(toggleDone(item({ engagement: "IN_PROGRESS", startedOn: "2026-08-01" }), "2026-08-27")).toEqual({ engagement: "DONE", finishedOn: "2026-08-27" });
    // Undo: a series that had been started goes back to Watching; a film to the shelf. Only finishedOn is cleared.
    expect(toggleDone(item({ engagement: "DONE", startedOn: "2026-08-01", finishedOn: "2026-08-27" }))).toEqual({ engagement: "IN_PROGRESS", finishedOn: "" });
    expect(toggleDone(item({ engagement: "DONE", finishedOn: "2026-08-27" }))).toEqual({ engagement: "UNSTARTED", finishedOn: "" });
  });

  it("liking and rating touch nothing but themselves", () => {
    expect(toggleLiked(item({ liked: false }))).toEqual({ liked: true });
    expect(toggleLiked(item({ liked: true }))).toEqual({ liked: false });
    expect(rate(item({ rating: 0 }), 4)).toEqual({ rating: 4 });
    expect(rate(item({ rating: 4 }), 4)).toEqual({ rating: 0 });
    expect(rate(item({ rating: 4 }), 2)).toEqual({ rating: 2 });
    expect(rate(item({ rating: 4 }), 9)).toEqual({ rating: 0 });
  });

  it("offers the stars once seen, or once rated", () => {
    expect(showsRating(item({ engagement: "UNSTARTED" }))).toBe(false);
    expect(showsRating(item({ engagement: "UNSTARTED", rating: 3 }))).toBe(true);
    expect(showsRating(item({ engagement: "DONE" }))).toBe(true);
    expect(showsRating(item({ engagement: "ABANDONED" }))).toBe(true);
  });
});

describe("shelf", () => {
  it("labels use the Discotheque's verbs", () => {
    expect(shelfLabel("UNSTARTED", "music")).toBe("To listen");
    expect(shelfLabel("ABANDONED", "music")).toBe("Dropped");
    expect(onShelf(item({ engagement: "DONE" }), "DONE")).toBe(true);
    expect(onShelf(item({ engagement: "DONE" }), "ALL")).toBe(true);
  });
  it("parses quick titles", () => {
    expect(parseQuickTitle("Heat by Michael Mann")).toEqual({ title: "Heat", creator: "Michael Mann" });
    expect(parseQuickTitle("Heat")).toEqual({ title: "Heat", creator: "" });
  });
});
