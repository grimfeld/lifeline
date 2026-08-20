import { describe, expect, it } from "vitest";
import { onShelf, shelfLabel } from "./browse";
import { hasSlots, SLOTTED_TYPES } from "./mediaTypes";
import { parseQuickTitle } from "../data/repo";
import type { MediaItem } from "./types";
import { abandon, finish, freeSlots, isBuySignal, isFull, isStale, nightstand, promote, shelfOfShame, shoppingList, slotAge } from "./rules";

function item(p: Partial<MediaItem>): MediaItem {
  return {
    id: p.id ?? "x",
    updatedAt: "",
    deleted: 0,
    type: "book",
    title: "t",
    tags: [],
    folder: "",
    createdAt: "2026-01-01",
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

describe("slots per medium", () => {
  it("books have five slots, comics three, games none; the lowest free slot is next", () => {
    const items = [item({ id: "a", slot: 1 }), item({ id: "b", slot: 3 }), item({ id: "c", type: "comic", slot: 1 })];
    expect(freeSlots(items, "book")).toEqual([2, 4, 5]);
    expect(freeSlots(items, "comic")).toEqual([2, 3]);
    expect(freeSlots(items, "game")).toEqual([]);
    expect(nightstand(items, "book").map((m) => m.id)).toEqual(["a", "b"]);
  });
  it("a full nightstand of one medium does not block another", () => {
    const items = [1, 2, 3].map((s) => item({ id: `c${s}`, type: "comic", slot: s }));
    expect(isFull(items, "comic")).toBe(true);
    expect(isFull(items, "book")).toBe(false);
  });
});

describe("transitions", () => {
  it("finishing and abandoning free the slot; promote stamps the day", () => {
    expect(promote(2, "2026-08-16")).toEqual({ slot: 2, slottedOn: "2026-08-16" });
    expect(finish("2026-08-16")).toMatchObject({ engagement: "DONE", slot: 0, slottedOn: "", finishedOn: "2026-08-16" });
    expect(abandon()).toEqual({ engagement: "ABANDONED", slot: 0, slottedOn: "" });
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

describe("shoppingList", () => {
  it("lists every Wanted item, slotted first then oldest wish first", () => {
    const list = shoppingList([
      item({ id: "young", acquisition: "WANTED", slot: 0, addedOn: "2026-06-01" }),
      item({ id: "owned", acquisition: "OWNED", slot: 0 }),
      item({ id: "old", acquisition: "WANTED", slot: 0, addedOn: "2025-01-01" }),
      item({ id: "next", acquisition: "WANTED", slot: 2, addedOn: "2026-07-01" }),
    ]);
    expect(list.map((m) => m.id)).toEqual(["next", "old", "young"]);
  });
});

describe("shelves and slots (ADR 0006 amendment)", () => {
  it("only books and comics have slots", () => {
    expect(SLOTTED_TYPES).toEqual(["book", "comic"]);
    expect(hasSlots("movie")).toBe(false);
  });
  it("shelf labels follow the medium's verb", () => {
    expect(shelfLabel("UNSTARTED", "book")).toBe("To read");
    expect(shelfLabel("UNSTARTED", "music")).toBe("To listen");
    expect(shelfLabel("UNSTARTED", "all")).toBe("To do");
    expect(shelfLabel("ABANDONED", "movie")).toBe("Dropped");
    expect(onShelf(item({ engagement: "DONE" }), "DONE")).toBe(true);
    expect(onShelf(item({ engagement: "DONE" }), "ALL")).toBe(true);
    expect(onShelf(item({ engagement: "DONE" }), "UNSTARTED")).toBe(false);
  });
  it("parses quick titles", () => {
    expect(parseQuickTitle("Dune — Frank Herbert")).toEqual({ title: "Dune", creator: "Frank Herbert" });
    expect(parseQuickTitle("Heat by Michael Mann")).toEqual({ title: "Heat", creator: "Michael Mann" });
    expect(parseQuickTitle("Spider-Man")).toEqual({ title: "Spider-Man", creator: "" });
    expect(parseQuickTitle("Kind of Blue - Miles Davis")).toEqual({ title: "Kind of Blue", creator: "Miles Davis" });
  });
});
