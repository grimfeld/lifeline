import { describe, expect, it } from "vitest";
import { defaultNormalizeTag } from "./tag-input";

describe("defaultNormalizeTag", () => {
  it("trims, drops #, lower-cases, and cuts stray separators", () => {
    expect(defaultNormalizeTag("  #Home Repairs/ ")).toBe("home-repairs");
    expect(defaultNormalizeTag("--/x/--")).toBe("x");
    expect(defaultNormalizeTag(" - ")).toBeNull();
  });

  it("reads a long run of separators in linear time", () => {
    const started = performance.now();
    const tag = `a${"-/".repeat(50_000)}x`;
    expect(defaultNormalizeTag(tag)).toBe(tag);
    expect(performance.now() - started).toBeLessThan(1000);
  });
});
