import { describe, expect, it } from "vitest";
import { pickForDay } from "./dailyPick";

const item = (id: string) => ({ id });

describe("pickForDay", () => {
  it("is stable per day and varies across days", () => {
    const pool = [item("a"), item("b"), item("c")];
    expect(pickForDay(pool, "2026-08-19")).toBe(pickForDay(pool, "2026-08-19"));
    const picks = new Set(["2026-08-19", "2026-08-20", "2026-08-21", "2026-08-22"].map((d) => pickForDay(pool, d)!.id));
    expect(picks.size).toBeGreaterThan(1);
  });
  it("does not depend on the input order", () => {
    const pool = [item("a"), item("b"), item("c"), item("d")];
    for (const d of ["2026-08-19", "2026-08-20", "2026-08-21"]) {
      expect(pickForDay([...pool].reverse(), d)!.id).toBe(pickForDay(pool, d)!.id);
    }
  });
  it("is undefined for an empty list", () => {
    expect(pickForDay([], "2026-08-19")).toBeUndefined();
  });
});
