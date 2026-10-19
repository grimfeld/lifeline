import { describe, expect, it } from "vitest";
import { parseNumber } from "./money";

describe("a typed number (an amount, not money)", () => {
  it("takes a dot or a comma for the decimal", () => {
    expect(parseNumber("420")).toBe(420);
    expect(parseNumber("0,42")).toBe(0.42);
    expect(parseNumber(" 1.5 ")).toBe(1.5);
  });
  it("is null when empty or not a number", () => {
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("  ")).toBeNull();
    expect(parseNumber("abc")).toBeNull();
  });
});
