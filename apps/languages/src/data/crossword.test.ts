import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { documentsOf, initApps, putDocument, removeDocument, type DocumentTypeDef } from "@lifeline/core";
import { DECK, FACT, PUZZLE, RECALL, SENTENCE, TOPIC, WORD, type Grade, type Puzzle, type Recall, type Topic } from "../domain/types";
import { crosswordCells } from "../domain/crossword";
import { addFact, addSentence, addWord, setPaused, setTopicArchived } from "./repo";
import { enterCrossword, getPuzzle, giveUpPuzzle, openDailyPuzzle, openReplayPuzzle, todaysPuzzles } from "./puzzles";

// The Knowledge types, bare: the App manifest pulls in screens that need a DOM.
const bare = (id: string) => ({ id, label: id, titleRule: "name", body: "optional", fields: [], indexes: ["languageId", "itemId"], builtIn: true }) as unknown as DocumentTypeDef;
initApps([{ id: "languages", title: "Knowledge", types: [TOPIC, WORD, SENTENCE, FACT, RECALL, DECK, PUZZLE].map(bare), screens: [], cards: [], commands: [] }]);

const NOW = new Date(2026, 9, 24, 10, 0);
const TOMORROW = new Date(2026, 9, 25, 0, 5);
const daysAgo = (n: number) => new Date(2026, 9, 24 - n, 9, 0).toISOString();

let topics = 0;
async function topic(enyeOwn = false): Promise<string> {
  const row = await putDocument<Topic>({ type: TOPIC, title: `Topic ${++topics}`, name: `Topic ${topics}`, newCap: 10, archived: false, enyeOwn, tallies: [], tags: [] });
  return row.id;
}

async function recall(topicId: string, itemId: string, slot: string, at = daysAgo(3), grade: Grade = "pass") {
  await putDocument<Recall>({ type: RECALL, title: "", languageId: topicId, itemId, slot, grade, at, tags: [] });
}

async function word(topicId: string, term: string, meaning = `the meaning of ${term}`): Promise<string> {
  const id = await addWord({ languageId: topicId, term, meaning });
  await recall(topicId, id, "reverse");
  return id;
}

/** Five Words that cross each other easily: a Topic with a crossword. */
async function five(topicId: string): Promise<string[]> {
  const ids: string[] = [];
  for (const t of ["casa", "mapa", "sala", "pasa", "lata"]) ids.push(await word(topicId, t));
  return ids;
}

const recallCount = async () => (await documentsOf(RECALL)).length;
const answers = (p: Puzzle | null) => (p?.drawn.map((d) => d.answer) ?? []).sort((a, b) => a.localeCompare(b, "es"));

/** Every cell filled with its own letter, as typed: `spell` turns the answer's letter into what is typed. */
async function solve(p: Puzzle, spell: (letter: string) => string = (l) => l, now = NOW): Promise<Puzzle> {
  return enterCrossword(p.id, crosswordCells(p).map((c) => ({ row: c.row, col: c.col, letter: spell(c.letter) })), now);
}

describe("what a crossword may draw", () => {
  it("Word terms, single-word Fact answers of 3–12 letters and Sentence blanks — each met, not paused, in the Topic", async () => {
    const t = await topic();
    const other = await topic();
    await word(t, "casa", "house");
    await word(t, "mapa", "map");
    await word(t, "sala", "living room");
    const roma = await addFact({ languageId: t, question: "The capital of Italy?", answer: "Roma" });
    await recall(t, roma, "forward");
    const sentence = await addSentence({ languageId: t, text: "Tengo {{ganas}} de {{comer}}", translation: "I feel like eating" });
    await recall(t, sentence, "blank:ganas"); // comer never met

    const paused = await word(t, "pasta");
    await setPaused(paused, true);
    await addWord({ languageId: t, term: "rata", meaning: "rat" }); // never met
    const forward = await addWord({ languageId: t, term: "nada", meaning: "nothing" });
    await recall(t, forward, "forward"); // met only meaning-side up
    await word(other, "lana");
    for (const [question, answer] of [["Who crossed the Rubicon?", "Julio César"], ["Old name of Istanbul?", "Constantinopla"], ["Father, informally?", "pa"]] as const) {
      const f = await addFact({ languageId: t, question, answer });
      await recall(t, f, "forward");
    }

    const p = await openDailyPuzzle(t, "crossword", { now: NOW });
    expect(answers(p)).toEqual(["casa", "ganas", "mapa", "Roma", "sala"]);
    expect(p!.drawn.find((d) => d.answer === "Roma")).toMatchObject({ itemId: roma, slot: "forward", clue: "The capital of Italy?" });
    expect(p!.drawn.find((d) => d.answer === "ganas")).toMatchObject({ itemId: sentence, slot: "blank:ganas", clue: "Tengo ___ de comer", hint: "I feel like eating" });
    expect(p!.drawn.find((d) => d.answer === "casa")).toMatchObject({ slot: "reverse", clue: "house" });
  });

  it("no crossword when fewer than five fit, nor on an archived Topic", async () => {
    const t = await topic();
    for (const w of ["casa", "mapa", "sala", "pasa"]) await word(t, w);
    expect(await openDailyPuzzle(t, "crossword", { now: NOW })).toBeNull();
    expect(await openReplayPuzzle(t, "crossword", { now: NOW })).toBeNull();
    expect((await todaysPuzzles(NOW)).some((x) => x.topic.id === t && x.format === "crossword")).toBe(false);

    await word(t, "lata");
    expect((await todaysPuzzles(NOW)).filter((x) => x.topic.id === t).map((x) => x.format)).toContain("crossword");
    await setTopicArchived(t, true);
    expect(await openDailyPuzzle(t, "crossword", { now: NOW })).toBeNull();
  });

  it("an answer the same as another, folded, is drawn once", async () => {
    const t = await topic();
    await five(t);
    const s = await addSentence({ languageId: t, text: "Mi {{casa}} es tu casa", translation: "My home is yours" });
    await recall(t, s, "blank:casa");
    const p = await openDailyPuzzle(t, "crossword", { now: NOW });
    expect(p!.drawn.filter((d) => d.answer === "casa")).toHaveLength(1);
  });
});

describe("today's crossword", () => {
  it("stores a grid where every answer crosses, and fixes it at first open", async () => {
    const t = await topic();
    await five(t);
    const p = (await openDailyPuzzle(t, "crossword", { now: NOW }))!;
    expect(p.layout).toHaveLength(p.drawn.length);
    const cells = crosswordCells(p);
    expect(cells.length).toBeGreaterThan(0);
    expect(cells.every((c) => c.letter.length > 0)).toBe(true);
    await word(t, "pala");
    const again = (await openDailyPuzzle(t, "crossword", { now: NOW }))!;
    expect(again.id).toBe(p.id);
    expect(again.layout).toEqual(p.layout);
    expect(answers(again)).toEqual(answers(p));
  });

  it("opened twice at once is one Puzzle, apart from the Wordle-like", async () => {
    const t = await topic();
    await five(t);
    const [a, b] = await Promise.all([openDailyPuzzle(t, "crossword", { now: NOW }), openDailyPuzzle(t, "crossword", { now: NOW })]);
    expect(a!.id).toBe(b!.id);
    const wordle = await openDailyPuzzle(t, "wordle", { now: NOW });
    expect(wordle!.id).not.toBe(a!.id);
  });

  it("keeps each cell entry as a guess, the latest one standing; solved only when every cell is right", async () => {
    const t = await topic();
    await five(t);
    const p = (await openDailyPuzzle(t, "crossword", { now: NOW }))!;
    const [first] = crosswordCells(p);
    let after = await enterCrossword(p.id, [{ row: first!.row, col: first!.col, letter: "x" }], NOW);
    expect(after.outcome).toBe("playing");
    expect(crosswordCells(after)[0]!.entry).toBe("x");
    after = await enterCrossword(p.id, [{ row: first!.row, col: first!.col, letter: "" }], NOW);
    expect(crosswordCells(after)[0]!.entry).toBe("");
    expect(after.guesses).toHaveLength(2);

    const most = crosswordCells(p).slice(1);
    after = await enterCrossword(p.id, most.map((c) => ({ row: c.row, col: c.col, letter: c.letter })), NOW);
    expect(after.outcome).toBe("playing");
    after = await enterCrossword(p.id, [{ row: first!.row, col: first!.col, letter: first!.letter.toUpperCase() }], NOW);
    expect(after.outcome).toBe("solved");
    expect(after.finishedAt).not.toBe("");
    await expect(enterCrossword(p.id, [{ row: first!.row, col: first!.col, letter: "x" }], NOW)).rejects.toThrow();
  });

  it("refuses a cell outside the grid, or more than one letter", async () => {
    const t = await topic();
    await five(t);
    const p = (await openDailyPuzzle(t, "crossword", { now: NOW }))!;
    await expect(enterCrossword(p.id, [{ row: -1, col: -1, letter: "a" }], NOW)).rejects.toThrow();
    const [c] = crosswordCells(p);
    await expect(enterCrossword(p.id, [{ row: c!.row, col: c!.col, letter: "ab" }], NOW)).rejects.toThrow();
  });

  it("folds accents, and ñ as n unless the Topic keeps it its own letter", async () => {
    const plain = (l: string) => l.normalize("NFD").replace(/\p{M}+/gu, "");
    for (const enye of [false, true]) {
      const t = await topic(enye);
      for (const w of ["niño", "árbol", "baño", "año", "río"]) await word(t, w);
      const p = (await openDailyPuzzle(t, "crossword", { now: NOW }))!;
      expect(answers(p)).toEqual(["año", "árbol", "baño", "niño", "río"]);
      expect(crosswordCells(p).some((c) => c.letter === "ñ")).toBe(true);
      expect((await solve(p, plain)).outcome).toBe(enye ? "playing" : "solved");
    }
  });

  it("given up, it is unsolved and takes no more entries", async () => {
    const t = await topic();
    await five(t);
    const p = (await openDailyPuzzle(t, "crossword", { now: NOW }))!;
    const gave = await giveUpPuzzle(p.id, NOW);
    expect(gave.outcome).toBe("unsolved");
    await expect(solve(p)).rejects.toThrow();
  });

  it("left unfinished past local midnight, it reads as unsolved and refuses entries", async () => {
    const t = await topic();
    await five(t);
    const p = (await openDailyPuzzle(t, "crossword", { now: NOW }))!;
    expect((await getPuzzle(p.id, TOMORROW))!.outcome).toBe("unsolved");
    await expect(solve(p, undefined, TOMORROW)).rejects.toThrow(/midnight/);
    expect((await openDailyPuzzle(t, "crossword", { now: TOMORROW }))!.id).not.toBe(p.id);
  });

  it("a replay is a new crossword each time, never the daily, playable past midnight", async () => {
    const t = await topic();
    await five(t);
    const daily = (await openDailyPuzzle(t, "crossword", { now: NOW }))!;
    const r = (await openReplayPuzzle(t, "crossword", { now: NOW }))!;
    expect(r.id).not.toBe(daily.id);
    expect(r.kind).toBe("replay");
    expect((await todaysPuzzles(NOW)).find((x) => x.topic.id === t && x.format === "crossword")?.puzzle?.id).toBe(daily.id);
    expect((await solve(r, undefined, TOMORROW)).outcome).toBe("solved");
  });

  it("never writes a Recall", async () => {
    const t = await topic();
    await five(t);
    const before = await recallCount();
    const p = (await openDailyPuzzle(t, "crossword", { now: NOW }))!;
    await solve(p);
    const r = (await openReplayPuzzle(t, "crossword", { now: NOW }))!;
    await giveUpPuzzle(r.id, NOW);
    expect(await recallCount()).toBe(before);
  });

  it("stays readable once an item it drew is deleted", async () => {
    const t = await topic();
    const ids = await five(t);
    const p = (await openDailyPuzzle(t, "crossword", { now: NOW }))!;
    await removeDocument(ids[0]!);
    const read = (await getPuzzle(p.id, NOW))!;
    expect(answers(read)).toEqual(answers(p));
    expect(crosswordCells(read)).toEqual(crosswordCells(p));
  });
});
