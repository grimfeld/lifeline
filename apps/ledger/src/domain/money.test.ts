import { describe, expect, it } from "vitest";
import { editAmount, parseAmount } from "./money";

describe("parseAmount", () => {
  it("reads plain and decimal forms", () => {
    expect(parseAmount("12")).toBe(1200);
    expect(parseAmount("12.5")).toBe(1250);
    expect(parseAmount("12.50")).toBe(1250);
    expect(parseAmount("12,50")).toBe(1250);
    expect(parseAmount("0.01")).toBe(1);
  });

  it("reads thousands separators either way around", () => {
    expect(parseAmount("1.234,56")).toBe(123456);
    expect(parseAmount("1,234.56")).toBe(123456);
    expect(parseAmount("1.234")).toBe(123400); // dot + 3 digits = thousands
    expect(parseAmount("1,234")).toBe(123400); // comma + 3 digits = thousands
  });

  it("keeps the sign and ignores symbols", () => {
    expect(parseAmount("-12,50")).toBe(-1250);
    expect(parseAmount("€ 12,50")).toBe(1250);
    expect(parseAmount("+3")).toBe(300);
  });

  it("rejects non-numbers", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("-")).toBeNull();
  });
});

describe("editAmount", () => {
  it("round-trips through parseAmount", () => {
    for (const cents of [0, 1, 99, 100, 1250, -1250, 123456]) {
      expect(parseAmount(editAmount(cents))).toBe(cents);
    }
  });
});
