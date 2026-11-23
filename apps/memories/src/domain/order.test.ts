import { describe, expect, it } from "vitest";
import type { Memory } from "./types";
import { newestFirst } from "./order";

const m = (id: string, date: string, createdAt = "2026-01-01T00:00:00Z"): Memory => ({ id, type: "memories_memory", title: id, body: "", folder: "Memories", tags: [], createdAt, updatedAt: "", deleted: 0, date, about: [] });

describe("the Memories grid's order", () => {
  it("puts the newest date first, a later-kept Memory first on one date", () => {
    const list = [m("old", "2020-05-01"), m("new", "2026-06-14"), m("same-a", "2024-01-01", "2026-01-01T00:00:00Z"), m("same-b", "2024-01-01", "2026-02-01T00:00:00Z")];
    expect(newestFirst(list).map((x) => x.id)).toEqual(["new", "same-b", "same-a", "old"]);
  });

  it("does not reorder what it was given", () => {
    const list = [m("a", "2020-01-01"), m("b", "2021-01-01")];
    newestFirst(list);
    expect(list.map((x) => x.id)).toEqual(["a", "b"]);
  });
});
