import { describe, expect, it } from "vitest";
import { editAmount, formatCents, parseAmount } from "./money";
import { firstGrapheme } from "./types";

describe("parseAmount", () => {
  it("reads whole and decimal amounts, with a dot or a comma, into cents", () => {
    expect(parseAmount("12")).toBe(1200);
    expect(parseAmount("12.50")).toBe(1250);
    expect(parseAmount("12,5")).toBe(1250);
    expect(parseAmount("0.07")).toBe(7);
  });

  it("tells thousands from decimals by the last separator", () => {
    expect(parseAmount("1.234,56")).toBe(123456);
    expect(parseAmount("1,234.56")).toBe(123456);
    expect(parseAmount("1,234")).toBe(123400);
    expect(parseAmount("1.234")).toBe(123400);
  });

  it("ignores a currency sign and spaces, and keeps the sign", () => {
    expect(parseAmount("€ 12,50")).toBe(1250);
    expect(parseAmount("-5")).toBe(-500);
  });

  it("is null for what is not a number", () => {
    for (const s of ["", "  ", "abc", "-", "+", "1.2.3"]) expect(parseAmount(s)).toBeNull();
  });

  it("reads back what formatCents writes, whatever the locale", () => {
    expect(parseAmount(formatCents(123456))).toBe(123456);
    expect(parseAmount(formatCents(200))).toBe(200);
  });
});

describe("editAmount", () => {
  it("writes cents with a dot and two decimals, for editing", () => {
    expect(editAmount(1250)).toBe("12.50");
    expect(editAmount(7)).toBe("0.07");
  });
});

describe("firstGrapheme", () => {
  it("keeps one whole character, an emoji with its joiners included", () => {
    expect(firstGrapheme("  🤬 rage")).toBe("🤬");
    expect(firstGrapheme("👨‍👩‍👧 family")).toBe("👨‍👩‍👧");
    expect(firstGrapheme("ab")).toBe("a");
    expect(firstGrapheme("   ")).toBe("");
  });
});
