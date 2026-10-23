import { conflictCopy } from "@lifeline/core";
import { describe, expect, it } from "vitest";
import { noteTypeDef, quoteTypeDef } from "./types";

describe("Note and Quote", () => {
  it("keep a Conflict copy with their Source (ADR 0010)", () => {
    expect(noteTypeDef.onConflict).toBe(conflictCopy);
    expect(quoteTypeDef.onConflict).toBe(conflictCopy);
  });
});
