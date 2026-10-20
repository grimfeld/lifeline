import { describe, expect, it } from "vitest";
import { formatLength, parseLength } from "./length-value";

describe("formatLength", () => {
  it("reads minutes under an hour as minutes", () => {
    expect(formatLength(15)).toBe("15m");
    expect(formatLength(45)).toBe("45m");
  });

  it("reads whole hours as hours", () => {
    expect(formatLength(60)).toBe("1h");
    expect(formatLength(120)).toBe("2h");
  });

  it("reads hours and minutes together", () => {
    expect(formatLength(90)).toBe("1h 30m");
    expect(formatLength(23 * 60 + 59)).toBe("23h 59m");
  });

  it("reads days and hours from 24h up", () => {
    expect(formatLength(24 * 60)).toBe("1d");
    expect(formatLength(56 * 60)).toBe("2d 8h");
    expect(formatLength(24 * 60 + 30)).toBe("1d 30m");
    expect(formatLength(25 * 60 + 15)).toBe("1d 1h 15m");
  });
});

describe("parseLength", () => {
  it("takes a bare number as minutes", () => {
    expect(parseLength("90")).toBe(90);
    expect(parseLength(" 25 ")).toBe(25);
  });

  it("takes hours, minutes and days as written", () => {
    expect(parseLength("45m")).toBe(45);
    expect(parseLength("2h")).toBe(120);
    expect(parseLength("1h 30m")).toBe(90);
    expect(parseLength("1h30")).toBe(90);
    expect(parseLength("1.5h")).toBe(90);
    expect(parseLength("2d 8h")).toBe(56 * 60);
    expect(parseLength("1:15")).toBe(75);
    expect(parseLength("3 hours 10 min")).toBe(190);
  });

  it("reads back what formatLength writes", () => {
    for (const n of [15, 60, 90, 24 * 60, 56 * 60, 25 * 60 + 15]) expect(parseLength(formatLength(n))).toBe(n);
  });

  it("refuses nothing, zero and nonsense", () => {
    expect(parseLength("")).toBeNull();
    expect(parseLength("0")).toBeNull();
    expect(parseLength("0h")).toBeNull();
    expect(parseLength("soon")).toBeNull();
    expect(parseLength("1h 2h")).toBeNull();
    expect(parseLength("-30")).toBeNull();
  });
});
