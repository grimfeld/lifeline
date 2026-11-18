import { describe, expect, it } from "vitest";
import { slugify } from "./types";

describe("slugify", () => {
  it("makes a type id from a label", () => {
    expect(slugify("Recipe idea")).toBe("recipe-idea");
    expect(slugify("  Café — crème!  ")).toBe("cafe-creme");
    expect(slugify("---")).toBe("");
  });

  it("keeps to linear time on a label of many separators (CodeQL js/polynomial-redos)", () => {
    const label = `a${"-".repeat(100_000)}!`;
    const started = performance.now();
    expect(slugify(label)).toBe("a");
    expect(performance.now() - started).toBeLessThan(200);
  });
});
