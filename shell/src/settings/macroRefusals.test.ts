import { describe, expect, it } from "vitest";
import { refusalKey, refusalsOf, withoutStep } from "./macroRefusals";

const reason = (step: number, key: string, text: string) => ({ kind: "fixed-link" as const, step, key, text });

describe("the refusals the Macro editor shows under its fields", () => {
  it("keeps each field's refusal under that field's key", () => {
    expect(refusalsOf([reason(0, "source", "Source: No Source called “Gone”"), reason(1, "with", "With: No With called “X”")])).toEqual({
      [refusalKey(0, "source")]: "Source: No Source called “Gone”",
      [refusalKey(1, "with")]: "With: No With called “X”",
    });
  });

  it("shows every problem of one field, such as two bad names in one list", () => {
    const shown = refusalsOf([reason(0, "with", "With: No With called “Gone”"), reason(0, "with", "With: No With called “Nowhere”")]);
    expect(Object.keys(shown)).toEqual([refusalKey(0, "with")]);
    expect(shown[refusalKey(0, "with")]).toContain("Gone");
    expect(shown[refusalKey(0, "with")]).toContain("Nowhere");
  });

  it("drops the refusals of one step, leaving the others", () => {
    const refused = { [refusalKey(0, "a")]: "x", [refusalKey(1, "a")]: "y", [refusalKey(1, "b")]: "z", [refusalKey(10, "a")]: "w" };
    expect(withoutStep(refused, 1)).toEqual({ [refusalKey(0, "a")]: "x", [refusalKey(10, "a")]: "w" });
  });
});
