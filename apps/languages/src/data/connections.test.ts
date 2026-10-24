import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { documentsOf, getDocument, initApps, putDocument, removeDocument, type DocumentTypeDef } from "@lifeline/core";
import { DECK, FACT, OCCURRENCE_PRACTISED, OCCURRENCE_PUZZLE, PUZZLE, RECALL, SENTENCE, TOPIC, WORD, type Deck, type Puzzle, type Recall, type Topic } from "../domain/types";
import { addFact, addWord, setPaused } from "./repo";
import { connectionsState } from "../domain/connections";
import { getPuzzle, giveUpPuzzle, guessPuzzle, openDailyPuzzle, openReplayPuzzle, todaysPuzzles } from "./puzzles";

// The Knowledge types, bare: the App manifest pulls in screens that need a DOM.
const bare = (id: string) => ({ id, label: id, titleRule: "name", body: "optional", fields: [], indexes: ["languageId", "itemId"], builtIn: true }) as unknown as DocumentTypeDef;
const logged: string[] = [];
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
      async log(id: string) {
        logged.push(id);
      },
    },
  },
] as never);

/** Mid-morning, local: every test plays "today" at this hour. */
const NOW = new Date(2026, 9, 24, 10, 0);
const daysAgo = (n: number) => new Date(2026, 9, 24 - n, 9, 0).toISOString();

let topics = 0;
async function topic(): Promise<string> {
  const row = await putDocument<Topic>({ type: TOPIC, title: `Topic ${++topics}`, name: `Topic ${topics}`, newCap: 10, archived: false, tallies: [], tags: [] });
  return row.id;
}

async function recall(topicId: string, itemId: string, slot: string, at = daysAgo(3)) {
  await putDocument<Recall>({ type: RECALL, title: "", languageId: topicId, itemId, slot, grade: "pass", at, tags: [] });
}

/** A Word met at least once, either way round. */
async function word(topicId: string, term: string, slot = "forward"): Promise<string> {
  const id = await addWord({ languageId: topicId, term, meaning: `the meaning of ${term}` });
  await recall(topicId, id, slot);
  return id;
}

async function deck(topicId: string, name: string, members: string[]): Promise<string> {
  const row = await putDocument<Deck>({ type: DECK, title: name, name, languageId: topicId, members, folder: "", tags: [] });
  return row.id;
}

/** A Deck of `n` practised Words, named after it. */
async function deckOf(topicId: string, name: string, n = 4): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < n; i++) ids.push(await word(topicId, `${name}${i}`));
  await deck(topicId, name, ids);
  return ids;
}

describe("a daily Connections", () => {
  it("draws 16 items, 4 from each of 4 of the Topic's Decks, each under its Deck's name", async () => {
    const t = await topic();
    for (const name of ["kitchen", "garden", "office", "beach"]) await deckOf(t, name);
    const p = await openDailyPuzzle(t, "connections", { now: NOW });
    expect(p?.format).toBe("connections");
    expect(p?.drawn).toHaveLength(16);
    const byDeck = new Map<string, string[]>();
    for (const d of p!.drawn) byDeck.set(d.deck ?? "", [...(byDeck.get(d.deck ?? "") ?? []), d.answer]);
    expect([...byDeck.keys()].sort()).toEqual(["beach", "garden", "kitchen", "office"]);
    for (const [name, answers] of byDeck) expect(answers.sort()).toEqual([0, 1, 2, 3].map((i) => `${name}${i}`));
  });
});

/** The item ids of each Deck's group, by Deck name. */
const groups = (p: Puzzle) => {
  const out = new Map<string, string[]>();
  for (const d of p.drawn) out.set(d.deck ?? "", [...(out.get(d.deck ?? "") ?? []), d.itemId]);
  return out;
};

/** Four items from four different groups. */
const mixed = (p: Puzzle, shift = 0) => [...groups(p).values()].map((ids, g) => ids[(g + shift) % 4]!);

async function fourDecks(): Promise<{ t: string; p: Puzzle }> {
  const t = await topic();
  for (const name of ["red", "blue", "green", "gold"]) await deckOf(t, `${name}${t}`);
  return { t, p: (await openDailyPuzzle(t, "connections", { now: NOW }))! };
}

describe("playing a Connections", () => {
  it("reveals a right group of four under its Deck's name; a wrong one is a mistake", async () => {
    const { t, p } = await fourDecks();
    const red = groups(p).get(`red${t}`)!;
    const after = await guessPuzzle(p.id, red, NOW);
    const state = connectionsState(after);
    expect(state.found.map((g) => [g.deck, g.items.map((d) => d.itemId).sort()])).toEqual([[`red${t}`, [...red].sort()]]);
    expect(state.left).toHaveLength(12);
    const [blue, green, gold] = [`blue${t}`, `green${t}`, `gold${t}`].map((n) => groups(p).get(n)!);
    const wrong = connectionsState(await guessPuzzle(p.id, [blue![0]!, blue![1]!, green![0]!, gold![0]!], NOW));
    expect(wrong.mistakes).toBe(1);
    expect(wrong.found).toHaveLength(1);
  });

  it("refuses a group that is not four of the items left, or four already tried, without counting it", async () => {
    const { t, p } = await fourDecks();
    const red = groups(p).get(`red${t}`)!;
    await expect(guessPuzzle(p.id, red.slice(0, 3), NOW)).rejects.toThrow(/4/);
    await guessPuzzle(p.id, red, NOW);
    await expect(guessPuzzle(p.id, red, NOW)).rejects.toThrow();
    const [blue, green, gold] = [`blue${t}`, `green${t}`, `gold${t}`].map((n) => groups(p).get(n)!);
    const wrong = [blue![0]!, blue![1]!, green![0]!, gold![0]!];
    await guessPuzzle(p.id, wrong, NOW);
    await expect(guessPuzzle(p.id, [...wrong].reverse(), NOW)).rejects.toThrow(/already/);
    expect(connectionsState((await getPuzzle(p.id, NOW))!).mistakes).toBe(1);
  });

  it("is solved once every group is found", async () => {
    const { p } = await fourDecks();
    let last = p;
    for (const ids of groups(p).values()) last = await guessPuzzle(p.id, ids, NOW);
    expect(last.outcome).toBe("solved");
    expect(last.finishedAt).not.toBe("");
  });

  it("is unsolved on the fourth mistake, and takes no more groups", async () => {
    const { p } = await fourDecks();
    let last = p;
    for (let i = 0; i < 3; i++) last = await guessPuzzle(p.id, mixed(p, i), NOW);
    expect(last.outcome).toBe("playing");
    last = await guessPuzzle(p.id, mixed(p, 3), NOW);
    expect(last.outcome).toBe("unsolved");
    await expect(guessPuzzle(p.id, [...groups(p).values()][0]!, NOW)).rejects.toThrow();
    expect(connectionsState(last).groups).toHaveLength(4);
  });

  it("replays as a new Connections each time, drawn from the same Decks", async () => {
    const { t, p } = await fourDecks();
    const r = (await openReplayPuzzle(t, "connections", { now: NOW }))!;
    expect(r.kind).toBe("replay");
    expect(r.id).not.toBe(p.id);
    expect(r.drawn).toHaveLength(16);
    expect(new Set(r.drawn.map((d) => d.deck))).toEqual(new Set(p.drawn.map((d) => d.deck)));
  });

  it("given up, it is unsolved; left past midnight, it reads unsolved and refuses groups", async () => {
    const { p } = await fourDecks();
    expect((await giveUpPuzzle(p.id, NOW)).outcome).toBe("unsolved");
    const { p: q } = await fourDecks();
    await guessPuzzle(q.id, mixed(q), NOW);
    const TOMORROW = new Date(2026, 9, 25, 0, 5);
    expect((await getPuzzle(q.id, TOMORROW))!.outcome).toBe("unsolved");
    await expect(guessPuzzle(q.id, [...groups(q).values()][0]!, TOMORROW)).rejects.toThrow(/midnight/);
  });

  it("is fixed at first open, and never writes a Recall", async () => {
    const before = (await documentsOf(RECALL)).length;
    const { t, p } = await fourDecks();
    const atStart = (await documentsOf(RECALL)).length;
    await deckOf(t, "late");
    const again = (await openDailyPuzzle(t, "connections", { now: NOW }))!;
    expect(again.id).toBe(p.id);
    for (const ids of groups(p).values()) await guessPuzzle(p.id, ids, NOW);
    expect((await documentsOf(RECALL)).length).toBe(atStart + 4); // only the new Deck's own Words' Recalls
    expect(atStart).toBe(before + 16);
  });
});

describe("what a Connections may draw", () => {
  it("declines with fewer than 4 Decks of at least 4 eligible items, and is not listed today", async () => {
    const t = await topic();
    for (const name of ["one", "two", "three"]) await deckOf(t, name);
    await deckOf(t, "short", 3);
    expect(await openDailyPuzzle(t, "connections", { now: NOW })).toBeNull();
    expect((await todaysPuzzles(NOW)).some((x) => x.topic.id === t && x.format === "connections")).toBe(false);

    // Unpractised, paused and other-Topic items don't count toward a fourth Deck.
    const unmet = await addWord({ languageId: t, term: "unmet", meaning: "never practised" });
    const paused = await word(t, "paused");
    await setPaused(paused, true);
    const other = await topic();
    const elsewhere = await word(other, "elsewhere");
    await deck(t, "almost", [...(await Promise.all(["a1", "a2", "a3"].map((x) => word(t, x)))), unmet, paused, elsewhere]);
    expect(await openDailyPuzzle(t, "connections", { now: NOW })).toBeNull();

    await deckOf(t, "four");
    expect((await todaysPuzzles(NOW)).some((x) => x.topic.id === t && x.format === "connections")).toBe(true);
    expect(await openDailyPuzzle(t, "connections", { now: NOW })).not.toBeNull();
  });

  it("draws Fact answers as well as Word terms, met on any Prompt", async () => {
    const t = await topic();
    for (const name of ["w1", "w2", "w3"]) await deckOf(t, name);
    const facts: string[] = [];
    for (const year of ["1648", "1789", "1815", "1914"]) {
      const id = await addFact({ languageId: t, question: `What happened in ${year}?`, answer: year });
      await recall(t, id, "forward");
      facts.push(id);
    }
    await deck(t, "years", facts);
    const p = (await openDailyPuzzle(t, "connections", { now: NOW }))!;
    expect(p.drawn.filter((d) => d.deck === "years").map((d) => [d.answer, d.clue]).sort()).toEqual([
      ["1648", "What happened in 1648?"],
      ["1789", "What happened in 1789?"],
      ["1815", "What happened in 1815?"],
      ["1914", "What happened in 1914?"],
    ]);
  });

  it("leaves out an item shared between two chosen Decks, or one that reads the same as another Deck's", async () => {
    const t = await topic();
    const a = await deckOf(t, "a", 6);
    const b = await deckOf(t, "b", 4);
    await deckOf(t, "c");
    await deckOf(t, "d");
    const shared = a[5]!;
    // b holds the shared item, and a Word reading like one of a's ("A0" folds to "a0").
    const lookalike = await word(t, "Á0");
    const decks = await documentsOf<Deck>(DECK);
    const bDeck = decks.find((d) => d.languageId === t && d.name === "b")!;
    await putDocument<Deck>({ ...bDeck, members: [...b, shared, lookalike] });
    const p = (await openDailyPuzzle(t, "connections", { now: NOW }))!;
    const ids = p.drawn.map((d) => d.itemId);
    expect(ids).not.toContain(shared);
    expect(ids).not.toContain(lookalike);
    expect(ids).not.toContain(a[0]);
    expect(new Set(ids).size).toBe(16);
  });

  it("declines when leaving shared items out leaves a Deck short", async () => {
    const t = await topic();
    const a = await deckOf(t, "a");
    await deckOf(t, "b");
    await deckOf(t, "c");
    await deck(t, "d", [...a.slice(0, 2), ...(await Promise.all(["d1", "d2", "d3"].map((x) => word(t, x))))]);
    expect(await openDailyPuzzle(t, "connections", { now: NOW })).toBeNull();
  });

  it("keeps each group as drawn after its Deck is renamed, emptied or deleted, and its Words deleted", async () => {
    const { t, p } = await fourDecks();
    for (const d of (await documentsOf<Deck>(DECK)).filter((d) => d.languageId === t)) await removeDocument(d.id);
    for (const d of p.drawn.slice(0, 4)) await removeDocument(d.itemId);
    const read = (await getPuzzle(p.id, NOW))!;
    expect(read.drawn).toEqual(p.drawn);
    const red = groups(read).get(`red${t}`)!;
    const after = await guessPuzzle(p.id, red, NOW);
    expect(connectionsState(after).found.map((g) => g.deck)).toEqual([`red${t}`]);
  });
});

describe("finishing a daily Connections is a Topic occurrence", () => {
  const tallies = [
    { target: "habits/play", value: "one", occurrence: OCCURRENCE_PUZZLE },
    { target: "habits/practise", value: "one" },
  ];

  it("solved, four mistakes or given up each log once to a puzzle Tally, never to a day-practised one", async () => {
    for (const finish of ["solve", "fail", "giveup"] as const) {
      logged.length = 0;
      const { t, p } = await fourDecks();
      await putDocument({ ...(await getDocument<Topic>(t))!, tallies });
      const mid = await guessPuzzle(p.id, mixed(p, 0), NOW);
      expect(mid.tallyError).toBeUndefined();
      expect(logged).toEqual([]);
      if (finish === "solve") for (const ids of groups(p).values()) await guessPuzzle(p.id, ids, NOW);
      else if (finish === "giveup") await giveUpPuzzle(p.id, NOW);
      else for (let i = 1; i < 4; i++) await guessPuzzle(p.id, mixed(p, i), NOW);
      expect((await getPuzzle(p.id, NOW))!.outcome).toBe(finish === "solve" ? "solved" : "unsolved");
      expect(logged).toEqual(["play"]);
    }
  });

  it("a replay never tallies", async () => {
    logged.length = 0;
    const { t } = await fourDecks();
    await putDocument({ ...(await getDocument<Topic>(t))!, tallies });
    const r = (await openReplayPuzzle(t, "connections", { now: NOW }))!;
    for (const ids of groups(r).values()) await guessPuzzle(r.id, ids, NOW);
    expect((await getPuzzle(r.id, NOW))!.outcome).toBe("solved");
    expect(logged).toEqual([]);
  });
});
