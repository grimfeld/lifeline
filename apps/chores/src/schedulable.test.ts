import { describe, expect, it } from "vitest";
import { choresSchedulable } from "./schedulable";

describe("choresSchedulable.peekOf (#538)", () => {
  it("peeks the Chore whose block or chip was tapped", () => {
    expect(choresSchedulable.peekOf!("c1")).toBe("c1");
  });
});
