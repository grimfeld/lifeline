import { describe, expect, it } from "vitest";
import { hasRequiredFields, isConfigured, resolveSettings, type CardSettingsSchema } from "./cards";

const schema: CardSettingsSchema = {
  stat: { kind: "entity", label: "Stat", required: true, useOptions: () => [] },
  period: { kind: "select", label: "Period", default: "month", options: [{ value: "week", label: "w" }, { value: "month", label: "m" }] },
  n: { kind: "number", label: "N", default: 5, min: 1, max: 20 },
};

describe("resolveSettings", () => {
  it("fills defaults", () => {
    expect(resolveSettings(schema)).toEqual({ stat: "", period: "month", n: 5 });
  });
  it("keeps valid values, drops invalid and unknown ones, clamps numbers", () => {
    expect(resolveSettings(schema, { stat: "abc", period: "year", n: 99, junk: 1 })).toEqual({ stat: "abc", period: "month", n: 20 });
  });
  it("returns {} for no schema", () => {
    expect(resolveSettings(undefined, { a: 1 })).toEqual({});
  });
});

describe("required fields", () => {
  it("detects required entity fields", () => {
    expect(hasRequiredFields(schema)).toBe(true);
    expect(hasRequiredFields({ n: schema.n })).toBe(false);
    expect(hasRequiredFields(undefined)).toBe(false);
  });
  it("isConfigured needs every required field", () => {
    expect(isConfigured(schema, resolveSettings(schema))).toBe(false);
    expect(isConfigured(schema, resolveSettings(schema, { stat: "x" }))).toBe(true);
    expect(isConfigured(undefined, {})).toBe(true);
  });
});
