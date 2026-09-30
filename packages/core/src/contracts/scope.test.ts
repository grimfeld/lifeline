import { describe, expect, it } from "vitest";
import { inSurfaceScope } from "./scope";

describe("inSurfaceScope", () => {
  it("lets everything onto a general Surface", () => {
    expect(inSurfaceScope(null, "chores")).toBe(true);
  });

  it("keeps an embedded Surface to its Module's Apps", () => {
    const scope = { moduleId: "house", apps: new Set(["chores", "pantry"]) };
    expect(inSurfaceScope(scope, "chores")).toBe(true);
    expect(inSurfaceScope(scope, "tasks")).toBe(false);
  });
});
