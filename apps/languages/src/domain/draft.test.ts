import { describe, expect, it } from "vitest";
import { accepted, acceptAllReady, inPractice, isDraft } from "./draft";
import { practiceQueue, retention } from "./practice";
import { itemMaterial } from "./prompts";
import { RECALL, WORD, type Recall, type Word } from "./types";

const at = (day: number, h = 9) => new Date(2026, 8, day, h).toISOString();

const word = (id: string, addedDay: number, extra: Partial<Word> = {}): Word =>
  ({ id, type: WORD, title: id, tags: [], folder: "", createdAt: "", updatedAt: "", deleted: 0, languageId: "es", term: id, meaning: "m", notes: "", origin: "", originId: "", paused: false, addedAt: at(addedDay), ...extra }) as Word;

describe("a draft", () => {
  it("is out of practice like paused material, and an accepted or ordinary item is in", () => {
    expect(itemMaterial(word("d", 1, { draft: true })).live).toBe(false);
    expect(itemMaterial(word("p", 1, { paused: true })).live).toBe(false);
    expect(itemMaterial(word("a", 1)).live).toBe(true);
    expect(itemMaterial(word("a", 1, { draft: false })).live).toBe(true);
    expect(inPractice(word("d", 1, { draft: true }))).toBe(false);
    expect(isDraft(word("a", 1))).toBe(false);
  });

  it("is never queued, and no Prompt of it is counted new", () => {
    const items = [word("draft", 1, { draft: true }), word("own", 2)].map(itemMaterial).filter((m) => m.live);
    const q = practiceQueue(items, [], { now: new Date(at(10)), newCap: 10 });
    expect(q.queue.every((p) => p.itemId === "own")).toBe(true);
    expect(q.newWaiting).toBe(2);
  });

  it("enters practice as new from acceptance: added then, so it queues after older new material and counts that day", () => {
    const older = word("older", 3);
    const draft = word("draft", 1, { draft: true, origin: "Agent draft" });
    const acc = accepted(draft, at(9, 12));
    expect(acc.draft).toBe(false);
    expect(acc.addedAt).toBe(at(9, 12));
    expect(acc.origin).toBe("Agent draft");
    const q = practiceQueue([older, acc].map(itemMaterial), [], { now: new Date(at(10)), newCap: 2 });
    expect(q.queue.map((p) => p.key)).toEqual(["older|forward", "older|reverse"]);
    // Introduced on the acceptance day, it counts against that day's cap.
    const recall = (itemId: string, slot: string, when: string) => ({ id: itemId + slot, type: RECALL, languageId: "es", itemId, slot, grade: "pass", at: when }) as Recall;
    const q2 = practiceQueue([acc].map(itemMaterial), [recall("draft", "forward", at(9, 13))], { now: new Date(at(9, 14)), newCap: 1 });
    expect(q2.newToday).toBe(0);
  });

  it("does not skew Retention: it has no Recalls", () => {
    expect(retention([], new Date(at(10)))).toBeNull();
  });
});

describe("accepting a whole Deck", () => {
  const drafts = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("is unavailable until every draft has been shown", () => {
    expect(acceptAllReady(drafts, new Set())).toBe(false);
    expect(acceptAllReady(drafts, new Set(["a", "b"]))).toBe(false);
    expect(acceptAllReady(drafts, new Set(["a", "b", "c"]))).toBe(true);
  });

  it("asks only about the drafts left: a deleted or accepted one needs no showing, and no draft left is nothing to accept", () => {
    expect(acceptAllReady(drafts.slice(1), new Set(["b", "c"]))).toBe(true);
    expect(acceptAllReady([], new Set(["a"]))).toBe(false);
  });
});
