import { beforeEach, describe, expect, it, vi } from "vitest";
import { lastIntakeKey, rememberIntake } from "./intake";

describe("the Intake a sender last chose", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
  });

  it("is nothing until one is chosen", () => {
    expect(lastIntakeKey("pantry")).toBe("");
  });

  it("is remembered per sender", () => {
    rememberIntake("pantry", "shopping/need");
    rememberIntake("mail", "clipper/clipping");
    expect(lastIntakeKey("pantry")).toBe("shopping/need");
    expect(lastIntakeKey("mail")).toBe("clipper/clipping");
  });

  it("forgets quietly when storage is unavailable", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    expect(() => rememberIntake("pantry", "shopping/need")).not.toThrow();
    expect(lastIntakeKey("pantry")).toBe("");
  });
});
