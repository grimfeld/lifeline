import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { getDocument, initApps, putDocument, type DocumentTypeDef } from "@lifeline/core";
import { DECK, FACT, PUZZLE, RECALL, SENTENCE, TOPIC, WORD, type Recall, type Topic } from "../domain/types";
import { fold, isAnswer, keyboardLetters, letterMarks, scoreGuess, wordleRows } from "../domain/puzzle";
import { addTopic, addWord, updateTopic } from "./repo";
import { getPuzzle, guessPuzzle, openDailyPuzzle } from "./puzzles";

const bare = (id: string) => ({ id, label: id, titleRule: "name", body: "optional", fields: [], indexes: ["languageId", "itemId"], builtIn: true }) as unknown as DocumentTypeDef;
initApps([{ id: "languages", title: "Knowledge", types: [TOPIC, WORD, SENTENCE, FACT, RECALL, DECK, PUZZLE].map(bare), screens: [], cards: [], commands: [] }]);

const NOW = new Date(2026, 9, 24, 10, 0);

async function topicWith(term: string, enyeOwn?: boolean): Promise<string> {
  const id = await addTopic({ name: `T ${term} ${enyeOwn}`, newCap: 10, tallies: [], enyeOwn });
  const w = await addWord({ languageId: id, term, meaning: "m" });
  await putDocument<Recall>({ type: RECALL, title: "", languageId: id, itemId: w, slot: "reverse", grade: "pass", at: new Date(2026, 9, 20).toISOString(), tags: [] });
  return id;
}

describe("ñ as its own letter (a Topic setting)", () => {
  it("folds ñ to n by default, keeps it apart when asked", () => {
    expect(fold("Niño")).toBe("nino");
    expect(fold("Niño", true)).toBe("niño");
    expect(fold("ÁRBOL", true)).toBe("arbol");
    expect(isAnswer("niño", "nino")).toBe(true);
    expect(isAnswer("niño", "nino", true)).toBe(false);
    expect(isAnswer("niño", "NIÑO", true)).toBe(true);
    expect(scoreGuess("niño", "nino", true)).toEqual(["right", "right", "absent", "right"]);
  });

  it("is off on a new Topic and survives an edit that does not mention it", async () => {
    const id = await addTopic({ name: "Plain", newCap: 10, tallies: [] });
    expect((await getDocument<Topic>(id))?.enyeOwn).toBeFalsy();
    const t = (await getDocument<Topic>(id))!;
    await updateTopic(t, { name: "Plain", newCap: 10, tallies: [], enyeOwn: true });
    expect((await getDocument<Topic>(id))?.enyeOwn).toBe(true);
    await updateTopic((await getDocument<Topic>(id))!, { name: "Plain 2", newCap: 10, tallies: [] });
    expect((await getDocument<Topic>(id))?.enyeOwn).toBe(true);
  });

  it("decides what a guess matches: off, nino solves niño; on, it does not", async () => {
    const off = await topicWith("niño");
    const p = (await openDailyPuzzle(off, "wordle", { now: NOW }))!;
    expect((await guessPuzzle(p.id, "nino", NOW)).outcome).toBe("solved");

    const on = await topicWith("niño", true);
    const q = (await openDailyPuzzle(on, "wordle", { now: NOW }))!;
    const wrong = await guessPuzzle(q.id, "nino", NOW);
    expect(wrong.outcome).toBe("playing");
    expect(wordleRows(wrong, true)[0]!.map((c) => c.mark)).toEqual(["right", "right", "absent", "right"]);
    expect((await guessPuzzle(q.id, "NIÑO", NOW)).outcome).toBe("solved");
    expect((await getPuzzle(q.id, NOW))?.outcome).toBe("solved");
  });
});

describe("the keyboard's letters", () => {
  it("are the folded letters of the kept terms, once each, in order", () => {
    expect(keyboardLetters(["Árbol", "niño", "tener ganas"], false)).toEqual("abegilnorst".split(""));
  });

  it("has ñ only when it is its own letter, after n", () => {
    expect(keyboardLetters(["niño"], false)).toEqual(["i", "n", "o"]);
    expect(keyboardLetters(["niño"], true)).toEqual(["i", "n", "ñ", "o"]);
  });

  it("always holds the extra letters asked for, and drops what is not a letter", () => {
    expect(keyboardLetters(["a-b 1"], false, ["z"])).toEqual(["a", "b", "z"]);
  });
});

describe("what guesses revealed of each letter", () => {
  it("keeps the best mark: right over wrong place over absent", () => {
    const m = letterMarks("casa", ["saca", "aaaa", "xxxx"]);
    expect(m.get("a")).toBe("right");
    expect(m.get("s")).toBe("present");
    expect(m.get("c")).toBe("present");
    expect(m.get("x")).toBe("absent");
    expect(m.has("z")).toBe(false);
  });
});
