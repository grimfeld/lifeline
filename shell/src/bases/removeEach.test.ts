import { describe, expect, it } from "vitest";
import { refusalSummary, removeEach } from "./removeEach";

// Swear Jar's `onDelete` guard refuses an Offence that has Fines by throwing this.
const USED = "This offence has fines — archive it instead";

describe("removeEach", () => {
  it("deletes the deletable Offences and reports the used one with its reason", async () => {
    const gone: string[] = [];
    const remove = async (id: string) => {
      if (id === "used") throw new Error(USED);
      gone.push(id);
    };
    const r = await removeEach(["a", "used", "b"], remove);
    expect(gone).toEqual(["a", "b"]);
    expect(r.removed).toEqual(["a", "b"]);
    expect(r.refused).toEqual([{ id: "used", message: USED }]);
  });

  it("groups equal messages", () => {
    expect(refusalSummary([{ message: USED }, { message: USED }])).toBe(USED);
    expect(refusalSummary([{ message: "x" }, { message: "y" }])).toBe("x; y");
  });
});
