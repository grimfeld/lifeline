import { describe, expect, it } from "vitest";
import { daylogEntries } from "./daylog";
import type { Entry, Stat, StatKind } from "./types";

function stat(id: string, kind: StatKind, name: string, unit = ""): Stat {
  return { id, updatedAt: "", deleted: 0, name, kind, unit, color: "blue", defaultIncrement: 0, universeSize: 0, createdAt: "2026-01-01" };
}
function entry(id: string, statId: string, local: string, value = 1, item = ""): Entry {
  return { id, updatedAt: "", deleted: 0, statId, value, item, ts: new Date(local).toISOString() };
}

const stats = [stat("a", "additive", "Push-ups"), stat("m", "measurement", "Weight", "kg"), stat("b", "boolean", "Meditated"), stat("c", "collection", "Countries")];

describe("daylogEntries", () => {
  it("phrases each kind, in time order, with the stat's href", () => {
    const entries = [
      entry("e2", "m", "2026-08-16T08:30", 72.5),
      entry("e1", "a", "2026-08-16T07:05", 20),
      entry("e3", "c", "2026-08-16T12:00", 1, "Japan"),
    ];
    const items = daylogEntries(stats, entries, "2026-08-16");
    expect(items.map((i) => [i.kind, i.title, i.time, i.href])).toEqual([
      ["Logged", "+20 Push-ups", "07:05", "/app/stats/a"],
      ["Measured", "Weight 72.5 kg", "08:30", "/app/stats/m"],
      ["Collected", "Japan · Countries", "12:00", "/app/stats/c"],
    ]);
    expect(items.every((i) => i.appId === "stats" && i.key.startsWith("stats/"))).toBe(true);
  });

  it("collapses a boolean stat to one untimed Marked line per day", () => {
    const entries = [entry("e1", "b", "2026-08-16T07:00"), entry("e2", "b", "2026-08-16T21:00"), entry("e3", "b", "2026-08-15T09:00")];
    const items = daylogEntries(stats, entries, "2026-08-16");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "Marked", title: "Meditated", time: null, itemId: "b" });
  });

  it("uses local day boundaries", () => {
    const entries = [entry("e1", "a", "2026-08-16T00:00", 1), entry("e2", "a", "2026-08-16T23:59", 2), entry("e3", "a", "2026-08-17T00:00", 3), entry("e4", "a", "2026-08-15T23:59", 4)];
    const items = daylogEntries(stats, entries, "2026-08-16");
    expect(items.map((i) => i.title)).toEqual(["+1 Push-ups", "+2 Push-ups"]);
  });

  it("skips entries whose stat is unknown", () => {
    expect(daylogEntries(stats, [entry("e1", "zzz", "2026-08-16T10:00")], "2026-08-16")).toEqual([]);
  });
});
