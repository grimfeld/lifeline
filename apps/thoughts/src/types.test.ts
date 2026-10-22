import { conflictCopy } from "@lifeline/core";
import { describe, expect, it } from "vitest";
import { thoughtTypeDef } from "./types";

describe("Thought", () => {
  it("keeps a Conflict copy of an unsynced edit, with its kind (ADR 0010)", () => {
    expect(thoughtTypeDef.onConflict).toBe(conflictCopy);
  });
});
