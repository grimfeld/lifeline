import { describe, expect, it } from "vitest";
import type { Document } from "@lifeline/core";
import { eventBegun, memoryFromEvent } from "./event";

const ev = (f: Record<string, unknown>): Document => ({ id: "e1", type: "event", title: "Wedding", ...f }) as unknown as Document;
const now = new Date(2026, 5, 10, 14, 30);

describe("eventBegun", () => {
  it("is true for a timed Event whose start has passed today", () => expect(eventBegun(ev({ date: "2026-06-10", start: "09:00" }), now)).toBe(true));
  it("is true for a timed Event that is ongoing", () => expect(eventBegun(ev({ date: "2026-06-10", start: "14:00", end: "16:00" }), now)).toBe(true));
  it("is false for a timed Event later today", () => expect(eventBegun(ev({ date: "2026-06-10", start: "18:00" }), now)).toBe(false));
  it("is true for an all-day Event today", () => expect(eventBegun(ev({ date: "2026-06-10", start: null }), now)).toBe(true));
  it("is false for a future Event, all-day or timed", () => {
    expect(eventBegun(ev({ date: "2026-06-11" }), now)).toBe(false);
    expect(eventBegun(ev({ date: "2026-06-11", start: "00:00" }), now)).toBe(false);
  });
  it("is true for a past Event", () => expect(eventBegun(ev({ date: "2026-01-02", start: "23:00" }), now)).toBe(true));
  it("is false for an undated Document or another type", () => {
    expect(eventBegun(ev({}), now)).toBe(false);
    expect(eventBegun({ ...ev({ date: "2020-01-01" }), type: "task" }, now)).toBe(false);
  });
});

describe("memoryFromEvent", () => {
  it("prefills the title, the first day and About", () => {
    expect(memoryFromEvent(ev({ date: "2026-06-10", endDate: "2026-06-12" }))).toEqual({ title: "Wedding", date: "2026-06-10", about: ["e1"] });
  });
});
