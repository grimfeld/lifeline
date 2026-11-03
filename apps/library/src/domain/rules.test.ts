import { describe, expect, it } from "vitest";
import { onShelf, shelfLabel } from "./browse";
import { hasSlots, SLOTTED_TYPES } from "./workTypes";
import { parseQuickTitle } from "../data/repo";
import type { Work } from "./types";
import { abandon, finish, freeSlots, freeSlotsOf, isBuySignal, isFull, isStale, nightstand, promote, shelfOfShame, wantedList, slotAge, toggleDone, toggleOwned, shelfMove, acquisitionPatch } from "./rules";

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

describe("slots per medium", () => {
  it("books have five slots, comics three, games none; the lowest free slot is next", () => {
    const items = [item({ id: "a", slot: 1 }), item({ id: "b", slot: 3 }), item({ id: "c", type: "comic", slot: 1 })];
    expect(freeSlots(items, "book")).toEqual([2, 4, 5]);
    expect(freeSlots(items, "comic")).toEqual([2, 3]);
    expect(nightstand(items, "book").map((m) => m.id)).toEqual(["a", "b"]);
  });
  it("a full nightstand of one medium does not block another", () => {
    const items = [1, 2, 3].map((s) => item({ id: `c${s}`, type: "comic", slot: s }));
    expect(isFull(items, "comic")).toBe(true);
    expect(isFull(items, "book")).toBe(false);
  });
  it("freeSlotsOf answers once per shelf array: every tile asks the same, a new shelf asks again (CR-59)", () => {
    const items = [item({ id: "a", slot: 1 })];
    const first = freeSlotsOf(items, "book");
    expect(first).toEqual([2, 3, 4, 5]);
    expect(freeSlotsOf(items, "book")).toBe(first);
    expect(freeSlotsOf(items, "comic")).toEqual([1, 2, 3]);
    expect(freeSlotsOf([...items, item({ id: "b", slot: 2 })], "book")).toEqual([3, 4, 5]);
  });
});

describe("transitions", () => {
  it("finishing and abandoning free the slot; promote stamps the day", () => {
    expect(promote(2, "2026-08-16")).toEqual({ slot: 2, slottedOn: "2026-08-16" });
    expect(finish("2026-08-16")).toMatchObject({ engagement: "DONE", slot: 0, slottedOn: "", finishedOn: "2026-08-16" });
    expect(abandon()).toEqual({ engagement: "ABANDONED", slot: 0, slottedOn: "" });
  });
  it("one-click Read: finishes from any shelf freeing the slot; undo returns without re-slotting", () => {
    expect(toggleDone(item({ slot: 2 }), "2026-08-16")).toMatchObject({ engagement: "DONE", finishedOn: "2026-08-16", slot: 0, slottedOn: "" });
    expect(toggleDone(item({ engagement: "DONE", startedOn: "2026-08-01" }))).toEqual({ engagement: "IN_PROGRESS", finishedOn: "" });
    expect(toggleDone(item({ engagement: "DONE" }))).toEqual({ engagement: "UNSTARTED", finishedOn: "" });
  });
  it("one-click Bought: Wanted ⇄ Owned, the acquired day stamped then cleared", () => {
    expect(toggleOwned(item({}), "2026-08-16")).toEqual({ acquisition: "OWNED", acquiredOn: "2026-08-16" });
    expect(toggleOwned(item({ acquisition: "OWNED", acquiredOn: "2026-08-16" }))).toEqual({ acquisition: "WANTED", acquiredOn: "" });
  });
});

describe("shelf and acquisition moves, shared by the buttons and the Commands", () => {
  it("To read again clears every reading day", () => {
    expect(shelfMove(item({ engagement: "DONE", startedOn: "2026-08-01", finishedOn: "2026-08-09" }), "UNSTARTED")).toEqual({ engagement: "UNSTARTED", startedOn: "", finishedOn: "" });
  });
  it("Done to In progress keeps the started day and clears the finished one", () => {
    expect(shelfMove(item({ engagement: "DONE", startedOn: "2026-08-01", finishedOn: "2026-08-09" }), "IN_PROGRESS", "2026-08-16")).toEqual({ engagement: "IN_PROGRESS", finishedOn: "" });
  });
  it("starting a work never started stamps today", () => {
    expect(shelfMove(item({}), "IN_PROGRESS", "2026-08-16")).toEqual({ engagement: "IN_PROGRESS", startedOn: "2026-08-16" });
  });
  it("Done on a given day frees the slot; Dropped frees it too", () => {
    expect(shelfMove(item({ slot: 1 }), "DONE", "2026-08-16", "2026-08-02")).toEqual({ engagement: "DONE", finishedOn: "2026-08-02", slot: 0, slottedOn: "" });
    expect(shelfMove(item({ slot: 1 }), "ABANDONED")).toEqual({ engagement: "ABANDONED", slot: 0, slottedOn: "" });
  });
  it("acquiring stamps the day, Wanted clears it, Gone keeps it", () => {
    expect(acquisitionPatch("BORROWED", "2026-08-16")).toEqual({ acquisition: "BORROWED", acquiredOn: "2026-08-16" });
    expect(acquisitionPatch("WANTED")).toEqual({ acquisition: "WANTED", acquiredOn: "" });
    expect(acquisitionPatch("GONE")).toEqual({ acquisition: "GONE" });
  });
});

describe("signals", () => {
  it("slot age counts from start when started, else from slotting; stale at 60 days", () => {
    const m = item({ slot: 1, slottedOn: "2026-05-01", startedOn: "2026-07-01" });
    expect(slotAge(m, "2026-07-11")).toBe(10);
    expect(isStale(m, "2026-08-30")).toBe(true);
    expect(isStale(item({ slot: 0, slottedOn: "2026-01-01" }), "2026-08-30")).toBe(false);
  });
  it("wanted + slotted is a buy signal; owned + unstarted is the shelf of shame, oldest first", () => {
    expect(isBuySignal(item({ slot: 1 }))).toBe(true);
    expect(isBuySignal(item({ slot: 1, acquisition: "OWNED" }))).toBe(false);
    expect(isBuySignal(item({ slot: 0 }))).toBe(false);
    const s = shelfOfShame([
      item({ id: "n", acquisition: "OWNED", acquiredOn: "2026-03-01" }),
      item({ id: "o", acquisition: "OWNED", acquiredOn: "2025-01-01" }),
      item({ id: "r", acquisition: "OWNED", engagement: "DONE" }),
    ]);
    expect(s.map((m) => m.id)).toEqual(["o", "n"]);
  });
});

describe("wantedList", () => {
  it("lists every Wanted item, slotted first then oldest wish first", () => {
    const list = wantedList([
      item({ id: "young", acquisition: "WANTED", slot: 0, addedOn: "2026-06-01" }),
      item({ id: "owned", acquisition: "OWNED", slot: 0 }),
      item({ id: "old", acquisition: "WANTED", slot: 0, addedOn: "2025-01-01" }),
      item({ id: "next", acquisition: "WANTED", slot: 2, addedOn: "2026-07-01" }),
    ]);
    expect(list.map((m) => m.id)).toEqual(["next", "old", "young"]);
  });
});

describe("shelves and slots (ADR 0006 amendment)", () => {
  it("every reading medium has slots — books, comics and manga", () => {
    expect(SLOTTED_TYPES).toEqual(["book", "comic", "manga"]);
    expect(hasSlots("book")).toBe(true);
  });
  it("shelf labels follow the medium's verb", () => {
    expect(shelfLabel("UNSTARTED", "book")).toBe("To read");
    expect(shelfLabel("UNSTARTED", "comic")).toBe("To read");
    expect(shelfLabel("UNSTARTED", "all")).toBe("To do");
    expect(shelfLabel("ABANDONED", "book")).toBe("Dropped");
    expect(onShelf(item({ engagement: "DONE" }), "DONE")).toBe(true);
    expect(onShelf(item({ engagement: "DONE" }), "ALL")).toBe(true);
    expect(onShelf(item({ engagement: "DONE" }), "UNSTARTED")).toBe(false);
  });
  it("parses quick titles", () => {
    expect(parseQuickTitle("Dune — Frank Herbert")).toEqual({ title: "Dune", author: "Frank Herbert" });
    expect(parseQuickTitle("Heat by Michael Mann")).toEqual({ title: "Heat", author: "Michael Mann" });
    expect(parseQuickTitle("Spider-Man")).toEqual({ title: "Spider-Man", author: "" });
    expect(parseQuickTitle("Kind of Blue - Miles Davis")).toEqual({ title: "Kind of Blue", author: "Miles Davis" });
  });
});
