import { describe, expect, it } from "vitest";
import type { MediaItem } from "./types";
import { abandon, finish, freeSlots, isBuySignal, isFull, isStale, nightstand, promote, shelfOfShame, slotAge } from "./rules";

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

describe("slots per medium", () => {
  it("books have five slots, games two; the lowest free slot is next", () => {
    const items = [item({ id: "a", slot: 1 }), item({ id: "b", slot: 3 }), item({ id: "g", type: "game", slot: 1 })];
    expect(freeSlots(items, "book")).toEqual([2, 4, 5]);
    expect(freeSlots(items, "game")).toEqual([2]);
    expect(nightstand(items, "book").map((m) => m.id)).toEqual(["a", "b"]);
  });
  it("a full nightstand of one medium does not block another", () => {
    const items = [1, 2].map((s) => item({ id: `g${s}`, type: "game", slot: s }));
    expect(isFull(items, "game")).toBe(true);
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
    const s = shelfOfShame([
      item({ id: "n", acquisition: "OWNED", acquiredOn: "2026-03-01" }),
      item({ id: "o", acquisition: "OWNED", acquiredOn: "2025-01-01" }),
      item({ id: "r", acquisition: "OWNED", engagement: "DONE" }),
    ]);
    expect(s.map((m) => m.id)).toEqual(["o", "n"]);
  });
});
