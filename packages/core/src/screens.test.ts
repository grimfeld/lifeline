import { describe, expect, it } from "vitest";
import { moveStacked, stackOrder } from "./screens";
import type { ScreenLayoutItem } from "./data/db";

const item = (instanceId: string, x: number, y: number, w = 6, h = 4): ScreenLayoutItem => ({
  instanceId,
  cardId: "test.card",
  x,
  y,
  w,
  h,
});

const ids = (items: ScreenLayoutItem[]) => stackOrder(items).map((l) => l.instanceId);

describe("stackOrder", () => {
  it("reads rows top to bottom, left to right within a row", () => {
    const items = [item("c", 0, 5), item("b", 6, 0), item("a", 0, 0)];
    expect(ids(items)).toEqual(["a", "b", "c"]);
  });
  it("leaves the given array alone", () => {
    const items = [item("b", 0, 5), item("a", 0, 0)];
    stackOrder(items);
    expect(items.map((l) => l.instanceId)).toEqual(["b", "a"]);
  });
});

describe("moveStacked", () => {
  it("swaps grid slots with the neighbour above", () => {
    const items = [item("a", 0, 0), item("b", 6, 0), item("c", 0, 5)];
    const next = moveStacked(items, "c", -1);
    expect(ids(next)).toEqual(["a", "c", "b"]);
    expect(next.find((l) => l.instanceId === "c")).toMatchObject({ x: 6, y: 0 });
    expect(next.find((l) => l.instanceId === "b")).toMatchObject({ x: 0, y: 5 });
  });
  it("swaps with the neighbour below", () => {
    const items = [item("a", 0, 0), item("b", 6, 0)];
    expect(ids(moveStacked(items, "a", 1))).toEqual(["b", "a"]);
  });
  it("keeps each card's own size", () => {
    const items = [item("a", 0, 0, 4, 3), item("b", 4, 0, 8, 9)];
    const next = moveStacked(items, "b", -1);
    expect(next.find((l) => l.instanceId === "b")).toMatchObject({ w: 8, h: 9 });
    expect(next.find((l) => l.instanceId === "a")).toMatchObject({ w: 4, h: 3 });
  });
  it("orders cards sharing a slot, which coordinates cannot", () => {
    const items = [item("a", 0, 0), item("b", 0, 0)];
    expect(ids(moveStacked(items, "b", -1))).toEqual(["b", "a"]);
  });
  it("does nothing at either end, or for an unknown card", () => {
    const items = [item("a", 0, 0), item("b", 0, 5)];
    expect(moveStacked(items, "a", -1)).toBe(items);
    expect(moveStacked(items, "b", 1)).toBe(items);
    expect(moveStacked(items, "nope", -1)).toBe(items);
  });
});
