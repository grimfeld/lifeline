import { describe, expect, it } from "vitest";
import type { Provision, Storage } from "./types";
import { addDays, clampQty, expiresSoon, expiring, isExpired, isRunningLow, matchByTitle, provisionsIn, runningLow, sortStorages, unplaced } from "./rules";

const prov = (id: string, over: Partial<Provision> = {}): Provision =>
  ({ id, type: "provision", title: id, storageId: "s1", quantity: 1, unit: "", minimum: 0, expires: "", frozenOn: "", tags: [], folder: "", createdAt: "2026-01-01", updatedAt: 0, ...over }) as unknown as Provision;
const store = (id: string, kind: Storage["kind"], title = id): Storage =>
  ({ id, type: "storage", title, kind, tags: [], folder: "", createdAt: "2026-01-01", updatedAt: 0 }) as unknown as Storage;

describe("running low", () => {
  it("zero is always running low, minimum or not", () => {
    expect(isRunningLow({ quantity: 0, minimum: 0 })).toBe(true);
    expect(isRunningLow({ quantity: 0, minimum: 3 })).toBe(true);
  });
  it("under the minimum is low, at the minimum is not", () => {
    expect(isRunningLow({ quantity: 2, minimum: 3 })).toBe(true);
    expect(isRunningLow({ quantity: 3, minimum: 3 })).toBe(false);
  });
  it("minimum 0 means no threshold", () => {
    expect(isRunningLow({ quantity: 1, minimum: 0 })).toBe(false);
  });
  it("reads over the whole stock, sorted by title", () => {
    const low = runningLow([prov("b", { quantity: 0 }), prov("a", { quantity: 1, minimum: 2 }), prov("c", { quantity: 5 })]);
    expect(low.map((p) => p.id)).toEqual(["a", "b"]);
  });
});

describe("expiry", () => {
  it("adds days across month ends in UTC", () => {
    expect(addDays("2026-08-28", 7)).toBe("2026-09-04");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("no date, no fuss", () => {
    expect(expiresSoon(prov("a"), "2026-09-01", 7)).toBe(false);
    expect(isExpired(prov("a"), "2026-09-01")).toBe(false);
  });
  it("soon includes today, the edge of the window, and the already-expired", () => {
    expect(expiresSoon(prov("a", { expires: "2026-09-01" }), "2026-09-01", 7)).toBe(true);
    expect(expiresSoon(prov("a", { expires: "2026-09-08" }), "2026-09-01", 7)).toBe(true);
    expect(expiresSoon(prov("a", { expires: "2026-09-09" }), "2026-09-01", 7)).toBe(false);
    expect(expiresSoon(prov("a", { expires: "2026-08-01" }), "2026-09-01", 7)).toBe(true);
  });
  it("expired is strictly before today", () => {
    expect(isExpired(prov("a", { expires: "2026-08-31" }), "2026-09-01")).toBe(true);
    expect(isExpired(prov("a", { expires: "2026-09-01" }), "2026-09-01")).toBe(false);
  });
  it("sorts the expiring soonest first", () => {
    const list = [prov("b", { expires: "2026-09-05" }), prov("a", { expires: "2026-09-02" }), prov("c")];
    expect(expiring(list, "2026-09-01", 7).map((p) => p.id)).toEqual(["a", "b"]);
  });
});

describe("storages and placement", () => {
  it("walks freezer, fridge, shelf, then alphabetical", () => {
    const s = sortStorages([store("s3", "shelf"), store("s2", "fridge"), store("s1b", "freezer", "b"), store("s1a", "freezer", "a")]);
    expect(s.map((x) => x.id)).toEqual(["s1a", "s1b", "s2", "s3"]);
  });
  it("lists a storage's provisions by title", () => {
    const list = [prov("b"), prov("a"), prov("x", { storageId: "s2" })];
    expect(provisionsIn(list, "s1").map((p) => p.id)).toEqual(["a", "b"]);
  });
  it("flags provisions whose storage is gone", () => {
    const orphans = unplaced([prov("a"), prov("b", { storageId: "ghost" })], [store("s1", "fridge")]);
    expect(orphans.map((p) => p.id)).toEqual(["b"]);
  });
});

describe("quick-add matching", () => {
  const list = [prov("milk", { title: "Milk" }), prov("milk2", { title: "Milk", storageId: "s2" })];
  it("matches case-insensitively within the target storage", () => {
    expect(matchByTitle(list, "s1", "  milk ")?.id).toBe("milk");
    expect(matchByTitle(list, "s2", "MILK")?.id).toBe("milk2");
  });
  it("no cross-storage match, no empty match", () => {
    expect(matchByTitle(list, "s3", "Milk")).toBeUndefined();
    expect(matchByTitle(list, "s1", "   ")).toBeUndefined();
  });
});

describe("quantities", () => {
  it("whole, never negative, garbage-proof", () => {
    expect(clampQty(-1)).toBe(0);
    expect(clampQty(2.6)).toBe(3);
    expect(clampQty(Number.NaN)).toBe(0);
  });
});
