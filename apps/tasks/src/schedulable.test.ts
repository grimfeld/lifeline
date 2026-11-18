import { describe, expect, it } from "vitest";
import { tasksSchedulable } from "./schedulable";

describe("tasksSchedulable.peekOf (#537)", () => {
  it("peeks the Task itself from its block or chip", () => {
    expect(tasksSchedulable.peekOf!("t1")).toBe("t1");
  });

  it("peeks the Task an Occurrence comes from: the rule is what gets edited", () => {
    expect(tasksSchedulable.peekOf!("t1|2026-11-10")).toBe("t1");
  });
});
