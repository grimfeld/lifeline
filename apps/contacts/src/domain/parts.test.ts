import { describe, expect, it } from "vitest";
import { putBack, takeOut } from "./parts";

const a = { id: "a" };
const b = { id: "b" };
const c = { id: "c" };

describe("a Person's parts", () => {
  it("takes one out and says where it stood", () => {
    expect(takeOut([a, b, c], "b")).toEqual({ list: [a, c], index: 1 });
    expect(takeOut([a], "x")).toEqual({ list: [a], index: -1 });
  });

  it("puts it back where it stood, keeping what was added since", () => {
    const d = { id: "d" };
    expect(putBack([a, c, d], b, 1)).toEqual([a, b, c, d]);
  });

  it("puts it at the end when the list has shrunk, and never twice", () => {
    expect(putBack([a], c, 2)).toEqual([a, c]);
    expect(putBack([a, b], b, 0)).toEqual([a, b]);
    expect(putBack([a], b, -1)).toEqual([a, b]);
  });
});
