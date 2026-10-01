import { describe, expect, it } from "vitest";
import { commandToolName, TOOLS } from "./tools";
import { grantedScopes } from "./oauth";

describe("tool catalogue", () => {
  it("names every tool within MCP's alphabet, without collisions", () => {
    const names = TOOLS.map((t) => t.name);
    for (const n of names) expect(n).toMatch(/^[a-zA-Z0-9_-]{1,64}$/);
    expect(new Set(names).size).toBe(names.length);
    expect(commandToolName("calendar.add-event")).toBe("calendar_add_event");
  });

  it("exposes the headless Commands as write tools", () => {
    const add = TOOLS.find((t) => t.command === "tasks.add");
    expect(add?.write).toBe(true);
    expect(Object.keys(add!.input)).toEqual(expect.arrayContaining(["title", "date", "recurrence", "workspace"]));
  });
});

describe("grantedScopes", () => {
  it("always grants read, and write only when asked for and allowed", () => {
    expect(grantedScopes(undefined, true)).toEqual(["lifeline:read", "lifeline:write"]);
    expect(grantedScopes(undefined, false)).toEqual(["lifeline:read"]);
    expect(grantedScopes(["lifeline:read"], true)).toEqual(["lifeline:read"]);
    expect(grantedScopes(["something:else"], true)).toEqual(["lifeline:read"]);
  });
});
