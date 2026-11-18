import { describe, expect, it } from "vitest";
import type { Person, Tie } from "./types";
import { PRESETS, genderOf, presetPressed, selectPreset, kindOfWords, presetWords, otherNameOf, tieCandidates, tieDraft, tieQuestions, tiesSeenFrom } from "./ties";

const person = (id: string, title: string) => ({ id, title }) as Person;
const anne = person("p1", "Anne");
const lea = person("p2", "Léa");
const marc = person("p3", "Marc");
const tie = (id: string, a: string, b: string, labelA: string, labelB: string) => ({ id, a, b, labelA, labelB }) as Tie;

const motherDaughter = tie("t1", "p1", "p2", "mother", "daughter");

describe("a Tie read from either end", () => {
  it("shows Anne the other end's word and Léa, as 'daughter: Léa'", () => {
    expect(tiesSeenFrom("p1", [motherDaughter], [anne, lea])).toEqual([{ id: "t1", otherId: "p2", otherName: "Léa", label: "daughter", ownLabel: "mother", kind: "parent", kindRead: true }]);
  });

  it("shows Léa the labels swapped, as 'mother: Anne'", () => {
    expect(tiesSeenFrom("p2", [motherDaughter], [anne, lea])).toEqual([{ id: "t1", otherId: "p1", otherName: "Anne", label: "mother", ownLabel: "daughter", kind: "child", kindRead: true }]);
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
    expect(tieDraft({ id: "t1", otherId: "p2", otherName: "Léa", label: "daughter", ownLabel: "mother", kind: "parent" })).toEqual({ otherId: "p2", label: "daughter", ownLabel: "mother", kind: "parent" });
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

describe("Tie kinds read from words (#608)", () => {
  it("reads a matching preset pair as its kind, any case, trimmed", () => {
    expect(kindOfWords("mother", "daughter")).toBe("parent");
    expect(kindOfWords(" Daughter ", "MOTHER")).toBe("child");
    expect(kindOfWords("husband", "wife")).toBe("partner");
    expect(kindOfWords("aunt or uncle", "niece")).toBe("auntUncle");
    expect(kindOfWords("cousin", "cousin")).toBe("cousin");
  });
  it("reads a non-matching pair as no kind", () => {
    expect(kindOfWords("mother", "godson")).toBeUndefined();
    expect(kindOfWords("godmother", "goddaughter")).toBeUndefined();
    expect(kindOfWords("mother", "mother")).toBeUndefined();
  });
  it("marks a kind read from the words, not a stored one", () => {
    const stored = { ...motherDaughter, kind: "parent" } as Tie;
    expect(tiesSeenFrom("p1", [stored], [anne, lea])[0]).not.toHaveProperty("kindRead");
    expect(tiesSeenFrom("p1", [motherDaughter], [anne, lea])[0]).toHaveProperty("kindRead", true);
  });
  it("carries the read mark into the draft, and a tapped chip drops it", () => {
    const row = tiesSeenFrom("p1", [motherDaughter], [anne, lea])[0]!;
    const d = tieDraft(row);
    expect(d).toMatchObject({ kind: "parent", kindRead: true });
    expect(selectPreset(d, PRESETS.find((p) => p.word === "son")!, "female")).not.toHaveProperty("kindRead");
  });
  it("ignores a stored kind that is not one", () => {
    expect(tiesSeenFrom("p1", [{ ...tie("t1", "p1", "p2", "godmother", "goddaughter"), kind: "text" } as unknown as Tie], [anne, lea])[0]).not.toHaveProperty("kind");
  });
  it("offers the chips in the spec's order", () => {
    expect(PRESETS.map((p) => p.word).join(" ")).toBe(
      "daughter son child sister brother sibling mother father parent wife husband partner granddaughter grandson grandchild grandmother grandfather grandparent niece nephew aunt uncle cousin",
    );
  });
});

describe("Gender reading and the chip's inverse word (#609)", () => {
  const preset = (word: string) => PRESETS.find((p) => p.word === word)!;
  const ties = (...ts: Tie[]) => ts;

  it("reads a Person as female from the words that name them in kinded Ties", () => {
    // Anne is Léa's mother; Anne is Marc's wife.
    expect(genderOf("p1", ties(tie("t1", "p1", "p2", "mother", "daughter"), tie("t2", "p3", "p1", "husband", "wife")))).toBe("female");
  });
  it("reads male from son/brother/…, from either end of the stored Tie", () => {
    expect(genderOf("p2", ties(tie("t1", "p1", "p2", "mother", "son")))).toBe("male");
  });
  it("is neutral with mixed words, neutral words, no Ties, or free words", () => {
    expect(genderOf("p1", ties(tie("t1", "p1", "p2", "mother", "daughter"), tie("t2", "p1", "p3", "father", "son")))).toBe("neutral");
    expect(genderOf("p1", ties(tie("t1", "p1", "p2", "parent", "child")))).toBe("neutral");
    expect(genderOf("p1", ties(tie("t1", "p1", "p2", "cousin", "cousin")))).toBe("neutral");
    expect(genderOf("p1", [])).toBe("neutral");
    expect(genderOf("p1", ties(tie("t1", "p1", "p2", "godmother", "godson")))).toBe("neutral");
  });
  it("counts a Tie's stored kind even when its words are free ('mum')", () => {
    expect(genderOf("p1", ties({ ...tie("t1", "p1", "p2", "mum", "daughter"), kind: "parent" } as Tie))).toBe("neutral");
    expect(genderOf("p2", ties({ ...tie("t1", "p1", "p2", "mum", "daughter"), kind: "parent" } as Tie))).toBe("female");
  });
  it("tapping 'daughter' gives mother, father or parent after the page's Person", () => {
    expect(presetWords(preset("daughter"), "female")).toEqual({ label: "daughter", ownLabel: "mother", kind: "parent" });
    expect(presetWords(preset("daughter"), "male")).toEqual({ label: "daughter", ownLabel: "father", kind: "parent" });
    expect(presetWords(preset("daughter"), "neutral")).toEqual({ label: "daughter", ownLabel: "parent", kind: "parent" });
  });
  it("gives the kind's other words for the other chips", () => {
    expect(presetWords(preset("mother"), "male")).toEqual({ label: "mother", ownLabel: "son", kind: "child" });
    expect(presetWords(preset("cousin"), "female")).toEqual({ label: "cousin", ownLabel: "cousin", kind: "cousin" });
    expect(presetWords(preset("niece"), "neutral")).toEqual({ label: "niece", ownLabel: "aunt or uncle", kind: "auntUncle" });
  });
});

describe("Tapping a preset chip in the dialog (#611)", () => {
  const daughter = PRESETS.find((p) => p.word === "daughter")!;
  const blank = { otherId: "p2", label: "", ownLabel: "" };

  it("fills both words and the kind", () => {
    expect(selectPreset(blank, daughter, "female")).toEqual({ otherId: "p2", label: "daughter", ownLabel: "mother", kind: "parent" });
  });
  it("shows the chip pressed while its word and kind stand", () => {
    const d = selectPreset(blank, daughter, "neutral");
    expect(presetPressed(d, daughter)).toBe(true);
    expect(presetPressed(d, PRESETS.find((p) => p.word === "son")!)).toBe(false);
  });
  it("keeps the kind, and the chip pressed, when only the other word is edited", () => {
    const edited = { ...selectPreset(blank, daughter, "female"), ownLabel: "mum" };
    expect(edited.kind).toBe("parent");
    expect(presetPressed(edited, daughter)).toBe(true);
    expect(presetPressed({ ...edited, label: "girl" }, daughter)).toBe(false);
  });
  it("clears the kind and leaves the words when the pressed chip is tapped again", () => {
    const d = selectPreset(blank, daughter, "female");
    expect(selectPreset(d, daughter, "female")).toEqual({ otherId: "p2", label: "daughter", ownLabel: "mother" });
  });
});
