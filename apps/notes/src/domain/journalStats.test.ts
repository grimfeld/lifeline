import { describe, expect, it } from "vitest";
import {
  avg,
  currentStreak,
  entriesPerMonth,
  isWritten,
  lastDays,
  longestStreak,
  moodSeries,
  onThisDay,
  readMood,
  sameDayInYear,
  wordCount,
  wordsBetween,
  writtenContent,
  writtenDays,
} from "./journalStats";

const TEMPLATE = "```daylog\n```\n\n### Histoire du jour\n\n---\n### Citation du jour\n\n---\n### Quoi de neuf ?\n\n---\n### Et maintenant ?\n\n";
const daily = (title: string, body: string, mood?: string) => ({ type: "daily" as const, title, body, mood });

describe("onThisDay", () => {
  it("finds the same day in earlier years, most recent first", () => {
    const hits = onThisDay(["2024-08-18", "2023-08-18", "2022-08-19", "2026-08-18"], "2026-08-18");
    expect(hits).toEqual([
      { date: "2024-08-18", label: "2 years ago" },
      { date: "2023-08-18", label: "3 years ago" },
    ]);
  });
  it("last year only", () => {
    expect(onThisDay(["2025-08-18", "2024-08-18"], "2026-08-18", { years: "last" })).toEqual([{ date: "2025-08-18", label: "1 year ago" }]);
    expect(onThisDay(["2024-08-18"], "2026-08-18", { years: "last" })).toEqual([]);
  });
  it("optional 1- and 4-week lookbacks come first", () => {
    const hits = onThisDay(["2026-08-11", "2026-08-04", "2026-07-21", "2025-08-18"], "2026-08-18", { alsoWeeks: true });
    expect(hits.map((h) => h.label)).toEqual(["1 week ago", "4 weeks ago", "1 year ago"]);
    expect(hits[1].date).toBe("2026-07-21");
  });
  it("leap day falls back to Feb 28", () => {
    expect(sameDayInYear("2024-02-29", 2023)).toBe("2023-02-28");
    expect(sameDayInYear("2024-02-29", 2020)).toBe("2020-02-29");
    expect(onThisDay(["2023-02-28"], "2024-02-29")).toEqual([{ date: "2023-02-28", label: "1 year ago" }]);
  });
});

describe("written days & streaks", () => {
  it("template-only notes are not written", () => {
    expect(writtenContent(TEMPLATE)).toBe("");
    expect(isWritten(TEMPLATE)).toBe(false);
    expect(isWritten(TEMPLATE + "Went for a long walk by the river.")).toBe(true);
    expect(isWritten(TEMPLATE + "short")).toBe(false);
  });
  it("writtenDays only counts written daily notes", () => {
    const days = writtenDays([
      daily("2026-08-18", TEMPLATE + "A full sentence about the day."),
      daily("2026-08-17", TEMPLATE),
      { type: "plain" as const, title: "2026-08-16", body: "not a daily note but long enough" },
    ]);
    expect([...days]).toEqual(["2026-08-18"]);
  });
  it("current streak ends today or yesterday", () => {
    const days = new Set(["2026-08-15", "2026-08-16", "2026-08-17"]);
    expect(currentStreak(days, "2026-08-18")).toBe(3);
    expect(currentStreak(days, "2026-08-17")).toBe(3);
    expect(currentStreak(days, "2026-08-19")).toBe(0);
    expect(currentStreak(new Set(), "2026-08-19")).toBe(0);
  });
  it("longest streak", () => {
    expect(longestStreak(new Set(["2026-01-01", "2026-01-02", "2026-01-05", "2026-01-06", "2026-01-07"]))).toBe(3);
    expect(longestStreak(new Set())).toBe(0);
  });
  it("lastDays is oldest first and ends today", () => {
    expect(lastDays("2026-03-02", 3)).toEqual(["2026-02-28", "2026-03-01", "2026-03-02"]);
  });
});

describe("mood", () => {
  it("reads 1..5 from frontmatter", () => {
    expect(readMood(4)).toBe(4);
    expect(readMood("2")).toBe(2);
    expect(readMood(9)).toBeNull();
    expect(readMood("")).toBeNull();
    expect(readMood("no frontmatter")).toBeNull();
  });
  it("moodSeries fills missing days with null", () => {
    const s = moodSeries([daily("2026-08-18", "", "5"), daily("2026-08-16", "", "2")], 3, "2026-08-18");
    expect(s).toEqual([
      { date: "2026-08-16", mood: 2 },
      { date: "2026-08-17", mood: null },
      { date: "2026-08-18", mood: 5 },
    ]);
    expect(avg(s.map((p) => p.mood))).toBe(3.5);
    expect(avg([null, null])).toBeNull();
  });
});

describe("writing stats", () => {
  it("wordCount ignores frontmatter, fences and headings' markup", () => {
    expect(wordCount("---\nmood: 3\ntags: [a, b]\n---\n### Heading\n\nHello world, again.\n\n```daylog\nfoo bar\n```\n---\n")).toBe(4);
    expect(wordCount("")).toBe(0);
    expect(wordCount("[[Some Note|alias]] and *bold* — ok")).toBe(4);
  });
  it("wordsBetween sums daily notes in range", () => {
    const notes = [daily("2026-08-18", "one two"), daily("2026-08-10", "three"), daily("2026-07-01", "four five six")];
    expect(wordsBetween(notes, "2026-08-11", "2026-08-18")).toBe(2);
    expect(wordsBetween(notes, "2026-08-01", "2026-08-31")).toBe(3);
  });
  it("entriesPerMonth counts written notes per calendar month, oldest first", () => {
    const body = TEMPLATE + "A full sentence about the day.";
    const notes = [daily("2026-08-18", body), daily("2026-08-01", body), daily("2026-06-30", body), daily("2026-07-15", TEMPLATE), daily("2025-12-31", body)];
    expect(entriesPerMonth(notes, 3, "2026-08-18")).toEqual([
      { month: "2026-06", count: 1 },
      { month: "2026-07", count: 0 },
      { month: "2026-08", count: 2 },
    ]);
    expect(entriesPerMonth(notes, 2, "2026-01-10")[0]).toEqual({ month: "2025-12", count: 1 });
  });
});
