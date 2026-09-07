import { describe, expect, it } from "vitest";
import { scopeOf, type WorkspaceRecord } from "./workspaces";
import { inScope } from "./documents/store";

const ws = (over: Partial<WorkspaceRecord> = {}): WorkspaceRecord => ({
  id: "w1",
  name: "Work",
  modules: ["tasks"],
  sort: 0,
  updatedAt: "",
  deleted: 0,
  ...over,
});

describe("scopeOf", () => {
  it("is the Workspace's own id when separated", () => {
    expect(scopeOf(ws({ separated: true }))).toBe("w1");
  });

  it("is the shared scope when not separated", () => {
    expect(scopeOf(ws())).toBe("");
    expect(scopeOf(ws({ separated: false }))).toBe("");
  });

  it("is the shared scope before any Workspace exists", () => {
    expect(scopeOf(undefined)).toBe("");
  });
});

describe("inScope", () => {
  it("matches exactly — a strict partition, never a union", () => {
    // The decision this test exists to pin (ADR 0048): a separated Workspace
    // does NOT also see the shared content, which is why turning separation on
    // starts it empty.
    expect(inScope({ workspace: "w1" }, "w1")).toBe(true);
    expect(inScope({ workspace: "" }, "w1")).toBe(false);
    expect(inScope({ workspace: "w1" }, "")).toBe(false);
    expect(inScope({ workspace: "w2" }, "w1")).toBe(false);
  });

  it("treats a row written before the field existed as shared", () => {
    expect(inScope({ workspace: undefined }, "")).toBe(true);
    expect(inScope({ workspace: undefined }, "w1")).toBe(false);
  });

  it("is symmetric: two separated Workspaces never see each other", () => {
    expect(inScope({ workspace: "w1" }, "w2")).toBe(false);
    expect(inScope({ workspace: "w2" }, "w1")).toBe(false);
  });
});
