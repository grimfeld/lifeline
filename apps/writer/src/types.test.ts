import { conflictCopy } from "@lifeline/core";
import { describe, expect, it } from "vitest";
import { essayType, versionType } from "./types";

describe("Essay", () => {
  it("keeps a Conflict copy (ADR 0010); Versions stay last-write-wins", () => {
    expect(essayType.onConflict).toBe(conflictCopy);
    expect(versionType.onConflict).toBeUndefined();
  });
});
