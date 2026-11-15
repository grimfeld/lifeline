import { describe, expect, it } from "vitest";
import { dayOf, isDateStr } from "./sourceDays";
import type { Document } from "./types";

const doc = (type: string, title: string): Document => ({ id: "d", type, title } as Document);

describe("isDateStr", () => {
  it("accepts a YYYY-MM-DD string", () => {
    expect(isDateStr("2026-11-15")).toBe(true);
  });
  it("rejects anything else: other shapes, timestamps, non-strings", () => {
    for (const v of ["", "2026-1-5", "2026-11-15T10:00", " 2026-11-15", "today", 20261115, null, undefined, {}]) {
      expect(isDateStr(v)).toBe(false);
    }
  });
});

describe("dayOf", () => {
  it("is a Day's title when it is a date", () => {
    expect(dayOf(doc("daily", "2026-11-15"))).toBe("2026-11-15");
  });
  it("is nothing for a Day titled otherwise, another type, or no Document", () => {
    expect(dayOf(doc("daily", "Notes"))).toBeUndefined();
    expect(dayOf(doc("note", "2026-11-15"))).toBeUndefined();
    expect(dayOf(undefined)).toBeUndefined();
  });
});
