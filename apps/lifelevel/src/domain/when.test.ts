import { describe, expect, it } from "vitest";
import { occurredAtOf } from "./when";

describe("occurredAtOf", () => {
  it("reads a datetime-local value as local time", () => {
    expect(occurredAtOf("2026-08-13T07:30")).toBe(new Date(2026, 7, 13, 7, 30).toISOString());
  });

  it("is null for an empty or broken time instead of throwing", () => {
    expect(occurredAtOf("")).toBeNull();
    expect(occurredAtOf("  ")).toBeNull();
    expect(occurredAtOf("not a time")).toBeNull();
  });
});
