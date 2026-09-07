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


describe("the fresh-account bootstrap", () => {
  /**
   * Regression, and the reason the guard is not a cursor. `pullCollection`
   * writes `cursor:<name>` only when a pull actually returned a newer row:
   *
   *     if (maxUpdated !== cursor) await db()._meta.put({ key: cursorKey, ... })
   *
   * On a fresh account the server holds no workspaces, so `maxUpdated` and
   * `cursor` are both "" on every cycle and the key is never written. A guard
   * waiting on it waits forever, which left a fresh account with no Workspace,
   * therefore no picker, therefore no way to make one — permanently, not just
   * until the next sync.
   */
  it("cannot be gated on a cursor, which an empty collection never writes", () => {
    const cursorAfterEmptyPull = (previous: string, rowsReturned: string[]) => {
      const maxUpdated = rowsReturned.reduce((max, r) => (r > max ? r : max), previous);
      return maxUpdated !== previous ? maxUpdated : previous;
    };
    // A collection the server has rows for advances, and would open such a gate.
    expect(cursorAfterEmptyPull("", ["2026-09-07T00:00:00Z"])).not.toBe("");
    // One it has no rows for never does, however many times it is pulled.
    expect(cursorAfterEmptyPull("", [])).toBe("");
  });
});


describe("the workspaces collection's server shape", () => {
  /**
   * Regression for the 400 that broke syncing after a second Workspace was
   * made: `invalid sort field "updated"`.
   *
   * The collection was created without the `created`/`updated` autodate fields
   * every other synced collection carries. `updated` is load-bearing — the
   * engine pulls with `sort=updated` and pages on it — so every cycle failed,
   * Workspaces never synced between devices, and the fresh-account bootstrap
   * (which then waited on a clean cycle) never fired either.
   *
   * This pins the invariant against the migration text, which is the only
   * place the shape is stated.
   */
  it("declares the autodates every synced collection is pulled by", async () => {
    const fs = await import("node:fs/promises");
    const url = await import("node:url");
    const path = await import("node:path");
    const here = path.dirname(url.fileURLToPath(import.meta.url));
    const migration = await fs.readFile(path.join(here, "../../../pocketbase/pb_migrations/1757400000_workspaces.js"), "utf8");
    expect(migration).toContain('name: "updated"');
    expect(migration).toContain('name: "created"');
  });
});
