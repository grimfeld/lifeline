import { describe, expect, it } from "vitest";
import { average, datesOf, monthWeeks, moodByDate, moodOn, readLevel, recordedCount, shiftMonth, weekOverWeek, yearColumns } from "./grid";
import type { Mood } from "./types";

const mood = (title: string, level: unknown): Mood => ({ id: title, type: "mood", title, updatedAt: "", deleted: 0, tags: [], folder: "", level } as unknown as Mood);

describe("readLevel", () => {
  it("accepts 1..5, as number or string", () => {
    expect(readLevel(1)).toBe(1);
    expect(readLevel("5")).toBe(5);
  });
  it("rejects anything else", () => {
    for (const v of [null, undefined, "", 0, 6, 2.5, "great", {}]) expect(readLevel(v)).toBeNull();
  });
});

describe("moodByDate", () => {
  it("keys valid Moods by their date title", () => {
    const m = moodByDate([mood("2026-09-01", 4), mood("2026-09-02", 2)]);
    expect(moodOn(m, "2026-09-01")).toBe(4);
    expect(moodOn(m, "2026-09-02")).toBe(2);
  });
  it("skips non-date titles and out-of-range levels", () => {
    const m = moodByDate([mood("not a date", 3), mood("2026-09-03", 9)]);
    expect(m.size).toBe(0);
  });
  it("a day with no Mood is an absence, not a level", () => {
    expect(moodOn(moodByDate([]), "2026-09-01")).toBeNull();
  });
});

describe("monthWeeks", () => {
  it("pads to whole Monday-first weeks", () => {
    // 1 Sep 2026 is a Tuesday: one leading blank.
    const weeks = monthWeeks(2026, 9);
    expect(weeks[0][0]).toBeNull();
    expect(weeks[0][1]).toBe("2026-09-01");
    for (const w of weeks) expect(w).toHaveLength(7);
  });
  it("holds every day of the month exactly once", () => {
    expect(datesOf(monthWeeks(2026, 2))).toHaveLength(28);
    expect(datesOf(monthWeeks(2024, 2))).toHaveLength(29);
    expect(datesOf(monthWeeks(2026, 1))).toHaveLength(31);
  });
  it("starts a month that falls on a Monday with no padding", () => {
    // 1 Jun 2026 is a Monday.
    expect(monthWeeks(2026, 6)[0][0]).toBe("2026-06-01");
  });
});

describe("yearColumns", () => {
  it("is twelve columns of 31 rows, short months ending early", () => {
    const cols = yearColumns(2026);
    expect(cols).toHaveLength(12);
    for (const c of cols) expect(c).toHaveLength(31);
    expect(cols[1][27]).toBe("2026-02-28");
    expect(cols[1][28]).toBeNull();
    expect(cols[3][30]).toBeNull(); // April has 30 days
  });
  it("covers the whole year and nothing else", () => {
    const dates = datesOf(yearColumns(2025));
    expect(dates).toHaveLength(365);
    expect(new Set(dates).size).toBe(365);
    expect(dates.every((d) => d.startsWith("2025-"))).toBe(true);
  });
  it("keeps the leap day", () => {
    expect(datesOf(yearColumns(2024))).toHaveLength(366);
  });
});

describe("average", () => {
  it("ignores days with no Mood", () => {
    expect(average([5, null, 3])).toBe(4);
  });
  it("is null when nothing was recorded", () => {
    expect(average([null, null])).toBeNull();
  });
});

describe("weekOverWeek", () => {
  const range = (from: string, days: number, level: number): Mood[] =>
    Array.from({ length: days }, (_, i) => {
      const d = new Date(Date.UTC(2026, 8, Number(from.slice(8)) + i));
      return mood(d.toISOString().slice(0, 10), level);
    });

  it("reads up when this week beats last week", () => {
    const by = moodByDate([...range("2026-09-01", 7, 2), ...range("2026-09-08", 7, 4)]);
    expect(weekOverWeek(by, "2026-09-14").direction).toBe("up");
  });
  it("reads down the other way round", () => {
    const by = moodByDate([...range("2026-09-01", 7, 5), ...range("2026-09-08", 7, 1)]);
    expect(weekOverWeek(by, "2026-09-14").direction).toBe("down");
  });
  it("is unknown when either week is empty — never a false trend", () => {
    const by = moodByDate(range("2026-09-08", 7, 3));
    expect(weekOverWeek(by, "2026-09-14").direction).toBe("unknown");
  });
});

describe("recordedCount", () => {
  it("counts only the days that carry a Mood", () => {
    const by = moodByDate([mood("2026-09-01", 4)]);
    expect(recordedCount(by, ["2026-09-01", "2026-09-02"])).toBe(1);
  });
});

describe("shiftMonth", () => {
  it("rolls over both year boundaries", () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ y: 2027, m: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ y: 2025, m: 12 });
  });
});
