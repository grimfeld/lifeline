import { describe, expect, it, vi } from "vitest";
import { logWallRefusal, overCap } from "./devices";

const idle = { pending: 0, waiting: new Map() };
const busy = { pending: 0, waiting: new Map([[1, {} as never]]) };
const unpushed = { pending: 2, waiting: new Map() };

describe("overCap", () => {
  it("stops nothing within the cap", () => {
    expect(overCap(new Map([["a", idle], ["b", idle]]), 2)).toEqual([]);
  });

  it("stops the least recently used first", () => {
    expect(overCap(new Map([["a", idle], ["b", idle], ["c", idle]]), 2)).toEqual(["a"]);
  });

  it("never stops a device with a call in flight or writes the server has not taken", () => {
    expect(overCap(new Map([["a", busy], ["b", unpushed], ["c", idle], ["d", idle]]), 2)).toEqual(["c", "d"]);
    expect(overCap(new Map([["a", busy], ["b", unpushed], ["c", idle]]), 1)).toEqual(["c"]);
  });
});

describe("logWallRefusal", () => {
  it("logs the tool, the Account, and the type's key it refused, tagged for a search", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      logWallRefusal("people_add", "u1", { type: "contacts_person", key: "addresses" });
      expect(warn).toHaveBeenCalledWith("[agent-wall] refused", { tool: "people_add", userId: "u1", type: "contacts_person", key: "addresses" });
    } finally {
      warn.mockRestore();
    }
  });
});
