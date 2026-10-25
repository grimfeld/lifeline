import { describe, expect, it } from "vitest";
import { applyRuleChanges, undoRuleChanges, WriteStoppedError } from "./applyChanges";
import type { RuleChange } from "./suggest";

const change = (id: string, from: string, to: string) => ({ transaction: { id }, from, to }) as unknown as RuleChange;

describe("applyRuleChanges / undoRuleChanges", () => {
  it("applies each `to`, and undo writes back each exact `from`, uncategorized included", async () => {
    const store: Record<string, string> = { a: "taxi", b: "" };
    const write = async (id: string, c: string) => void (store[id] = c);
    const done = await applyRuleChanges([change("a", "taxi", "cab"), change("b", "", "cab")], write);
    expect(store).toEqual({ a: "cab", b: "cab" });
    await undoRuleChanges(done, write);
    expect(store).toEqual({ a: "taxi", b: "" });
  });

  it("reports how far an apply got", async () => {
    const write = async (id: string) => {
      if (id === "b") throw new Error("boom");
    };
    await expect(applyRuleChanges([change("a", "x", "y"), change("b", "x", "y")], write)).rejects.toThrow("Stopped after 1 of 2: boom");
  });

  it("carries the rows already written on the error, so they can still be undone", async () => {
    const store: Record<string, string> = { a: "x", b: "x" };
    const write = async (id: string, c: string) => {
      if (id === "b" && c === "y") throw new Error("boom");
      store[id] = c;
    };
    const err = await applyRuleChanges([change("a", "x", "y"), change("b", "x", "y")], write).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(WriteStoppedError);
    const done = (err as WriteStoppedError).done;
    expect(done.map((c) => c.transaction.id)).toEqual(["a"]);
    await undoRuleChanges(done, write);
    expect(store).toEqual({ a: "x", b: "x" });
  });

  it("reports how far an undo got", async () => {
    const write = async (id: string) => {
      if (id === "b") throw new Error("boom");
    };
    await expect(undoRuleChanges([change("a", "x", "y"), change("b", "x", "y")], write)).rejects.toThrow("Undo stopped after 1 of 2: boom");
  });
});
