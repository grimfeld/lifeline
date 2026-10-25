import { describe, expect, it } from "vitest";
import { plural } from "./plural";

describe("plural", () => {
  it("counts with the right form", () => {
    expect(plural(0, "payee")).toBe("0 payees");
    expect(plural(1, "payee")).toBe("1 payee");
    expect(plural(2, "match", "matches")).toBe("2 matches");
  });
});
