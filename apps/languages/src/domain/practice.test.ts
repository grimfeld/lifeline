import { describe, expect, it } from "vitest";
import { dueAhead, dueAheadOfHeld, heldPrompts, introducedByTopic, introducedOn, practiceQueue, queueOfHeld, retention, spaceSiblings } from "./practice";
import { itemMaterial } from "./prompts";
import { RECALL, SENTENCE, WORD, type Grade, type Material, type Recall, type Sentence, type Word } from "./types";

/** Local wall-clock instants, so day boundaries are the test machine's own. */
const at = (day: number, h = 9, m = 0) => new Date(2026, 8, day, h, m).toISOString();

const word = (id: string, addedDay = 1): Material =>
  itemMaterial({ id, type: WORD, title: id, tags: [], folder: "", createdAt: "", updatedAt: "", deleted: 0, languageId: "es", term: id, meaning: "", notes: "", origin: "", originId: "", paused: false, addedAt: at(addedDay) } as Word);

const sentence = (id: string, text: string): Material =>
  itemMaterial({ id, type: SENTENCE, title: id, tags: [], folder: "", createdAt: "", updatedAt: "", deleted: 0, languageId: "es", text, translation: "", origin: "", originId: "", paused: false, addedAt: at(1) } as Sentence);

let n = 0;
const recall = (itemId: string, slot: string, grade: Grade, when: string): Recall =>
  ({ id: `r${n++}`, type: RECALL, title: "", tags: [], folder: "", createdAt: "", updatedAt: "", deleted: 0, languageId: "es", itemId, slot, grade, at: when }) as Recall;

describe("practiceQueue", () => {
  it("offers new Prompts up to the daily cap, oldest added first", () => {
    const items = [word("b", 2), word("a", 1), word("c", 3)];
    const q = practiceQueue(items, [], { now: new Date(at(10)), newCap: 3 });
    expect(q.newToday).toBe(3);
    expect(q.newWaiting).toBe(6);
    expect(q.queue.map((p) => p.key)).toEqual(["a|forward", "b|forward", "a|reverse", "c|forward", "b|reverse"].slice(0, 3));
  });

  it("counts today's introductions against the cap, across the whole Topic", () => {
    const items = [word("a"), word("b")];
    const recalls = [recall("a", "forward", "pass", at(10, 8)), recall("a", "reverse", "pass", at(10, 8, 1))];
    const q = practiceQueue(items, recalls, { now: new Date(at(10, 12)), newCap: 3 });
    expect(q.newToday).toBe(1);
  });

  it("puts due Prompts before new ones", () => {
    const items = [word("old", 1), word("fresh", 9)];
    const recalls = [recall("old", "forward", "pass", at(2)), recall("old", "reverse", "pass", at(2))];
    const q = practiceQueue(items, recalls, { now: new Date(at(28)), newCap: 10 });
    expect(q.due).toBe(2);
    expect(q.queue.slice(0, 2).every((p) => p.itemId === "old")).toBe(false); // spaced apart…
    expect(q.queue.filter((p) => p.itemId === "old")).toHaveLength(2); // …but both there
    expect(q.queue[0]?.itemId).toBe("old");
  });

  it("brings a failed Prompt back within the same sitting", () => {
    const items = [word("a")];
    const recalls = [recall("a", "forward", "fail", at(10, 9)), recall("a", "reverse", "pass", at(10, 9))];
    const q = practiceQueue(items, recalls, { now: new Date(at(10, 9, 1)), newCap: 0 });
    expect(q.queue.map((p) => p.key)).toContain("a|forward");
  });

  it("derives a Sentence's Prompts from its blanks", () => {
    const q = practiceQueue([sentence("s", "Tengo {{ganas}} de {{comer}}")], [], { now: new Date(at(10)), newCap: 10 });
    expect(q.queue.map((p) => p.slot).sort()).toEqual(["blank:comer", "blank:ganas"]);
  });
});

describe("queueOfHeld / dueAheadOfHeld", () => {
  it("narrowing the Topic's held Prompts to a Deck reads the same as replaying the Deck", () => {
    const items = [word("a", 1), word("b", 2), word("c", 3)];
    const recalls = [recall("a", "forward", "pass", at(2)), recall("a", "reverse", "fail", at(9)), recall("c", "forward", "pass", at(10, 8))];
    const now = new Date(at(10, 12));
    const held = heldPrompts(items, recalls);
    const introduced = introducedByTopic(recalls, "2026-09-10");
    const deck = new Set(["a", "c"]);
    const narrowed = queueOfHeld(held.filter((p) => deck.has(p.itemId)), introduced, { now, newCap: 2 });
    expect(narrowed).toEqual(practiceQueue(items.filter((i) => deck.has(i.id)), recalls, { now, newCap: 2 }));
    expect(dueAheadOfHeld(held, now)).toEqual(dueAhead(items, recalls, now));
  });
});

describe("practiceQueue across Topics", () => {
  const inTopic = (m: Material, topicId: string): Material => ({ ...m, topicId });
  const recallIn = (r: Recall, topicId: string): Recall => ({ ...r, languageId: topicId });

  it("holds each Topic to its own daily new cap", () => {
    const items = [inTopic(word("a1", 1), "A"), inTopic(word("a2", 2), "A"), inTopic(word("b1", 3), "B"), inTopic(word("b2", 4), "B")];
    const caps: Record<string, number> = { A: 1, B: 3 };
    const q = practiceQueue(items, [], { now: new Date(at(10)), newCap: (t) => caps[t] ?? 0 });
    const byTopic = (t: string) => q.queue.filter((p) => p.topicId === t).length;
    expect(byTopic("A")).toBe(1);
    expect(byTopic("B")).toBe(3);
    expect(q.newToday).toBe(4);
  });

  it("counts today's introductions against their own Topic only", () => {
    const items = [inTopic(word("a1", 1), "A"), inTopic(word("a2", 2), "A"), inTopic(word("b1", 3), "B")];
    const recalls = [recallIn(recall("a1", "forward", "pass", at(10, 8)), "A")];
    const q = practiceQueue(items, recalls, { now: new Date(at(10, 12)), newCap: () => 1 });
    expect(q.queue.filter((p) => p.topicId === "A" && p.held.state === "new")).toHaveLength(0);
    expect(q.queue.filter((p) => p.topicId === "B")).toHaveLength(1);
  });
});

describe("introducedOn", () => {
  it("counts a Prompt on the day of its first Recall only", () => {
    const recalls = [recall("a", "forward", "pass", at(9)), recall("a", "forward", "pass", at(10)), recall("b", "forward", "fail", at(10))];
    expect(introducedOn(recalls, "2026-09-10")).toBe(1);
  });
});

describe("spaceSiblings", () => {
  it("never puts two Prompts of one item back to back when it can avoid it", () => {
    const q = [{ itemId: "a" }, { itemId: "a" }, { itemId: "b" }, { itemId: "b" }];
    const out = spaceSiblings(q).map((p) => p.itemId);
    expect(out).toEqual(["a", "b", "a", "b"]);
  });

  it("keeps order when there is no choice", () => {
    expect(spaceSiblings([{ itemId: "a" }, { itemId: "a" }]).map((p) => p.itemId)).toEqual(["a", "a"]);
  });
});

describe("retention", () => {
  it("leaves out each Prompt's first Recall", () => {
    const recalls = [recall("a", "forward", "fail", at(10)), recall("a", "forward", "pass", at(12)), recall("a", "forward", "fail", at(20))];
    expect(retention(recalls, new Date(at(25)))).toEqual({ passed: 1, total: 2, share: 0.5 });
  });

  it("reads nothing when there is nothing to read", () => {
    expect(retention([recall("a", "forward", "pass", at(10))], new Date(at(25)))).toBeNull();
  });
});

describe("dueAhead", () => {
  it("counts overdue into today and ignores new Prompts", () => {
    const items = [word("a"), word("b")];
    const recalls = [recall("a", "forward", "pass", at(1)), recall("a", "reverse", "pass", at(1))];
    const week = dueAhead(items, recalls, new Date(at(28)));
    expect(week).toHaveLength(7);
    expect(week[0]).toEqual({ day: "2026-09-28", count: 2 });
    expect(week.slice(1).every((d) => d.count === 0)).toBe(true);
  });
});
