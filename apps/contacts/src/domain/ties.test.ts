import { describe, expect, it } from "vitest";
import type { Person, Tie } from "./types";
import { otherNameOf, tieCandidates, tieDraft, tieQuestions, tiesSeenFrom } from "./ties";

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

describe("the Tie dialog", () => {
  it("offers everyone but this Person, by name and alias, with their Relationship when they have one", () => {
    const people = [
      { id: "p1", title: "Anne", aliases: ["Mum"], relationship: "my mother" },
      { id: "p2", title: "Léa", aliases: [], relationship: "" },
      { id: "p3", title: "Marc", aliases: ["M"], relationship: "colleague" },
    ];
    expect(tieCandidates("p1", people)).toEqual([
      { value: "p2", label: "Léa", keywords: [] },
      { value: "p3", label: "Marc", keywords: ["M"], description: "colleague" },
    ]);
  });
  it("opens blank for a new Tie, and on the row's other Person and words for an edit", () => {
    expect(tieDraft(undefined)).toEqual({ otherId: "", label: "", ownLabel: "" });
    expect(tieDraft({ id: "t1", otherId: "p2", otherName: "Léa", label: "daughter", ownLabel: "mother" })).toEqual({ otherId: "p2", label: "daughter", ownLabel: "mother" });
  });
  it("names the other Person picked, else the row's, else nobody yet", () => {
    expect(otherNameOf([anne, lea], "p2", undefined)).toBe("Léa");
    expect(otherNameOf([anne, lea], "p2", { otherName: "Old name" })).toBe("Léa");
    expect(otherNameOf([anne], "p2", { otherName: "Léa" })).toBe("Léa");
    expect(otherNameOf([anne, lea], "", undefined)).toBe("");
  });
  it("asks how the two People stand to each other, never about me", () => {
    expect(tieQuestions("Anne", "Léa")).toEqual({ label: "Léa is Anne's…", ownLabel: "Anne is Léa's…" });
    expect(tieQuestions("Anne", "")).toEqual({ label: "They are Anne's…", ownLabel: "Anne is their…" });
  });
});
