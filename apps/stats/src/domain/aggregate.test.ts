import { describe, expect, it } from "vitest";
import {
  average,
  booleanHeadline,
  checklist,
  cleanItemList,
  collectedItems,
  collectionUniverse,
  currentStreak,
  dailySeries,
  dayKey,
  headline,
  longestStreak,
  markedDays,
  noonOf,
  periodStart,
  previousPeriodHeadline,
} from "./aggregate";
import type { Entry } from "./types";

const now = new Date(2026, 7, 16, 15, 0); // local Aug 16 2026, 15:00
function e(day: string, value = 1, item = ""): Entry {
  return { id: `${day}-${value}-${item}`, type: "stat_entry", title: "", tags: [], folder: "", createdAt: day, updatedAt: "", deleted: 0, statId: "s", value, item, ts: new Date(`${day}T10:00`).toISOString() };
}

describe("periods", () => {
  it("week/month are trailing windows, year is YTD, all is unbounded", () => {
    expect(dayKey(periodStart("week", now)!)).toBe("2026-08-10");
    expect(dayKey(periodStart("month", now)!)).toBe("2026-07-18");
    expect(dayKey(periodStart("year", now)!)).toBe("2026-01-01");
    expect(periodStart("all", now)).toBeNull();
  });
});

describe("additive", () => {
  it("zero-fills days and accumulates", () => {
    const pts = dailySeries([e("2026-08-14", 10), e("2026-08-14", 5), e("2026-08-16", 1)], "week", now);
    expect(pts.map((p) => p.sum)).toEqual([0, 0, 0, 0, 15, 0, 1]);
    expect(pts.at(-1)?.cumulative).toBe(16);
    expect(headline("additive", [e("2026-08-01", 3), e("2026-08-15", 4)], "week", now)).toBe(4);
  });
  it("previous-period sum covers the window just before the period", () => {
    const es = [e("2026-08-02", 1), e("2026-08-03", 2), e("2026-08-09", 4), e("2026-08-10", 8), e("2026-07-17", 16), e("2026-06-01", 32), e("2025-12-31", 64), e("2025-01-01", 128)];
    expect(previousPeriodHeadline(es, "week", now)).toBe(6); // Aug 3–9
    expect(previousPeriodHeadline(es, "month", now)).toBe(16); // Jun 18–Jul 17 (Jun 1 excluded)
    expect(previousPeriodHeadline(es, "year", now)).toBe(192); // 2025
    expect(previousPeriodHeadline(es, "all", now)).toBeNull();
  });
});

describe("measurement", () => {
  it("headline is the latest reading in period; average is the mean", () => {
    const es = [e("2026-08-01", 80), e("2026-08-12", 78), e("2026-08-15", 79)];
    expect(headline("measurement", es, "week", now)).toBe(79);
    expect(average(es, "week", now)).toBe(78.5);
    expect(headline("measurement", es.slice(0, 1), "week", now)).toBeNull();
  });
});

describe("boolean", () => {
  it("dedupes marks per day and counts against 7/30 denominators", () => {
    const days = markedDays([e("2026-08-15"), e("2026-08-15"), e("2026-08-01")]);
    expect(days.size).toBe(2);
    expect(booleanHeadline(days, "week", now)).toEqual({ count: 1, denominator: 7 });
    expect(booleanHeadline(days, "all", now)).toEqual({ count: 2, denominator: null });
  });
  it("current streak survives an unmarked today; longest is the best run ever", () => {
    const days = new Set(["2026-08-13", "2026-08-14", "2026-08-15", "2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04"]);
    expect(currentStreak(days, now)).toBe(3);
    expect(currentStreak(new Set(["2026-08-14"]), now)).toBe(0);
    expect(longestStreak(days)).toBe(4);
  });
  it("pins marks to local noon", () => {
    expect(dayKey(noonOf("2026-03-29"))).toBe("2026-03-29");
    expect(new Date(noonOf("2026-03-29")).getHours()).toBe(12);
  });
});

describe("collection", () => {
  it("dedupes by trimmed, case-folded name; first spelling wins", () => {
    const items = collectedItems([e("2026-08-02", 1, "france"), e("2026-08-01", 1, " France "), e("2026-08-03", 1, "Spain")]);
    expect(items.map((i) => i.name)).toEqual(["France", "Spain"]);
  });
});

describe("collection item list", () => {
  it("cleans a list: trims, drops blanks, dedupes by normalised name keeping the first spelling", () => {
    expect(cleanItemList([" France", "", "japan", "France ", "Japan", "  "])).toEqual(["France", "japan"]);
  });

  it("the list's length is the universe when there is one", () => {
    expect(collectionUniverse({ items: ["a", "b"], universeSize: 195 })).toBe(2);
    expect(collectionUniverse({ items: [], universeSize: 195 })).toBe(195);
    expect(collectionUniverse({ universeSize: 0 })).toBe(0);
  });

  it("checklist: list order, ticked by first collection, then collected items off the list", () => {
    const rows = checklist(["Peru", "France", "Japan"], [e("2026-08-10", 1, "france"), e("2026-08-01", 1, "France"), e("2026-08-05", 1, "Chile")]);
    expect(rows).toEqual([
      { name: "Peru", listed: true, collectedAt: null },
      { name: "France", listed: true, collectedAt: new Date("2026-08-01T10:00").toISOString() },
      { name: "Japan", listed: true, collectedAt: null },
      { name: "Chile", listed: false, collectedAt: new Date("2026-08-05T10:00").toISOString() },
    ]);
  });
});
