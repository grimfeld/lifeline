import { describe, expect, it } from "vitest";
import { isPoolItem, resolveItemRows, type ResolveOptions } from "./surface";
import type { Placement } from "../data/db";
import type { SchedulableItem } from "./schedulable";

function item(over: Partial<SchedulableItem> = {}): SchedulableItem {
  return { key: "tasks/t1", appId: "tasks", itemId: "t1", title: "Write report", date: "2026-08-27", urgency: "upcoming", ...over };
}
function pl(over: Partial<Placement>): Placement {
  return { id: over.id ?? "p", appId: "tasks", itemId: "t1", date: "2026-08-24", updatedAt: "", deleted: 0, start: null, end: null, ...over };
}
const opts: ResolveOptions = { ownsMoves: true, overduePolicy: "stay", today: "2026-08-25", now: "11:00" };

describe("resolveItemRows (ADR 0028)", () => {
  it("yields the item on its own day plus one row per Time block", () => {
    const rows = resolveItemRows(item(), [pl({ id: "a", date: "2026-08-24", start: "09:00", end: "11:00" }), pl({ id: "b", date: "2026-08-26", start: "14:00", end: "16:00" })], opts);
    expect(rows.map((r) => [r.displayDate, r.start, r.placementId])).toEqual([
      ["2026-08-27", null, undefined],
      ["2026-08-24", "09:00", "a"],
      ["2026-08-26", "14:00", "b"],
    ]);
  });
  it("counts only the blocks still ahead on the own-day row", () => {
    const rows = resolveItemRows(
      item(),
      [
        pl({ id: "past", date: "2026-08-24", start: "09:00", end: "11:00" }),
        pl({ id: "earlier-today", date: "2026-08-25", start: "08:00", end: "10:00" }),
        pl({ id: "later-today", date: "2026-08-25", start: "12:00", end: "13:00" }),
        pl({ id: "next", date: "2026-08-26", start: "14:00", end: "16:00" }),
      ],
      opts,
    );
    expect(rows[0].blocksAhead).toBe(2);
  });
  it("reads a block ending at midnight as still ahead until the day is over (CR-10)", () => {
    const late = { ...opts, now: "23:00" };
    const rows = resolveItemRows(item(), [pl({ id: "night", date: "2026-08-25", start: "22:00", end: "00:00" })], late);
    expect(rows[0].blocksAhead).toBe(1);
  });
  it("gives an end-less block the default length, as Push does", () => {
    const rows = resolveItemRows(item(), [pl({ id: "open", date: "2026-08-25", start: "10:45", end: null })], opts);
    expect(rows[0].blocksAhead).toBe(1);
  });
  it("a block never moves the item's own day, even for Apps that own no moves", () => {
    const rows = resolveItemRows(item({ appId: "chores" }), [pl({ id: "a", date: "2026-08-24", start: "09:00", end: "10:00" })], { ...opts, ownsMoves: false });
    expect(rows[0].displayDate).toBe("2026-08-27");
    expect(rows[0].placementId).toBeUndefined();
  });
  it("a day pin still moves an item whose App owns no moves", () => {
    const rows = resolveItemRows(item(), [pl({ id: "pin", date: "2026-08-30" })], { ...opts, ownsMoves: false });
    expect(rows).toHaveLength(1);
    expect(rows[0].displayDate).toBe("2026-08-30");
    expect(rows[0].placementId).toBe("pin");
  });
  it("ignores day pins for Apps that own their day", () => {
    const rows = resolveItemRows(item(), [pl({ id: "pin", date: "2026-08-30" })], opts);
    expect(rows[0].displayDate).toBe("2026-08-27");
  });
  it("rolls the own-day row forward per policy but never a block", () => {
    const rows = resolveItemRows(item({ date: "2026-08-20" }), [pl({ id: "a", date: "2026-08-21", start: "09:00", end: "10:00" })], { ...opts, ownsMoves: false, overduePolicy: "roll-forward" });
    expect(rows.map((r) => r.displayDate)).toEqual(["2026-08-25", "2026-08-21"]);
  });
  it("hides blocks after the completion day and counts none ahead once done", () => {
    const rows = resolveItemRows(item({ completedOn: "2026-08-25" }), [pl({ id: "a", date: "2026-08-24", start: "09:00", end: "10:00" }), pl({ id: "b", date: "2026-08-28", start: "09:00", end: "10:00" })], opts);
    expect(rows.map((r) => r.placementId)).toEqual([undefined, "a"]);
    expect(rows[0].blocksAhead).toBe(0);
  });
  it("an unplaced item has no own-day row but keeps its block rows", () => {
    const rows = resolveItemRows(item({ date: null }), [pl({ id: "a", date: "2026-08-26", start: "09:00", end: "10:00" })], opts);
    expect(rows.map((r) => [r.displayDate, r.start])).toEqual([["2026-08-26", "09:00"]]);
  });
});

describe("isPoolItem", () => {
  it("keeps a blocked item in the pool", () => {
    expect(isPoolItem(item({ date: null }), [pl({ start: "09:00", end: "10:00" })], true)).toBe(true);
  });
  it("leaves the pool on a day, on completion, or on a day pin for a move-less App", () => {
    expect(isPoolItem(item(), [], true)).toBe(false);
    expect(isPoolItem(item({ date: null, completedOn: "2026-08-25" }), [], true)).toBe(false);
    expect(isPoolItem(item({ date: null }), [pl({ date: "2026-08-26" })], false)).toBe(false);
    expect(isPoolItem(item({ date: null }), [pl({ date: "2026-08-26" })], true)).toBe(true);
  });
});
