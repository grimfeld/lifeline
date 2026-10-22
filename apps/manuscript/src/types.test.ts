import { conflictCopy } from "@lifeline/core";
import { describe, expect, it } from "vitest";
import { chapterType } from "./types";

describe("Chapter", () => {
  it("keeps a Conflict copy (ADR 0010)", () => {
    expect(chapterType.onConflict).toBe(conflictCopy);
  });
});
