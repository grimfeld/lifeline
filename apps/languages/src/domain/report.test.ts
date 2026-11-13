import { describe, expect, it } from "vitest";
import { practiceReport, topicReport, type ReportReads } from "./report";
import { retention } from "./practice";
import { itemMaterial } from "./prompts";
import type { MaterialDoc } from "./material";
import { DECK, FACT, RECALL, SENTENCE, TOPIC, WORD, type Deck, type Fact, type Grade, type Recall, type Sentence, type Topic, type Word } from "./types";

const at = (day: number, h = 9) => new Date(2026, 8, day, h).toISOString();
const now = new Date(at(28, 12));
const base = { tags: [], folder: "", createdAt: "", updatedAt: "", deleted: 0, languageId: "it", notes: "", origin: "", originId: "", paused: false, addedAt: at(1) };

const materialOfItem = (item: Word | Sentence | Fact): MaterialDoc => ({ ...itemMaterial(item), doc: item });
const word = (id: string, term: string, meaning: string, extra: Partial<Word> = {}) => materialOfItem({ ...base, id, type: WORD, title: term, term, meaning, ...extra } as Word);
const sentence = (id: string, text: string, extra: Partial<Sentence> = {}) => materialOfItem({ ...base, id, type: SENTENCE, title: id, text, translation: "", ...extra } as Sentence);
const fact = (id: string, question: string, answer: string) => materialOfItem({ ...base, id, type: FACT, title: question, question, answer } as Fact);

let n = 0;
const recall = (itemId: string, slot: string, grade: Grade, when: string, typed?: string): Recall =>
  ({ id: `r${n++}`, type: RECALL, title: "", tags: [], folder: "", createdAt: "", updatedAt: "", deleted: 0, languageId: "it", itemId, slot, grade, at: when, ...(typed === undefined ? {} : { typed }) }) as Recall;

const report = (items: ReturnType<typeof word>[], recalls: Recall[], newCap = 10) => practiceReport({ items, recalls, now, newCap });

describe("practiceReport", () => {
  it("reads Retention exactly as the app does, over the kept material's Recalls", () => {
    const items = [word("a", "stazione", "station")];
    const recalls = [recall("a", "forward", "fail", at(10)), recall("a", "forward", "pass", at(12)), recall("a", "forward", "fail", at(20))];
    expect(report(items, recalls).retention).toEqual(retention(recalls, now));
    expect(report(items, recalls).retention).toEqual({ passed: 1, total: 2, share: 0.5 });
  });

  it("counts what is due and what is new, and leaves drafts and paused material out of everything", () => {
    const items = [word("a", "stazione", "station"), word("p", "pausa", "pause", { paused: true }), word("d", "bozza", "draft", { draft: true })];
    const recalls = [recall("a", "forward", "pass", at(1)), recall("p", "forward", "fail", at(1)), recall("p", "forward", "fail", at(26)), recall("p", "forward", "fail", at(27))];
    const r = report(items, recalls);
    expect(r.dueToday).toBe(1);
    expect(r.newWaiting).toBe(1);
    expect(r.mostFailed).toEqual([]);
    expect(r.retention).toBeNull();
  });

  it("lists the Prompts failed most in the last 30 days, each with question, answer, slot and recent Recalls", () => {
    const items = [word("a", "stazione", "station"), sentence("s", "Vado {{alla|a}} stazione", { translation: "I go to the station" }), fact("f", "When?", "1648")];
    const recalls = [
      recall("a", "reverse", "fail", at(20)),
      recall("a", "reverse", "fail", at(21)),
      recall("a", "reverse", "pass", at(22)),
      recall("s", "blank:alla", "fail", at(23)),
      recall("f", "forward", "fail", at(24)),
      recall("f", "forward", "fail", at(25)),
      recall("f", "forward", "fail", at(26)),
      recall("a", "forward", "fail", new Date(2026, 6, 1).toISOString()),
    ];
    const r = report(items, recalls);
    expect(r.mostFailed.map((p) => [p.itemId, p.slot, p.fails])).toEqual([["f", "forward", 3], ["a", "reverse", 2], ["s", "blank:alla", 1]]);
    expect(r.mostFailed[0]).toMatchObject({ question: "When?", answer: "1648", recalls: [{ grade: "fail", at: at(26) }, { grade: "fail", at: at(25) }, { grade: "fail", at: at(24) }] });
    expect(r.mostFailed[1]).toMatchObject({ question: "station", answer: "stazione" });
    expect(r.mostFailed[2]).toMatchObject({ question: "Vado ____ (a) stazione", answer: "alla" });
  });

  it("lists only Prompts the item still yields: a rewritten blank or a removed clip leaves its fails behind", () => {
    const items = [sentence("s", "Vado {{alla}} stazione"), word("w", "treno", "train")];
    const recalls = [recall("s", "blank:a la", "fail", at(20)), recall("s", "blank:alla", "fail", at(21)), recall("w", "listen", "fail", at(22))];
    expect(report(items, recalls).mostFailed.map((p) => [p.itemId, p.slot])).toEqual([["s", "blank:alla"]]);
  });

  it("bounds the list and the Recalls shown with each", () => {
    const items = Array.from({ length: 15 }, (_, i) => word(`w${i}`, `t${i}`, `m${i}`));
    const recalls = items.flatMap((m) => Array.from({ length: 8 }, (_, k) => recall(m.id, "forward", "fail", at(10 + k))));
    const r = report(items, recalls);
    expect(r.mostFailed).toHaveLength(10);
    expect(r.mostFailed[0]!.recalls).toHaveLength(5);
  });

  it("shows what was typed on each Recall, and nothing where nothing was", () => {
    const items = [word("a", "stazione", "station")];
    const recalls = [recall("a", "reverse", "fail", at(20), "a la stazione"), recall("a", "reverse", "fail", at(21), ""), recall("a", "reverse", "pass", at(22))];
    const rs = report(items, recalls).mostFailed[0]!.recalls;
    expect(rs.map((r) => r.typed)).toEqual([undefined, undefined, "a la stazione"]);
  });

  it("lists the Leeches: 4 fails among the last 8 Recalls, with question and answer, never drafts or paused", () => {
    const items = [word("a", "stazione", "station"), word("p", "pausa", "pause", { paused: true }), word("d", "bozza", "draft", { draft: true })];
    const fails = (id: string) => [1, 2, 3, 4].map((k) => recall(id, "reverse", "fail", at(10 + k)));
    const r = report(items, [...fails("a"), ...fails("p"), ...fails("d"), recall("a", "forward", "fail", at(20))]);
    expect(r.leeches).toEqual([{ itemId: "a", type: WORD, slot: "reverse", question: "station", answer: "stazione", fails: 4 }]);
  });
});

describe("topicReport", () => {
  const doc = { tags: [], folder: "", createdAt: "", updatedAt: "", deleted: 0 };
  const topicDoc = (id: string, name: string): Topic => ({ ...doc, id, type: TOPIC, title: name, name, newCap: 10, archived: false }) as Topic;
  const deckDoc = (id: string, languageId: string, name: string, members: string[]): Deck => ({ ...doc, id, type: DECK, title: name, languageId, name, members }) as Deck;

  /** Reads over two Topics' data, noting which Topic each keyed read asked for. */
  function reads() {
    const asked: string[] = [];
    const recalls = [recall("a", "forward", "fail", at(20)), { ...recall("x", "forward", "fail", at(20)), languageId: "fr" }];
    const r: ReportReads = {
      topics: async () => [topicDoc("it", "Italian"), topicDoc("fr", "French")],
      decksOf: async (t) => (asked.push(`decks:${t}`), t === "it" ? [deckDoc("d1", "it", "Lesson 1", ["a"])] : []),
      practiceOf: async (t) => (asked.push(`practice:${t}`), { material: t === "it" ? [word("a", "stazione", "station")] : [{ ...word("x", "gare", "station"), topicId: "fr" }], recalls: recalls.filter((x) => x.languageId === t) }),
    };
    return { r, asked };
  }

  it("reads only the requested Topic's Decks, and its material with its Recalls once", async () => {
    const { r, asked } = reads();
    const out = await topicReport({ topic: " italian " }, r, now);
    expect(out.topic).toBe("Italian");
    expect(asked.sort()).toEqual(["decks:it", "practice:it"]);
    expect(out.mostFailed.map((p) => p.itemId)).toEqual(["a"]);
  });

  it("finds Decks by id or name, case ignored, and refuses what is not there, naming what is", async () => {
    const { r } = reads();
    expect((await topicReport({ topic: "it", decks: ["LESSON 1"] }, r, now)).decks).toEqual(["Lesson 1"]);
    await expect(topicReport({ topic: "Klingon" }, r, now)).rejects.toThrow(/No Topic “Klingon”.*Italian, French/);
    await expect(topicReport({ topic: "it", decks: ["Nope"] }, r, now)).rejects.toThrow(/No Deck “Nope”.*Lesson 1/);
  });
});
