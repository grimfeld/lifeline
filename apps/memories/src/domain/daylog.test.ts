import { describe, expect, it } from "vitest";
import type { Memory } from "./types";
import { daylogMemories } from "./daylog";

const m = (id: string, date: string, title = id): Memory => ({ id, type: "memories_memory", title, body: "", folder: "Memories", tags: ["trip"], createdAt: "", updatedAt: "", deleted: 0, date, about: [] });

describe("daylogMemories", () => {
  it("lists each Memory dated that day as a Memory row linking to it, untimed", () => {
    const items = daylogMemories([m("a", "2026-06-14", "Beach"), m("b", "2026-06-15"), m("c", "2026-06-14", "Hike")], "2026-06-14");
    expect(items.map((i) => [i.kind, i.title, i.href, i.time ?? null])).toEqual([
      ["Memory", "Beach", "/app/journal/memories/a", null],
      ["Memory", "Hike", "/app/journal/memories/c", null],
    ]);
    expect(items[0]?.itemId).toBe("a");
    expect(items[0]?.appId).toBe("memories");
    expect(items[0]?.tags).toEqual(["trip"]);
  });
  it("says nothing about a day with no Memory", () => {
    expect(daylogMemories([m("a", "2026-06-14")], "2026-06-13")).toEqual([]);
  });
});
