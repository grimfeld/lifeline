import { describe, expect, it } from "vitest";
import { agoLabel, remember } from "./remember";
import type { Memory } from "./types";

const mem = (id: string, date: string): Memory => ({ id, type: "memories_memory", title: id, body: "", date, about: [] }) as unknown as Memory;
const today = "2026-11-23";
const ids = (list: Memory[], step = 0) => remember(list, today, step)?.memory.id;

describe("remember", () => {
  it("is none with no Memory", () => expect(remember([], today, 0)).toBeUndefined());
  it("is none when every Memory is today or later", () => expect(remember([mem("a", today), mem("b", "2027-01-01")], today, 0)).toBeUndefined());
  it("excludes today's and future Memories from the pool", () => {
    const r = remember([mem("a", today), mem("b", "2027-01-01"), mem("c", "2020-01-01")], today, 0);
    expect(r?.memory.id).toBe("c");
    expect(r?.another).toBe(false);
  });
  it("prefers this date in an earlier year over any other", () => {
    const list = [mem("a", "2025-11-22"), mem("b", "2023-11-23"), mem("c", "2024-03-01"), mem("d", "2026-11-23")];
    for (const step of [0, 1, 5]) expect(ids(list, step)).toBe("b");
  });
  it("falls back to any earlier Memory", () => expect(["a", "b"]).toContain(ids([mem("a", "2025-11-22"), mem("b", "2024-03-01")])));
  it("gives the same pick whatever the input order", () => {
    const list = [mem("a", "2025-01-01"), mem("b", "2024-01-01"), mem("c", "2023-01-01"), mem("d", "2022-01-01")];
    expect(ids([...list].reverse())).toBe(ids(list));
  });
  it("changes with the date", () => {
    const list = Array.from({ length: 30 }, (_, i) => mem(`m${String(i).padStart(2, "0")}`, "2020-01-01"));
    const picks = new Set(["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26"].map((d) => remember(list, d, 0)?.memory.id));
    expect(picks.size).toBeGreaterThan(1);
  });
  it("Another steps to a different one and cycles back", () => {
    const list = [mem("a", "2025-01-01"), mem("b", "2024-01-01"), mem("c", "2023-01-01")];
    const seen = [0, 1, 2].map((s) => ids(list, s));
    expect(new Set(seen).size).toBe(3);
    expect(ids(list, 3)).toBe(seen[0]);
    expect(remember(list, today, 0)?.another).toBe(true);
  });
  it("hides Another with exactly one past Memory", () => expect(remember([mem("a", "2025-01-01")], today, 0)?.another).toBe(false));
  it("steps within the on-this-day Memories when there are several", () => {
    const list = [mem("a", "2025-11-23"), mem("b", "2024-11-23"), mem("c", "2020-01-01")];
    expect(new Set([0, 1, 2].map((s) => ids(list, s)))).toEqual(new Set(["a", "b"]));
  });
});

describe("agoLabel", () => {
  it.each([
    ["2023-11-23", "3 years ago"],
    ["2025-11-23", "1 year ago"],
    ["2025-11-24", "11 months ago"],
    ["2026-10-23", "1 month ago"],
    ["2026-11-09", "2 weeks ago"],
    ["2026-11-16", "1 week ago"],
    ["2026-11-22", "Yesterday"],
    ["2026-11-20", "3 days ago"],
  ])("%s is %s", (d, label) => expect(agoLabel(d, today)).toBe(label));
});
