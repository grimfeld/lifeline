import { describe, expect, it } from "vitest";
import { projectsTimed } from "./timed";
import { markerId } from "./domain/board";
import type { TimedItem } from "@lifeline/core";

const marker = (itemId: string) => ({ key: `projects/${itemId}`, appId: "projects", itemId, title: "⚑", date: "2026-11-10", start: null, end: null, marker: true }) as TimedItem;

describe("projectsTimed.peekOf (#538)", () => {
  it("peeks a Project's Deadline's Project", () => {
    expect(projectsTimed.peekOf!(marker(markerId("p1")))).toBe("p1");
  });

  it("peeks a Milestone's Deadline's Milestone", () => {
    expect(projectsTimed.peekOf!(marker(markerId("p1", "m1")))).toBe("m1");
  });
});
