import { describe, expect, it } from "vitest";
import { editQueue } from "./editQueue";

describe("editQueue", () => {
  it("runs each edit after the one before has finished", async () => {
    const inTurn = editQueue();
    const log: string[] = [];
    const slow = inTurn(async () => {
      await new Promise((r) => setTimeout(r, 10));
      log.push("first");
    });
    const fast = inTurn(async () => void log.push("second"));
    await Promise.all([slow, fast]);
    expect(log).toEqual(["first", "second"]);
  });

  it("keeps going after an edit fails, which still rejects for its caller", async () => {
    const inTurn = editQueue();
    const failed = inTurn(async () => {
      throw new Error("no");
    });
    const after = inTurn(async () => "ran");
    await expect(failed).rejects.toThrow("no");
    await expect(after).resolves.toBe("ran");
  });
});
