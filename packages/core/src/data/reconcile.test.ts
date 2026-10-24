import { describe, expect, it } from "vitest";
import { reuseUnchanged, sameRecord, shouldApply } from "./reconcile";
import type { SyncedRecord } from "./db";

const rec = (over: Partial<SyncedRecord> & Record<string, unknown> = {}): SyncedRecord =>
  ({ id: "a", updatedAt: "2026-08-28T10:00:00.000Z", deleted: 0, ...over }) as SyncedRecord;

describe("sameRecord", () => {
  it("ignores key order", () => {
    expect(sameRecord({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
  });
  it("compares arrays in order", () => {
    expect(sameRecord({ tags: ["a", "b"] }, { tags: ["a", "b"] })).toBe(true);
    expect(sameRecord({ tags: ["a", "b"] }, { tags: ["b", "a"] })).toBe(false);
  });
  it("sees a missing key", () => {
    expect(sameRecord({ a: 1 }, { a: 1, b: undefined })).toBe(false);
  });
  it("sees a changed value", () => {
    expect(sameRecord({ body: "ab" }, { body: "abc" })).toBe(false);
  });
});

describe("shouldApply", () => {
  it("stores a record it has never seen", () => {
    expect(shouldApply(undefined, rec())).toBe(true);
  });

  it("skips the echo of a write this device just pushed", () => {
    const local = rec({ body: "ab" });
    expect(shouldApply(local, { ...local })).toBe(false);
  });

  it("keeps a local record the server copy is older than", () => {
    expect(shouldApply(rec({ body: "ab" }), rec({ body: "abc", updatedAt: "2026-08-28T09:59:00.000Z" }))).toBe(false);
  });

  it("takes a newer copy from another device", () => {
    expect(shouldApply(rec({ body: "ab" }), rec({ body: "abc", updatedAt: "2026-08-28T10:00:01.000Z" }))).toBe(true);
  });

  it("takes a differing copy stamped the same millisecond (LWW stays as it was)", () => {
    expect(shouldApply(rec({ body: "ab" }), rec({ body: "abc" }))).toBe(true);
  });

  it("skips the echo of a no-body Document, which comes back with body \"\" (CR-07)", () => {
    const local = rec({ type: "task", title: "x" });
    expect(shouldApply(local, { ...local, body: "" } as SyncedRecord)).toBe(false);
    expect(shouldApply({ ...local, body: "" } as SyncedRecord, local)).toBe(false);
  });

  it("still takes a body that really changed", () => {
    const local = rec({ type: "note" });
    expect(shouldApply(local, { ...local, body: "hello" } as SyncedRecord)).toBe(true);
  });
});

describe("reuseUnchanged", () => {
  const a = rec({ id: "a", body: "x" });
  const b = rec({ id: "b", body: "y" });
  const copy = (r: SyncedRecord) => JSON.parse(JSON.stringify(r)) as SyncedRecord;

  it("hands back the last array when nothing changed", () => {
    const prev = [a, b];
    expect(reuseUnchanged(prev, [copy(a), copy(b)])).toBe(prev);
  });
  it("keeps the objects of unchanged rows and takes the changed ones", () => {
    const b2 = rec({ id: "b", body: "yy", updatedAt: "2026-08-28T11:00:00.000Z" });
    const out = reuseUnchanged([a, b], [copy(a), b2]);
    expect(out[0]).toBe(a);
    expect(out[1]).toBe(b2);
  });
  it("takes a row rewritten under the same clock", () => {
    const b2 = { ...copy(b), body: "rewritten" } as SyncedRecord;
    expect(reuseUnchanged([a, b], [copy(a), b2])[1]).toBe(b2);
  });
  it("sees a row added, removed or moved", () => {
    const c = rec({ id: "c" });
    expect(reuseUnchanged([a, b], [copy(a), copy(b), c])).toEqual([a, b, c]);
    const removed = reuseUnchanged([a, b], [copy(b)]);
    expect(removed).toEqual([b]);
    expect(removed[0]).toBe(b);
    const moved = reuseUnchanged([a, b], [copy(b), copy(a)]);
    expect(moved[0]).toBe(b);
    expect(moved[1]).toBe(a);
  });
});
