import { describe, expect, it } from "vitest";
import type { Person, Tie } from "./types";
import { PRESETS, genderOf, suggestedTies, presetPressed, selectPreset, kindOfWords, presetWords, otherNameOf, tieCandidates, tieDraft, tieQuestions, tiesSeenFrom } from "./ties";

const person = (id: string, title: string) => ({ id, title }) as Person;
const anne = person("p1", "Anne");
const lea = person("p2", "Léa");
const marc = person("p3", "Marc");
const tie = (id: string, a: string, b: string, labelA: string, labelB: string) => ({ id, a, b, labelA, labelB }) as Tie;

const motherDaughter = tie("t1", "p1", "p2", "mother", "daughter");

describe("a Tie read from either end", () => {
  it("shows Anne the other end's word and Léa, as 'daughter: Léa'", () => {
    expect(tiesSeenFrom("p1", [motherDaughter], [anne, lea])).toEqual([{ id: "t1", otherId: "p2", otherName: "Léa", label: "daughter", ownLabel: "mother", kind: "parent" }]);
  });

  it("shows Léa the labels swapped, as 'mother: Anne'", () => {
    expect(tiesSeenFrom("p2", [motherDaughter], [anne, lea])).toEqual([{ id: "t1", otherId: "p1", otherName: "Anne", label: "mother", ownLabel: "daughter", kind: "child" }]);
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
  it("keeps the kind when a word is edited, with no chip pressed", () => {
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

describe("Suggested Ties (#613)", () => {
  // Paul is the father of Tom and of Lily; the words say Tom is a son, Lily a daughter.
  const paul = person("paul", "Paul");
  const tom = person("tom", "Tom");
  const lily = person("lily", "Lily");
  const family = [paul, tom, lily];
  const fatherOfTom = tie("t1", "paul", "tom", "father", "son");
  const fatherOfLily = tie("t2", "paul", "lily", "father", "daughter");

  it("suggests siblings to the children of a shared parent, gendered by their words", () => {
    expect(suggestedTies("tom", [fatherOfTom, fatherOfLily], family)).toEqual([{ otherId: "lily", otherName: "Lily", kind: "sibling", label: "sister", ownLabel: "brother" }]);
    expect(suggestedTies("lily", [fatherOfTom, fatherOfLily], family)).toEqual([{ otherId: "tom", otherName: "Tom", kind: "sibling", label: "brother", ownLabel: "sister" }]);
  });

  it("suggests a parent's parent as grandparent, and the grandchild on the other page", () => {
    const rose = person("rose", "Rose");
    const roseMotherOfPaul = tie("t3", "rose", "paul", "mother", "son");
    expect(suggestedTies("tom", [fatherOfTom, roseMotherOfPaul], [...family, rose])).toEqual([{ otherId: "rose", otherName: "Rose", kind: "grandchild", label: "grandmother", ownLabel: "grandson" }]);
    expect(suggestedTies("rose", [fatherOfTom, roseMotherOfPaul], [...family, rose])).toEqual([{ otherId: "tom", otherName: "Tom", kind: "grandparent", label: "grandson", ownLabel: "grandmother" }]);
  });

  it("never suggests a pair already tied in any way, even by free words", () => {
    expect(suggestedTies("tom", [fatherOfTom, fatherOfLily, tie("t3", "tom", "lily", "best friend", "best friend")], family)).toEqual([]);
    expect(suggestedTies("lily", [fatherOfTom, fatherOfLily, tie("t3", "lily", "tom", "sister", "brother")], family)).toEqual([]);
  });

  it("never suggests a Person to themselves", () => {
    // Paul is tied twice to Tom: no "Tom is Tom's brother".
    expect(suggestedTies("tom", [fatherOfTom, tie("t4", "paul", "tom", "parent", "child")], family)).toEqual([]);
  });

  it("never suggests someone outside the current Workspace, nor through them", () => {
    expect(suggestedTies("tom", [fatherOfTom, fatherOfLily], [paul, tom])).toEqual([]);
    expect(suggestedTies("tom", [fatherOfTom, fatherOfLily], [tom, lily])).toEqual([]);
  });

  it("hides a suggestion dismissed by either Person of the pair, for that kind", () => {
    const ties = [fatherOfTom, fatherOfLily];
    expect(suggestedTies("tom", ties, [paul, { ...tom, dismissedTies: [{ otherId: "lily", kind: "sibling" }] }, lily])).toEqual([]);
    expect(suggestedTies("tom", ties, [paul, tom, { ...lily, dismissedTies: [{ otherId: "tom", kind: "sibling" }] }])).toEqual([]);
    // A dismissal of another kind, or of another Person, hides nothing; a malformed one is ignored.
    expect(suggestedTies("tom", ties, [paul, { ...tom, dismissedTies: [{ otherId: "lily", kind: "cousin" }, { otherId: "paul", kind: "sibling" }, "junk"] }, lily])).toHaveLength(1);
  });
});

describe("The other suggestion rules, and their order (#614)", () => {
  const paul = person("paul", "Paul");
  const tom = person("tom", "Tom");
  const lily = person("lily", "Lily");
  const alice = person("alice", "Alice");
  const mia = person("mia", "Mia");
  const zoe = person("zoe", "Zoé");
  const fatherOfTom = tie("t1", "paul", "tom", "father", "son");
  const fatherOfLily = tie("t2", "paul", "lily", "father", "daughter");
  const miaSisterOfPaul = tie("t3", "mia", "paul", "sister", "brother");
  const miaMotherOfZoe = tie("t4", "mia", "zoe", "mother", "daughter");
  const everyone = [paul, tom, lily, alice, mia, zoe];
  const on = (id: string, ties: Tie[]) => suggestedTies(id, ties, everyone).map((s) => `${s.otherName} is ${everyone.find((p) => p.id === id)!.title}'s ${s.label}`);

  it("suggests a parent's sibling as aunt or uncle, and the niece or nephew back", () => {
    expect(on("lily", [fatherOfLily, miaSisterOfPaul])).toEqual(["Mia is Lily's aunt"]);
    expect(on("mia", [fatherOfLily, miaSisterOfPaul])).toEqual(["Lily is Mia's niece"]);
  });

  it("suggests a parent's sibling's child as cousin", () => {
    expect(on("lily", [fatherOfLily, miaSisterOfPaul, miaMotherOfZoe])).toEqual(["Mia is Lily's aunt", "Zoé is Lily's cousin"]);
    expect(on("zoe", [fatherOfLily, miaSisterOfPaul, miaMotherOfZoe])).toContain("Lily is Zoé's cousin");
  });

  it("suggests a sibling's parent as parent", () => {
    expect(on("lily", [fatherOfTom, tie("t5", "tom", "lily", "brother", "sister")])).toEqual(["Paul is Lily's father"]);
    expect(on("paul", [fatherOfTom, tie("t5", "tom", "lily", "brother", "sister")])).toEqual(["Lily is Paul's daughter"]);
  });

  it("suggests a parent's partner as parent: Alice is Lily's mother", () => {
    const aliceWifeOfPaul = tie("t6", "alice", "paul", "wife", "husband");
    expect(on("lily", [fatherOfLily, aliceWifeOfPaul])).toEqual(["Alice is Lily's mother"]);
    expect(on("alice", [fatherOfLily, aliceWifeOfPaul])).toEqual(["Lily is Alice's daughter"]);
  });

  it("shows one suggestion for a pair, by rule order", () => {
    // Tom and Lily share Paul (rule 1, siblings), and Tom is also Mia's son while Mia is Paul's sister (rule 4 would say cousins).
    const suggestions = suggestedTies("lily", [fatherOfTom, fatherOfLily, miaSisterOfPaul, tie("t7", "mia", "tom", "mother", "son")], everyone);
    expect(suggestions.filter((s) => s.otherId === "tom")).toEqual([{ otherId: "tom", otherName: "Tom", kind: "sibling", label: "brother", ownLabel: "sister" }]);
  });
});
