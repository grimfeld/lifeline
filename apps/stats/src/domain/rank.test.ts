import { describe, expect, it } from "vitest";
import { rankByStreak, sortCollections } from "./rank";
import type { Entry, Stat } from "./types";

const now = new Date(2026, 7, 16, 15, 0);
function stat(id: string, title: string, kind: Stat["kind"], universeSize = 0): Stat {
  return { id, type: "stat", title, tags: [], folder: "", kind, unit: "", color: "blue", defaultIncrement: 0, universeSize, createdAt: "2026-01-01", updatedAt: "", deleted: 0 };
}
function e(statId: string, day: string, item = ""): Entry {
  return { id: `${statId}-${day}-${item}`, type: "stat_entry", title: "", tags: [], folder: "", createdAt: day, updatedAt: "", deleted: 0, statId, value: 1, item, ts: new Date(`${day}T10:00`).toISOString() };
}
function byStat(entries: Entry[]): Map<string, Entry[]> {
  const m = new Map<string, Entry[]>();
  for (const x of entries) m.set(x.statId, [...(m.get(x.statId) ?? []), x]);
  return m;
}

describe("rankByStreak", () => {
  const stats = [stat("a", "Zeta", "boolean"), stat("b", "Alpha", "boolean"), stat("c", "Beta", "boolean"), stat("d", "Push-ups", "additive")];
  const m = byStat([
    e("a", "2026-08-15"),
    e("a", "2026-08-16"),
    e("b", "2026-08-14"),
    e("b", "2026-08-15"),
    e("b", "2026-08-01"),
    e("b", "2026-08-02"),
    e("b", "2026-08-03"),
  ]);
  it("ranks boolean stats by current streak desc, ties by name, ignores other kinds", () => {
    const rows = rankByStreak(stats, m, false, now);
    expect(rows.map((r) => r.stat.id)).toEqual(["b", "a", "c"]);
    expect(rows.map((r) => r.current)).toEqual([2, 2, 0]);
    expect(rows[0].longest).toBe(3);
  });
  it("activeOnly drops streak 0", () => {
    expect(rankByStreak(stats, m, true, now).map((r) => r.stat.id)).toEqual(["b", "a"]);
  });
});

describe("sortCollections", () => {
  const stats = [
    stat("c1", "Countries", "collection", 10),
    stat("c2", "Beers", "collection", 4),
    stat("c3", "Albums", "collection"),
    stat("c4", "Zoos", "collection"),
    stat("x", "Weight", "measurement"),
  ];
  const m = byStat([
    e("c1", "2026-01-01", "France"),
    e("c1", "2026-01-02", "france"),
    e("c1", "2026-01-03", "Spain"),
    e("c2", "2026-01-01", "IPA"),
    e("c2", "2026-01-02", "Stout"),
    e("c2", "2026-01-03", "Lager"),
    e("c3", "2026-01-01", "OK Computer"),
    e("c4", "2026-01-01", "Berlin"),
    e("c4", "2026-01-02", "Vienna"),
  ]);
  it("computes distinct counts and percent, sorts by progress with universe-less last", () => {
    const rows = sortCollections(stats, m, "progress");
    expect(rows.map((r) => r.stat.id)).toEqual(["c2", "c1", "c4", "c3"]);
    expect(rows[0].percent).toBe(75);
    expect(rows[1].count).toBe(2);
    expect(rows[1].percent).toBe(20);
    expect(rows[2].percent).toBeNull();
  });
  it("sorts by name when asked", () => {
    expect(sortCollections(stats, m, "name").map((r) => r.stat.title)).toEqual(["Albums", "Beers", "Countries", "Zoos"]);
  });
});
