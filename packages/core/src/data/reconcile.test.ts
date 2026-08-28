import { describe, expect, it } from "vitest";
import { sameRecord, shouldApply } from "./reconcile";
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
});
