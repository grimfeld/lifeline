import { afterEach, describe, expect, it, vi } from "vitest";
import { buildLinkIndex, type Document, type DocumentTypeDef } from "@lifeline/core";
import { personTypeDef } from "../types";
import { timelineMonths, timelineOf } from "./timeline";

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
    expect(timelineMonths(timelineOf(idx, "anne")).map((m) => [m.month, m.entries.length])).toEqual([
      ["2026-11", 1],
      ["2026-10", 1],
      ["2026-06", 1],
    ]);
  });
  it("is empty for someone nothing links to", () => {
    expect(timelineOf(idx, "nobody")).toEqual([]);
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
    expect(timelineMonths([e!]).map((m) => m.month)).toEqual(["2026-11"]);
  });
  it("ignores a date in the title of a note, but not of a Day", () => {
    vi.stubEnv("TZ", "UTC");
    expect(timelineWith({ title: "2025-01-01 resolutions", updatedAt: "2026-06-30T10:00:00Z" })[0]?.day).toBe("2026-06-30");
  });
});
