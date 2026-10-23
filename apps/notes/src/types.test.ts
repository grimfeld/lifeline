import { conflictCopy } from "@lifeline/core";
import { describe, expect, it } from "vitest";
import { noteTypes } from "./types";

describe("Journal types", () => {
  it("keep a Conflict copy of an unsynced edit (ADR 0010)", () => {
    for (const t of noteTypes.filter((t) => t.onConflict)) expect(t.onConflict).toBe(conflictCopy);
    expect(noteTypes.filter((t) => t.onConflict).length).toBeGreaterThan(1);
  });
});
