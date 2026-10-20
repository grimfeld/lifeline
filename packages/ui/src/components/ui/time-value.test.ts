import { describe, expect, it } from "vitest";
import { formatTimeValue, nextQuarter, parseTimeText, QUARTER_HOURS, stepTime } from "./time-value";

describe("reading a typed time", () => {
  it("reads 24h text", () => {
    expect(parseTimeText("14:30")).toBe("14:30");
    expect(parseTimeText("9:05")).toBe("09:05");
    expect(parseTimeText("00:00")).toBe("00:00");
    expect(parseTimeText(" 23.59 ")).toBe("23:59");
  });

  it("reads compact digits: three or four are hour and minutes", () => {
    expect(parseTimeText("1430")).toBe("14:30");
    expect(parseTimeText("930")).toBe("09:30");
    expect(parseTimeText("0005")).toBe("00:05");
  });

  it("reads a bare hour", () => {
    expect(parseTimeText("9")).toBe("09:00");
    expect(parseTimeText("17")).toBe("17:00");
    expect(parseTimeText("0")).toBe("00:00");
  });

  it("reads am and pm, 12am being midnight and 12pm noon", () => {
    expect(parseTimeText("2pm")).toBe("14:00");
    expect(parseTimeText("2:30 PM")).toBe("14:30");
    expect(parseTimeText("2:30 PM")).toBe("14:30");
    expect(parseTimeText("9a")).toBe("09:00");
    expect(parseTimeText("930pm")).toBe("21:30");
    expect(parseTimeText("12am")).toBe("00:00");
    expect(parseTimeText("12:15 a.m.")).toBe("00:15");
    expect(parseTimeText("12pm")).toBe("12:00");
  });

  it("keeps typed minutes as typed, never snapped to the quarter", () => {
    expect(parseTimeText("09:10")).toBe("09:10");
    expect(parseTimeText("907")).toBe("09:07");
  });

  it("reads empty text as no time", () => {
    expect(parseTimeText("")).toBe("");
    expect(parseTimeText("   ")).toBe("");
  });

  it("refuses what can't be a time", () => {
    for (const bad of ["24:00", "25", "9:60", "13pm", "0am", "12345", "noon", "9:5", "abc", "-1", "1:30:00"]) {
      expect(parseTimeText(bad), bad).toBeNull();
    }
  });
});

describe("the field's text", () => {
  it("shows 24h where the locale reads a 24h clock", () => {
    expect(formatTimeValue("09:05", "en-GB")).toBe("09:05");
    expect(formatTimeValue("21:30", "de-DE")).toBe("21:30");
  });

  it("shows 12h where the locale reads a 12h clock, and reads it back", () => {
    expect(formatTimeValue("21:30", "en-US")).toBe("9:30 PM");
    expect(formatTimeValue("00:15", "en-US")).toBe("12:15 AM");
    expect(formatTimeValue("12:00", "en-US")).toBe("12:00 PM");
    expect(parseTimeText(formatTimeValue("21:30", "en-US"))).toBe("21:30");
  });

  it("shows nothing for no time", () => {
    expect(formatTimeValue("", "en-GB")).toBe("");
  });
});

describe("the quarter hours", () => {
  const at = (h: number, m: number, s = 0) => new Date(2026, 9, 20, h, m, s);

  it("lists every quarter hour of the day", () => {
    expect(QUARTER_HOURS).toHaveLength(96);
    expect([QUARTER_HOURS[0], QUARTER_HOURS[1], QUARTER_HOURS[95]]).toEqual(["00:00", "00:15", "23:45"]);
  });

  it("finds the next quarter hour from now", () => {
    expect(nextQuarter(at(9, 1))).toBe("09:15");
    expect(nextQuarter(at(9, 15))).toBe("09:15");
    expect(nextQuarter(at(9, 15, 30))).toBe("09:30");
    expect(nextQuarter(at(23, 50))).toBe("00:00");
  });

  it("steps a time by 15 minutes, round the clock, keeping odd minutes", () => {
    expect(stepTime("09:00", 15)).toBe("09:15");
    expect(stepTime("09:10", -15)).toBe("08:55");
    expect(stepTime("23:50", 15)).toBe("00:05");
    expect(stepTime("00:00", -15)).toBe("23:45");
  });

  it("starts an empty time at the next quarter hour", () => {
    expect(stepTime("", 15, at(14, 2))).toBe("14:15");
  });
});
