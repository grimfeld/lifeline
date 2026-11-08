import { describe, expect, it } from "vitest";
import type { Person, Tie } from "./types";
import { tiesSeenFrom } from "./ties";

const person = (id: string, title: string) => ({ id, title }) as Person;
const anne = person("p1", "Anne");
const lea = person("p2", "Léa");
const marc = person("p3", "Marc");
const tie = (id: string, a: string, b: string, labelA: string, labelB: string) => ({ id, a, b, labelA, labelB }) as Tie;

const motherDaughter = tie("t1", "p1", "p2", "mother", "daughter");

describe("a Tie read from either end", () => {
  it("shows Anne the other end's word and Léa, as 'daughter: Léa'", () => {
    expect(tiesSeenFrom("p1", [motherDaughter], [anne, lea])).toEqual([{ id: "t1", otherId: "p2", otherName: "Léa", label: "daughter", ownLabel: "mother" }]);
  });

  it("shows Léa the labels swapped, as 'mother: Anne'", () => {
    expect(tiesSeenFrom("p2", [motherDaughter], [anne, lea])).toEqual([{ id: "t1", otherId: "p1", otherName: "Anne", label: "mother", ownLabel: "daughter" }]);
  });

  it("leaves out Ties of other People", () => {
    expect(tiesSeenFrom("p3", [motherDaughter], [anne, lea, marc])).toEqual([]);
  });

  it("skips a Tie whose other Person is gone, so the page never breaks", () => {
    expect(tiesSeenFrom("p1", [motherDaughter], [anne])).toEqual([]);
  });

  it("lists several Ties between People in name order", () => {
    const ties = [tie("t2", "p1", "p3", "friend", "friend"), motherDaughter];
    expect(tiesSeenFrom("p1", ties, [anne, lea, marc]).map((r) => r.otherName)).toEqual(["Léa", "Marc"]);
  });
});
