import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { documentsOf, getDocument, initApps, putDocument, removeDocument, type DocumentTypeDef } from "@lifeline/core";
import { DECK, FACT, OCCURRENCE_PRACTISED, OCCURRENCE_PUZZLE, PUZZLE, RECALL, SENTENCE, TOPIC, WORD, type Grade, type Recall, type Topic } from "../domain/types";
import { wordleRows } from "../domain/puzzle";
import { addSentence, addWord, recordRecall, setPaused, setTopicArchived } from "./repo";
import { getPuzzle, giveUpPuzzle, guessPuzzle, openDailyPuzzle, openReplayPuzzle, todaysPuzzles } from "./puzzles";

// The Knowledge types, bare: the App manifest pulls in screens that need a DOM.
const bare = (id: string) => ({ id, label: id, titleRule: "name", body: "optional", fields: [], indexes: ["languageId", "itemId"], builtIn: true }) as unknown as DocumentTypeDef;
const logged: { id: string; note?: string }[] = [];
let failLogs = false;
initApps([
  {
    id: "languages",
    title: "Knowledge",
    types: [TOPIC, WORD, SENTENCE, FACT, RECALL, DECK, PUZZLE].map(bare),
    screens: [],
    cards: [],
    commands: [],
    tallying: [{ typeId: TOPIC, occurrence: OCCURRENCE_PRACTISED, occurrences: [{ id: OCCURRENCE_PRACTISED, label: "day practised" }, { id: OCCURRENCE_PUZZLE, label: "daily Puzzle finished" }] }],
  },
  {
    id: "habits",
    title: "Habits",
    types: [],
    screens: [],
    cards: [],
    commands: [],
    loggable: {
      appId: "habits",
      useTargets: () => [],
      async log(id: string, p: { note?: string }) {
        if (failLogs) throw new Error("The Habit is gone");
        logged.push({ id, note: p.note });
      },
    },
  },
] as never);

/** Mid-morning, local: every test plays "today" at this hour. */
const NOW = new Date(2026, 9, 24, 10, 0);
const TOMORROW = new Date(2026, 9, 25, 0, 5);
const daysAgo = (n: number) => new Date(2026, 9, 24 - n, 9, 0).toISOString();

let topics = 0;
async function topic(): Promise<string> {
  const row = await putDocument<Topic>({ type: TOPIC, title: `Topic ${++topics}`, name: `Topic ${topics}`, newCap: 10, archived: false, tallies: [], tags: [] });
  return row.id;
}

async function recall(topicId: string, itemId: string, slot: string, at: string, grade: Grade = "pass") {
  await putDocument<Recall>({ type: RECALL, title: "", languageId: topicId, itemId, slot, grade, at, tags: [] });
}

/** A Word the user has met reversed — eligible, unless its shape keeps it out. */
async function practised(topicId: string, term: string, meaning = `the meaning of ${term}`, at = daysAgo(3)): Promise<string> {
  const id = await addWord({ languageId: topicId, term, meaning });
  await recall(topicId, id, "reverse", at);
  return id;
}

const recallCount = async () => (await documentsOf(RECALL)).length;

describe("which Words a daily Wordle-like may draw", () => {
  it("only a Word of the Topic, not paused, whose reverse Prompt has a Recall, one word of 4–10 letters", async () => {
    const t = await topic();
    const other = await topic();
    const forwardOnly = await addWord({ languageId: t, term: "mesa", meaning: "table" });
    await recall(t, forwardOnly, "forward", daysAgo(2));
    await addWord({ languageId: t, term: "silla", meaning: "chair" }); // never met
    const paused = await practised(t, "cama");
    await setPaused(paused, true);
    await practised(other, "perro");
    await practised(t, "tener ganas"); // two words
    await practised(t, "sol"); // three letters
    await practised(t, "electricidad"); // twelve
    expect(await openDailyPuzzle(t, "wordle", { now: NOW })).toBeNull();

    await practised(t, "árbol", "tree", daysAgo(1)); // "arbol" after folding: five letters, failed or passed alike
    const p = await openDailyPuzzle(t, "wordle", { now: NOW });
    expect(p?.drawn.map((d) => [d.answer, d.clue])).toEqual([["árbol", "tree"]]);
  });

  it("an archived Topic has no Puzzle", async () => {
    const t = await topic();
    await practised(t, "gato");
    await setTopicArchived(t, true);
    expect(await openDailyPuzzle(t, "wordle", { now: NOW })).toBeNull();
    expect((await todaysPuzzles(NOW)).some((x) => x.topic.id === t)).toBe(false);
  });

  it("is drawn toward the Prompt due soonest", async () => {
    const t = await topic();
    const late = await addWord({ languageId: t, term: "lejos", meaning: "far" });
    await recall(t, late, "reverse", daysAgo(20));
    await recall(t, late, "reverse", daysAgo(10));
    await recall(t, late, "reverse", daysAgo(1)); // well held: due long after today
    await practised(t, "cerca", "near", daysAgo(5)); // met once, five days ago: due already
    const p = await openDailyPuzzle(t, "wordle", { now: NOW, random: () => 0 });
    expect(p?.drawn[0]?.answer).toBe("cerca");
  });

  it("shows a Sentence's translation beside the meaning when the Word is one of its blanks", async () => {
    const t = await topic();
    await practised(t, "ganas", "desire");
    await addSentence({ languageId: t, text: "Tengo {{Ganas}} de comer", translation: "I feel like eating" });
    const p = await openDailyPuzzle(t, "wordle", { now: NOW });
    expect(p?.drawn[0]).toMatchObject({ clue: "desire", hint: "I feel like eating" });
  });
});

describe("today's daily Wordle-like", () => {
  it("is fixed at first open: reopening returns it with its guesses, and Words added later change nothing", async () => {
    const t = await topic();
    await practised(t, "nube", "cloud");
    const first = (await openDailyPuzzle(t, "wordle", { now: NOW }))!;
    await guessPuzzle(first.id, "nada", NOW);
    await practised(t, "lluvia", "rain", daysAgo(9));
    const again = (await openDailyPuzzle(t, "wordle", { now: NOW }))!;
    expect(again.id).toBe(first.id);
    expect(again.drawn[0]?.answer).toBe("nube");
    expect(again.guesses).toEqual(["nada"]);
  });

  it("opened twice at once is still one Puzzle", async () => {
    const t = await topic();
    await practised(t, "luna");
    const [a, b] = await Promise.all([openDailyPuzzle(t, "wordle", { now: NOW }), openDailyPuzzle(t, "wordle", { now: NOW })]);
    expect(a!.id).toBe(b!.id);
  });

  it("colours each guess right place, wrong place, absent — a repeated letter only as often as the answer has it", async () => {
    const t = await topic();
    await practised(t, "casa");
    const p = (await openDailyPuzzle(t, "wordle", { now: NOW }))!;
    await guessPuzzle(p.id, "saca", NOW);
    const after = await guessPuzzle(p.id, "aaaa", NOW);
    expect(wordleRows(after).map((r) => r.map((c) => c.mark))).toEqual([
      ["present", "right", "present", "right"],
      ["absent", "right", "absent", "right"],
    ]);
  });

  it("accepts any guess of the right length, no dictionary, and refuses another length", async () => {
    const t = await topic();
    await practised(t, "pluma");
    const p = (await openDailyPuzzle(t, "wordle", { now: NOW }))!;
    await expect(guessPuzzle(p.id, "plum", NOW)).rejects.toThrow(/5 letters/);
    const after = await guessPuzzle(p.id, "xqzzk", NOW);
    expect(after.guesses).toEqual(["xqzzk"]);
    expect(after.outcome).toBe("playing");
  });

  it("matches without case or accents, ñ as n, and shows the stored spelling once solved", async () => {
    const t = await topic();
    await practised(t, "Niño");
    const p = (await openDailyPuzzle(t, "wordle", { now: NOW }))!;
    const solved = await guessPuzzle(p.id, "NINO", NOW);
    expect(solved.outcome).toBe("solved");
    expect(solved.finishedAt).not.toBe("");
    expect(wordleRows(solved)[0]!.map((c) => c.letter).join("")).toBe("Niño");
    await expect(guessPuzzle(p.id, "nino", NOW)).rejects.toThrow();
  });

  it("is unsolved after six wrong guesses, and takes no seventh", async () => {
    const t = await topic();
    await practised(t, "verde");
    const p = (await openDailyPuzzle(t, "wordle", { now: NOW }))!;
    let last = p;
    for (const g of ["rojos", "negro", "malva", "chico", "dulce"]) last = await guessPuzzle(p.id, g, NOW);
    expect(last.outcome).toBe("playing");
    last = await guessPuzzle(p.id, "verdi", NOW);
    expect(last.outcome).toBe("unsolved");
    await expect(guessPuzzle(p.id, "verde", NOW)).rejects.toThrow();
  });

  it("given up, it is unsolved and takes no more guesses", async () => {
    const t = await topic();
    await practised(t, "fuego");
    const p = (await openDailyPuzzle(t, "wordle", { now: NOW }))!;
    const gaveUp = await giveUpPuzzle(p.id, NOW);
    expect(gaveUp.outcome).toBe("unsolved");
    await expect(guessPuzzle(p.id, "fuego", NOW)).rejects.toThrow();
  });

  it("left unfinished past local midnight, it reads as unsolved and refuses guesses; the new day has its own", async () => {
    const t = await topic();
    await practised(t, "viento");
    const p = (await openDailyPuzzle(t, "wordle", { now: NOW }))!;
    await guessPuzzle(p.id, "vienes", NOW);
    expect((await getPuzzle(p.id, TOMORROW))!.outcome).toBe("unsolved");
    await expect(guessPuzzle(p.id, "viento", TOMORROW)).rejects.toThrow(/midnight/);
    const next = (await openDailyPuzzle(t, "wordle", { now: TOMORROW }))!;
    expect(next.id).not.toBe(p.id);
  });

  it("never writes a Recall, whatever happens", async () => {
    const t = await topic();
    await practised(t, "tierra");
    await practised(t, "piedra");
    const before = await recallCount();
    const p = (await openDailyPuzzle(t, "wordle", { now: NOW }))!;
    await guessPuzzle(p.id, "aaaaaa", NOW);
    await guessPuzzle(p.id, p.drawn[0]!.answer, NOW);
    const q = (await openDailyPuzzle(t, "wordle", { now: TOMORROW }))!;
    await giveUpPuzzle(q.id, TOMORROW);
    expect(await recallCount()).toBe(before);
  });

  it("stays readable once its Word is deleted", async () => {
    const t = await topic();
    const id = await practised(t, "jardín", "garden");
    const p = (await openDailyPuzzle(t, "wordle", { now: NOW }))!;
    await guessPuzzle(p.id, "jardin", NOW);
    await removeDocument(id);
    const read = (await getPuzzle(p.id, NOW))!;
    expect(read.outcome).toBe("solved");
    expect(read.drawn[0]).toMatchObject({ itemId: id, answer: "jardín", clue: "garden" });
    const listed = (await todaysPuzzles(NOW)).find((x) => x.topic.id === t);
    expect(listed?.puzzle?.id).toBe(p.id);
  });
});

describe("today's Puzzles", () => {
  it("lists each active Topic with something to draw, with today's Puzzle once opened", async () => {
    const t = await topic();
    const empty = await topic();
    await addWord({ languageId: empty, term: "nunca", meaning: "never" });
    await practised(t, "agua");
    const before = (await todaysPuzzles(NOW)).filter((x) => x.topic.id === t || x.topic.id === empty);
    expect(before.map((x) => [x.topic.id, x.format, x.puzzle])).toEqual([[t, "wordle", null]]);
    const p = (await openDailyPuzzle(t, "wordle", { now: NOW }))!;
    const after = (await todaysPuzzles(NOW)).find((x) => x.topic.id === t);
    expect(after?.puzzle?.id).toBe(p.id);
  });
});

describe("finishing a daily Puzzle is a Topic occurrence", () => {
  const tallied = async (tallies: { target: string; value: string; occurrence?: string }[]) => {
    const t = await topic();
    await putDocument({ ...(await getDocument<Topic>(t))!, tallies });
    return t;
  };
  const puzzleTally = { target: "habits/play", value: "one", occurrence: OCCURRENCE_PUZZLE };
  const practisedTally = { target: "habits/practise", value: "one" };
  const ids = () => logged.map((l) => l.id);

  it("solved, failed out or given up each log once to a puzzle Tally, never to a day-practised one", async () => {
    for (const finish of ["solve", "fail", "giveup"] as const) {
      logged.length = 0;
      const t = await tallied([puzzleTally, practisedTally]);
      await practised(t, "fuego");
      const p = (await openDailyPuzzle(t, "wordle", { now: NOW }))!;
      const mid = await guessPuzzle(p.id, "aaaaa", NOW);
      expect(ids()).toEqual([]);
      expect(mid.tallyError).toBeUndefined();
      if (finish === "solve") await guessPuzzle(p.id, "fuego", NOW);
      else if (finish === "giveup") await giveUpPuzzle(p.id, NOW);
      else for (let i = 0; i < 5; i++) await guessPuzzle(p.id, "aaaaa", NOW);
      expect(ids()).toEqual(["play"]);
    }
  });

  it("practising fires only the day-practised Tally", async () => {
    logged.length = 0;
    const t = await tallied([puzzleTally, practisedTally]);
    const w = await addWord({ languageId: t, term: "pared", meaning: "wall" });
    const item = { id: w, type: WORD, title: "pared", topicId: t };
    await recordRecall(item as never, "forward", "pass");
    expect(ids()).toEqual(["practise"]);
  });

  it("an expired Puzzle never tallies", async () => {
    logged.length = 0;
    const t = await tallied([puzzleTally]);
    await practised(t, "viento");
    const p = (await openDailyPuzzle(t, "wordle", { now: NOW }))!;
    await expect(giveUpPuzzle(p.id, TOMORROW)).rejects.toThrow();
    expect(ids()).toEqual([]);
  });

  it("a failing Tally keeps the outcome and reports the error", async () => {
    logged.length = 0;
    const t = await tallied([puzzleTally]);
    await practised(t, "ladrón");
    const p = (await openDailyPuzzle(t, "wordle", { now: NOW }))!;
    failLogs = true;
    const done = await giveUpPuzzle(p.id, NOW);
    failLogs = false;
    expect(done.outcome).toBe("unsolved");
    expect(done.tallyError).toMatch(/gone/);
    expect((await getPuzzle(p.id, NOW))!.outcome).toBe("unsolved");
  });

  it("a replay never tallies", async () => {
    logged.length = 0;
    const t = await tallied([puzzleTally]);
    await practised(t, "nube");
    const r = (await openReplayPuzzle(t, "wordle", { now: NOW }))!;
    await guessPuzzle(r.id, "nube", NOW);
    expect(ids()).toEqual([]);
  });
});

describe("replays", () => {
  it("each is a new Puzzle of kind replay, apart from today's daily", async () => {
    const t = await topic();
    await practised(t, "mesa");
    const daily = (await openDailyPuzzle(t, "wordle", { now: NOW }))!;
    const a = (await openReplayPuzzle(t, "wordle", { now: NOW }))!;
    const b = (await openReplayPuzzle(t, "wordle", { now: NOW }))!;
    expect(new Set([daily.id, a.id, b.id]).size).toBe(3);
    expect([a.kind, b.kind]).toEqual(["replay", "replay"]);
    expect((await openDailyPuzzle(t, "wordle", { now: NOW }))!.id).toBe(daily.id);
    expect((await todaysPuzzles(NOW)).find((x) => x.topic.id === t)?.puzzle?.id).toBe(daily.id);
  });

  it("avoids today's daily item where another is left, and draws it when it is the only one", async () => {
    const t = await topic();
    await practised(t, "mesa");
    await practised(t, "silla");
    const daily = (await openDailyPuzzle(t, "wordle", { now: NOW }))!;
    for (let i = 0; i < 5; i++) {
      const r = (await openReplayPuzzle(t, "wordle", { now: NOW, random: () => i / 5 }))!;
      expect(r.drawn[0]?.itemId).not.toBe(daily.drawn[0]?.itemId);
    }
    const solo = await topic();
    await practised(solo, "plato");
    await openDailyPuzzle(solo, "wordle", { now: NOW });
    expect((await openReplayPuzzle(solo, "wordle", { now: NOW }))?.drawn[0]?.answer).toBe("plato");
  });

  it("is null for a Topic with nothing to draw, or archived", async () => {
    const t = await topic();
    expect(await openReplayPuzzle(t, "wordle", { now: NOW })).toBeNull();
    await practised(t, "gato");
    await setTopicArchived(t, true);
    expect(await openReplayPuzzle(t, "wordle", { now: NOW })).toBeNull();
  });

  it("never writes a Recall, and finishes as a replay, distinguishable from a daily", async () => {
    const t = await topic();
    await practised(t, "nube");
    const before = await recallCount();
    const r = (await openReplayPuzzle(t, "wordle", { now: NOW }))!;
    const done = await guessPuzzle(r.id, "nube", NOW);
    expect(done).toMatchObject({ kind: "replay", outcome: "solved" });
    expect(await recallCount()).toBe(before);
  });

  it("is not ended by midnight as a daily is", async () => {
    const t = await topic();
    await practised(t, "nube");
    const r = (await openReplayPuzzle(t, "wordle", { now: NOW }))!;
    expect((await getPuzzle(r.id, TOMORROW))?.outcome).toBe("playing");
    expect((await guessPuzzle(r.id, "nube", TOMORROW)).outcome).toBe("solved");
  });
});
