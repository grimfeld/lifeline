import { describe, expect, it } from "vitest";
import { blockEnd, blockLasting, blockNudged, blockOfTapped } from "./blockTime";

describe("a Time block's timing in the Peek (#537)", () => {
  const block = { date: "2026-11-10", start: "10:00", len: 60 };

  it("moves its start by the nudge, keeping its length", () => {
    expect(blockNudged(block, 15)).toEqual({ date: "2026-11-10", start: "10:15", len: 60 });
    expect(blockNudged(block, -15)).toEqual({ date: "2026-11-10", start: "09:45", len: 60 });
  });

  it("stays inside its day: a block never moves the day (ADR 0028)", () => {
    expect(blockNudged({ ...block, start: "00:00" }, -15).start).toBe("00:00");
    expect(blockNudged({ ...block, start: "23:00" }, 15).start).toBe("23:00");
  });

  it("takes a new length of at least a quarter hour", () => {
    expect(blockLasting(block, 90)).toEqual({ ...block, len: 90 });
    expect(blockLasting(block, 5).len).toBe(15);
  });

  it("ends its length after its start", () => {
    expect(blockEnd(block)).toBe("11:00");
    expect(blockEnd({ ...block, start: "23:30", len: 60 })).toBe("24:00");
  });

  it("reads a tapped block's day, start and length; a chip has no start, its Estimate as length", () => {
    expect(blockOfTapped({ appId: "tasks", itemId: "t", title: "T", date: null, placementId: "p", start: "09:00", end: "10:30", displayDate: "2026-11-10" }, "2026-11-09")).toEqual({ date: "2026-11-10", start: "09:00", len: 90 });
    expect(blockOfTapped({ appId: "tasks", itemId: "t", title: "T", date: "2026-11-12", estimateMin: 45, displayDate: "2026-11-12" }, "2026-11-09")).toEqual({ date: "2026-11-12", start: null, len: 45 });
    expect(blockOfTapped({ appId: "tasks", itemId: "t", title: "T", date: null }, "2026-11-09")).toEqual({ date: "2026-11-09", start: null, len: 30 });
  });
});
