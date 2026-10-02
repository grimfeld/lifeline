import { describe, expect, it } from "vitest";
import type { Allowance } from "./types";
import { allowanceFor } from "./spend";

const allowance = (id: string, name: string, from: string): Allowance =>
  ({ id, type: "pocket_allowance", title: name, tags: [], folder: "", createdAt: "", updatedAt: "", deleted: 0, name, period: "month", from, to: "", amount: 10000, emoji: "", color: "" }) as Allowance;

describe("allowanceFor", () => {
  const all = [allowance("sep", "Eating out", "2026-09-01"), allowance("oct", "Eating out", "2026-10-01"), allowance("fun", "Fun", "2026-10-01")];

  it("takes the named Allowance whose period covers the day", () => {
    expect(allowanceFor("eating out", all, "2026-10-02").id).toBe("oct");
    expect(allowanceFor("Eating out", all, "2026-09-30").id).toBe("sep");
  });

  it("takes an id whatever the day", () => {
    expect(allowanceFor("sep", all, "2026-10-02").id).toBe("sep");
  });

  it("refuses a name with no running Allowance, and an ambiguous one", () => {
    expect(() => allowanceFor("Eating out", all, "2026-12-01")).toThrow("runs on 2026-12-01");
    expect(() => allowanceFor("Fun", [...all, allowance("fun2", "fun", "2026-10-01")], "2026-10-02")).toThrow("pass one id: fun, fun2");
  });
});
