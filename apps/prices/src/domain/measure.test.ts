import { describe, expect, it } from "vitest";
import type { Measure } from "./types";
import { amountIn, amountUnit, defaultAmount, formatAmount, formatUnitPrice, fromAmount, legacyMeasure, matchedAmount, measureLabel, perUnit, readMeasure, toBase, unitName, unitPriceIn } from "./measure";

const grams: Measure = { dimension: "mass", unit: "g", countName: "" };
const kilos: Measure = { dimension: "mass", unit: "kg", countName: "" };
const per100g: Measure = { dimension: "mass", unit: "100g", countName: "" };
const ml: Measure = { dimension: "volume", unit: "ml", countName: "" };
const litres: Measure = { dimension: "volume", unit: "L", countName: "" };
const metres: Measure = { dimension: "length", unit: "m", countName: "" };
const pieces: Measure = { dimension: "count", unit: "pc", countName: "" };
const washes: Measure = { dimension: "count", unit: "pc", countName: "wash" };

describe("amounts are kept in the dimension's base unit and read in the Product's unit", () => {
  it("a gram Product reads 0.42 kg as 420 g, and 420 typed is 0.42 kg kept", () => {
    expect(amountIn(0.42, grams)).toBe(420);
    expect(fromAmount(420, grams)).toBe(0.42);
    expect(formatAmount(0.42, grams)).toBe("420 g");
  });
  it("a per-100 g Product still reads its amounts in grams", () => {
    expect(amountUnit(per100g)).toBe("g");
    expect(formatAmount(0.03, per100g)).toBe("30 g");
    expect(fromAmount(30, per100g)).toBe(0.03);
  });
  it("kg, L, m and pieces are their own base", () => {
    expect(formatAmount(0.42, kilos)).toBe("0.42 kg");
    expect(formatAmount(6, litres)).toBe("6 L");
    expect(formatAmount(0.25, ml)).toBe("250 ml");
    expect(formatAmount(30, metres)).toBe("30 m");
    expect(formatAmount(12, pieces)).toBe("12 pc");
  });
  it("a named count reads in its own name", () => {
    expect(formatAmount(40, washes)).toBe("40 wash");
    expect(perUnit(washes)).toBe("/wash");
  });
  it("round trips survive float noise", () => {
    for (const n of [1, 7, 33, 125, 420, 999]) expect(amountIn(fromAmount(n, grams), grams)).toBe(n);
    expect(amountIn(fromAmount(0.1, ml), ml)).toBe(0.1);
  });
});

describe("unit prices", () => {
  // Unit prices are cents per base unit: €12.00/kg is 1200.
  it("are read per the Product's unit", () => {
    expect(unitPriceIn(1200, kilos)).toBe(1200);
    expect(unitPriceIn(1200, per100g)).toBeCloseTo(120);
    expect(unitPriceIn(1200, grams)).toBeCloseTo(1.2);
  });
  it("format with the unit's suffix", () => {
    expect(formatUnitPrice(1200, kilos)).toMatch(/12[.,]00.*\/kg$/);
    expect(formatUnitPrice(1200, per100g)).toMatch(/1[.,]20.*\/100 g$/);
    expect(formatUnitPrice(21, washes)).toMatch(/0[.,]21.*\/wash$/);
    expect(formatUnitPrice(199, litres)).toMatch(/1[.,]99.*\/L$/);
  });
  it("a tiny price per gram keeps its digits instead of reading €0.01", () => {
    expect(formatUnitPrice(1500, grams)).toMatch(/0[.,]015.*\/g$/);
  });
});

describe("typing an amount in another unit of the dimension", () => {
  it("converts to the base unit", () => {
    expect(toBase(500, "g", kilos)).toBe(0.5);
    expect(toBase(1.5, "kg", grams)).toBe(1.5);
    expect(toBase(330, "ml", litres)).toBe(0.33);
    expect(toBase(2, "l", ml)).toBe(2);
    expect(toBase(12, "pc", washes)).toBe(12);
    expect(toBase(12, "wash", washes)).toBe(12);
    expect(toBase(3, "100 g", kilos)).toBe(0.3);
  });
  it("no unit means the Product's own reading unit", () => {
    expect(toBase(420, undefined, grams)).toBe(0.42);
    expect(toBase(0.42, "", kilos)).toBe(0.42);
  });
  it("refuses a unit of another dimension — pieces never turn into kilograms", () => {
    expect(() => toBase(12, "pc", kilos)).toThrow(/mass/);
    expect(() => toBase(1, "kg", litres)).toThrow(/volume/);
    expect(() => toBase(1, "furlong", metres)).toThrow();
  });
});

describe("old measures", () => {
  it("kg, l and piece map onto mass/kg, volume/L, count/pc", () => {
    expect(legacyMeasure("kg")).toEqual(kilos);
    expect(legacyMeasure("l")).toEqual(litres);
    expect(legacyMeasure("piece")).toEqual(pieces);
    expect(legacyMeasure("mass")).toBeUndefined();
  });
  it("a stored Product reads in the new shape whether it was written before or after", () => {
    expect(readMeasure({ measure: "kg" })).toEqual(kilos);
    expect(readMeasure({ dimension: "mass", unit: "100g", countName: "" })).toEqual(per100g);
    expect(readMeasure({ dimension: "count", unit: "pc", countName: " wash " })).toEqual(washes);
    // A unit outside its dimension falls back to the dimension's base.
    expect(readMeasure({ dimension: "volume", unit: "kg" })).toEqual(litres);
    // A count name only means something on a count.
    expect(readMeasure({ dimension: "mass", unit: "g", countName: "roll" })).toEqual(grams);
    expect(readMeasure({})).toEqual(pieces);
  });
  it("describes itself", () => {
    expect(measureLabel(per100g)).toBe("Mass · per 100 g");
    expect(measureLabel(washes)).toBe("Count · per wash");
  });
});

describe("a unit's name", () => {
  it("is what a price is per, without the slash", () => {
    expect(unitName(per100g)).toBe("100 g");
    expect(unitName(washes)).toBe("wash");
    expect(unitName(pieces)).toBe("pc");
  });
});

describe("matching an unmatched Line, and a missing amount", () => {
  it("an unmatched Line's amount is read in the Product's reading unit; a matched one is kept", () => {
    expect(matchedAmount({ productId: "", amount: 420 }, grams)).toBe(0.42);
    expect(matchedAmount({ productId: "p1", amount: 0.42 }, grams)).toBe(0.42);
  });
  it("defaults to one for a count only", () => {
    expect(defaultAmount(pieces)).toBe(1);
    expect(defaultAmount(washes)).toBe(1);
    expect(defaultAmount(grams)).toBeUndefined();
    expect(defaultAmount(undefined)).toBeUndefined();
  });
});
