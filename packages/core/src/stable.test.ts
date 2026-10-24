import { describe, expect, it } from "vitest";
import { reuseRows } from "./stable";

const row = (id: string, updatedAt: string, title = id) => ({ id, updatedAt, title });

describe("reuseRows", () => {
  it("keeps an unwritten row's object and takes a written one's new object", () => {
    const prev = [row("a", "1"), row("b", "1")];
    const next = [row("a", "1"), row("b", "2", "B")];
    const out = reuseRows(prev, next);
    expect(out[0]).toBe(prev[0]);
    expect(out[1]).toBe(next[1]);
  });

  it("hands back the earlier array itself when no row changed", () => {
    const prev = [row("a", "1"), row("b", "1")];
    expect(reuseRows(prev, [row("a", "1"), row("b", "1")])).toBe(prev);
  });

  it("is a new array when the rows only moved, or one went", () => {
    const prev = [row("a", "1"), row("b", "1")];
    const swapped = reuseRows(prev, [row("b", "1"), row("a", "1")]);
    expect(swapped).not.toBe(prev);
    expect(swapped[0]).toBe(prev[1]);
    expect(reuseRows(prev, [row("a", "1")])).toEqual([prev[0]]);
  });
});
