import { describe, expect, it } from "vitest";
import { leeches } from "./leech";
import { itemMaterial } from "./prompts";
import { RECALL, WORD, type Grade, type Recall, type Word } from "./types";

const at = (day: number, h = 9) => new Date(2026, 8, day, h).toISOString();
const base = { tags: [], folder: "", createdAt: "", updatedAt: "", deleted: 0, languageId: "it", notes: "", origin: "", originId: "", paused: false, addedAt: at(1) };
const word = (id: string, extra: Partial<Word> = {}) => {
  const w = { ...base, id, type: WORD, title: id, term: id, meaning: `m-${id}`, ...extra } as Word;
  return { ...itemMaterial(w), doc: w };
};
let n = 0;
const recall = (itemId: string, grade: Grade, day: number, slot = "forward", extra: Partial<Recall> = {}): Recall =>
  ({ id: `r${n++}`, type: RECALL, title: "", tags: [], folder: "", createdAt: "", updatedAt: "", deleted: 0, languageId: "it", itemId, slot, grade, at: at(day), ...extra }) as Recall;
const run = (grades: Grade[], slot = "forward", itemId = "a") => grades.map((g, i) => recall(itemId, g, i + 1, slot));

describe("leeches", () => {
  it("is a Prompt with 4 fails among its last 8 Recalls", () => {
    expect(leeches([word("a")], run(["fail", "fail", "fail", "pass", "pass", "pass", "pass", "pass"]))).toEqual([]);
    expect(leeches([word("a")], run(["fail", "fail", "fail", "fail", "pass", "pass", "pass", "pass"])).map((l) => [l.itemId, l.slot, l.fails])).toEqual([["a", "forward", 4]]);
  });

  it("reads only the last 8: old fails fall out of the window", () => {
    expect(leeches([word("a")], run(["fail", "fail", "fail", "fail", "pass", "pass", "pass", "pass", "pass", "pass"]))).toEqual([]);
  });

  it("stops being one once the recent Recalls pass", () => {
    const fails = run(["fail", "fail", "fail", "fail"]);
    expect(leeches([word("a")], fails)).toHaveLength(1);
    const after = [...fails, recall("a", "pass", 5), recall("a", "pass", 6), recall("a", "pass", 7), recall("a", "pass", 8), recall("a", "pass", 9)];
    expect(leeches([word("a")], after)).toEqual([]);
  });

  it("ignores struck-out Recalls", () => {
    const rs = [...run(["fail", "fail", "fail"]), recall("a", "fail", 4, "forward", { deleted: 1 })];
    expect(leeches([word("a")], rs)).toEqual([]);
  });

  it("never lists drafts or paused material", () => {
    const rs = [...run(["fail", "fail", "fail", "fail"], "forward", "d"), ...run(["fail", "fail", "fail", "fail"], "forward", "p")];
    expect(leeches([word("d", { draft: true }), word("p", { paused: true })], rs)).toEqual([]);
  });

  it("counts each Prompt on its own, most fails first", () => {
    const rs = [...run(["fail", "fail", "fail", "fail"], "forward"), ...run(["fail", "fail", "fail", "fail", "fail"], "reverse")];
    expect(leeches([word("a")], rs).map((l) => [l.slot, l.fails])).toEqual([["reverse", 5], ["forward", 4]]);
  });
});
