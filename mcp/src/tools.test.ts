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

  it("names Knowledge's tools after Knowledge, with no Languages aliases (ADR 0073)", () => {
    const names = TOOLS.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(["knowledge_word", "knowledge_sentence"]));
    expect(names.filter((n) => n.startsWith("languages_"))).toEqual([]);
    expect(Object.keys(TOOLS.find((t) => t.name === "knowledge_word")!.input)).toEqual(expect.arrayContaining(["topic", "term", "meaning"]));
  });
});

describe("grantedScopes", () => {
  it("always grants read, and write exactly when Allow changes is ticked", () => {
    expect(grantedScopes(true)).toEqual(["lifeline:read", "lifeline:write"]);
    expect(grantedScopes(false)).toEqual(["lifeline:read"]);
  });
});
