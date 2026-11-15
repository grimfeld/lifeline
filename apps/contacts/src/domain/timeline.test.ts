import { afterEach, describe, expect, it, vi } from "vitest";
import { buildLinkIndex, type Document, type DocumentTypeDef } from "@lifeline/core";
import { personTypeDef } from "../types";
import { timelineMonths, timelineOf, timelineSides, type TimelineEntry } from "./timeline";
import type { UpcomingOccasion } from "./occasions";

const base = { folder: "", tags: [], createdAt: "2026-01-01", updatedAt: "2026-06-30T10:00:00Z", deleted: 0 as const };
const anne = { ...base, id: "anne", type: "contacts_person", title: "Anne", body: "", aliases: ["Mum"], relationship: "mother" } as unknown as Document;
const types: DocumentTypeDef[] = [
  personTypeDef,
  { id: "event", label: "Events", titleRule: "name", body: "none", fields: [{ key: "with", label: "With", kind: "link" }, { key: "notes", label: "Notes", kind: "longtext" }], linkingText: ["notes"], builtIn: true },
  { id: "daily", label: "Days", titleRule: "date", body: "optional", fields: [], builtIn: true },
  { id: "note", label: "Notes", titleRule: "name", body: "optional", fields: [], builtIn: true },
];
const docs: Document[] = [
  anne,
  // With her through the field, and named in its notes too: one entry, by the field.
  { ...base, id: "lunch", type: "event", title: "Lunch", date: "2026-11-02", with: ["anne"], notes: "with [[Anne]]" } as unknown as Document,
  // A Day names her twice, by name and alias: one entry, dated by its title.
  { ...base, id: "day", type: "daily", title: "2026-10-05", body: "[[Anne]] and [[Mum]]" } as unknown as Document,
  // An undated note: dated by its last change.
  { ...base, id: "note", type: "note", title: "Gift ideas", body: "for [[Anne]]" } as unknown as Document,
];
const idx = buildLinkIndex(docs, types);

describe("a Person's timeline", () => {
  it("lists what links to them once each, newest first, dated by their own day", () => {
    expect(timelineOf(idx, "anne").map((e) => [e.sourceId, e.day, e.field])).toEqual([
      ["lunch", "2026-11-02", "with"],
      ["day", "2026-10-05", undefined],
      ["note", "2026-06-30", undefined],
    ]);
  });
  it("groups it by month, newest month first", () => {
    expect(timelineSides(timelineOf(idx, "anne"), [], "2026-11-14").past.map((m) => [m.month, m.stops.length])).toEqual([
      ["2026-11", 1],
      ["2026-10", 1],
      ["2026-06", 1],
    ]);
  });
  it("puts what has no day in a month of its own, null, last", () => {
    const undated = { sourceId: "u", type: "note", title: "Undated", day: null, ownDay: false };
    const dated = { sourceId: "d", type: "note", title: "Dated", day: "2026-11-02", ownDay: true };
    expect(timelineSides([dated, undated], [], "2026-11-14").past.map((m) => m.month)).toEqual(["2026-11", null]);
  });
  it("is empty for someone nothing links to", () => {
    expect(timelineOf(idx, "nobody")).toEqual([]);
  });
});

describe("the two sides of the Today line", () => {
  afterEach(() => vi.unstubAllEnvs());
  const today = "2026-11-14";
  const entry = (sourceId: string, day: string | null): TimelineEntry => ({ sourceId, type: "event", title: sourceId, day, ownDay: day !== null, field: "with" });
  const occasion = (label: string, date: string, inDays: number): UpcomingOccasion => ({ personId: "anne", occasionId: label, name: "Anne", label, date, inDays, age: null });
  const names = (months: ReturnType<typeof timelineSides>["ahead"]) =>
    months.map((m) => [m.month, m.stops.map((s) => (s.kind === "occasion" ? s.occasion.label : s.entry.sourceId))]);
  // As timelineOf gives them: newest first.
  const entries = [entry("housewarming", "2026-12-13"), entry("film", "2026-11-15"), entry("tonight", "2026-11-14"), entry("day", "2026-10-28"), entry("undated", null)];
  const occasions = [occasion("Today's", "2026-11-14", 0), occasion("Birthday", "2026-11-20", 6), occasion("Wedding", "2027-03-01", 107)];
  const sides = timelineSides(entries, occasions, today);

  it("puts today and what is after it above the line, Occasions and Documents in one order, furthest first", () => {
    expect(names(sides.ahead)).toEqual([
      ["2027-03", ["Wedding"]],
      ["2026-12", ["housewarming"]],
      ["2026-11", ["Birthday", "film", "Today's", "tonight"]],
    ]);
  });
  it("keeps what is past, then what has no day, below it", () => {
    expect(names(sides.past)).toEqual([
      ["2026-10", ["day"]],
      [null, ["undated"]],
    ]);
  });
  it("says how soon a Document ahead is, and nothing for one past", () => {
    const stops = [...sides.ahead, ...sides.past].flatMap((m) => m.stops).filter((s) => s.kind === "entry");
    expect(stops.map((s) => [s.entry.sourceId, s.inDays])).toEqual([
      ["housewarming", 29],
      ["film", 1],
      ["tonight", 0],
      ["day", undefined],
      ["undated", undefined],
    ]);
  });
  it("shows a Document however far ahead it is", () => {
    expect(names(timelineSides([entry("far", "2030-01-01")], [], today).ahead)).toEqual([["2030-01", ["far"]]]);
  });
  it("keeps a note last changed today below the line: its day is not its own", () => {
    vi.stubEnv("TZ", "UTC");
    const note = { ...base, id: "n", type: "note", title: "Gift ideas", body: "for [[Anne]]", updatedAt: "2026-11-14T10:00:00Z" } as unknown as Document;
    const sides = timelineSides(timelineOf(buildLinkIndex([anne, note], types), "anne"), [], today);
    expect(sides.ahead).toEqual([]);
    const first = sides.past[0]?.stops[0];
    expect(first?.kind === "entry" && first.entry.sourceId).toBe("n");
    expect(first?.kind === "entry" && first.inDays).toBeUndefined();
  });
  it("keeps an Event still under way above the line, by its first day, with no how soon", () => {
    const trip = { ...base, id: "trip", type: "event", title: "Trip", date: "2026-11-13", endDate: "2026-11-20", with: ["anne"] } as unknown as Document;
    const over = { ...base, id: "over", type: "event", title: "Weekend", date: "2026-11-07", endDate: "2026-11-13", with: ["anne"] } as unknown as Document;
    const sides = timelineSides(timelineOf(buildLinkIndex([anne, trip, over], types), "anne"), [], today);
    expect(names(sides.ahead)).toEqual([["2026-11", ["trip"]]]);
    expect(names(sides.past)).toEqual([["2026-11", ["over"]]]);
    const [stop] = sides.ahead[0]!.stops;
    expect(stop?.kind === "entry" && stop.day).toBe("2026-11-13");
    expect(stop?.kind === "entry" && stop.inDays).toBeUndefined();
  });
  it("keeps an Event ending today above the line, below one starting today", () => {
    const ending = { ...entry("ending", "2026-11-10"), endDay: "2026-11-14" };
    expect(names(timelineSides([entry("tonight", "2026-11-14"), ending], [], today).ahead)).toEqual([["2026-11", ["tonight", "ending"]]]);
  });
  it("keeps an Event dated today above the line, saying today", () => {
    const [stop] = timelineSides([entry("tonight", "2026-11-14")], [], today).ahead[0]!.stops;
    expect(stop?.kind === "entry" && stop.inDays).toBe(0);
  });
});

describe("an undated entry's day", () => {
  afterEach(() => vi.unstubAllEnvs());
  const timelineWith = (extra: object) => {
    const note = { ...base, id: "n", type: "note", title: "Gift ideas", body: "for [[Anne]]", ...extra } as unknown as Document;
    return timelineOf(buildLinkIndex([anne, note], types), "anne");
  };
  it("is the local day of the timestamp, not the UTC one", () => {
    vi.stubEnv("TZ", "America/New_York"); // UTC-5 in winter
    // 23:30 on 30 Nov local is 04:30 on 1 Dec UTC.
    const [e] = timelineWith({ updatedAt: "2026-12-01T04:30:00Z" });
    expect(e?.day).toBe("2026-11-30");
    expect(timelineMonths([{ kind: "entry", day: e!.day, entry: e! }]).map((m) => m.month)).toEqual(["2026-11"]);
  });
  it("ignores a date in the title of a note, but not of a Day", () => {
    vi.stubEnv("TZ", "UTC");
    expect(timelineWith({ title: "2025-01-01 resolutions", updatedAt: "2026-06-30T10:00:00Z" })[0]?.day).toBe("2026-06-30");
  });
});
