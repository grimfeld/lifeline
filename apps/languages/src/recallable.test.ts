import { describe, expect, it } from "vitest";
import type { Document } from "@lifeline/core";
import { knowledgeReadings } from "./domain/declarations";
import { materialOf } from "./domain/material";
import { itemMaterial, promptsOf } from "./domain/prompts";
import { FACT, SENTENCE, WORD, type Item } from "./domain/types";

const base = { tags: [], folder: "", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "", deleted: 0 };
const word = { ...base, id: "w", type: WORD, title: "tener ganas de", languageId: "es", term: "tener ganas de", meaning: "to feel like", notes: "", origin: "", paused: false, addedAt: "2026-09-01T09:00:00.000Z" };
const fact = { ...base, id: "f", type: FACT, title: "When was Westphalia?", languageId: "hist", question: "When was Westphalia?", answer: "1648", notes: "", origin: "", originId: "n1", paused: false, addedAt: "2026-09-03T09:00:00.000Z" };
const sentence = { ...base, id: "s", type: SENTENCE, title: "Tengo ganas de comer", languageId: "es", text: "Tengo {{ganas}} de {{comer}}", translation: "", origin: "", paused: true, addedAt: "2026-09-02T09:00:00.000Z" };

const defOf = (type: string) => knowledgeReadings[type];
const plain = ({ doc: _doc, ...m }: ReturnType<typeof materialOf>) => m;

/**
 * Re-homing Languages as Knowledge (ADR 0073) must not move a single due date:
 * a Word or Sentence read through the Recallable Contract yields exactly the
 * Prompts it yielded before, so every Recall still lands on the same Prompt.
 */
describe("Word and Sentence through the Recallable Contract", () => {
  it.each([word, sentence, fact])("reads $type the same as Knowledge's own reading", (doc) => {
    const m = materialOf(defOf(doc.type), doc as unknown as Document);
    expect(plain(m)).toEqual(itemMaterial(doc as unknown as Item));
  });

  it("keeps the Prompt keys Recalls already point at", () => {
    expect(promptsOf(materialOf(defOf(WORD), word as unknown as Document)).map((p) => p.key)).toEqual(["w|forward", "w|reverse"]);
    expect(promptsOf(materialOf(defOf(SENTENCE), sentence as unknown as Document)).map((p) => p.key)).toEqual(["s|blank:ganas", "s|blank:comer"]);
  });

  it("gives a Fact one forward Prompt — its answer is no cue for its question", () => {
    expect(promptsOf(materialOf(defOf(FACT), fact as unknown as Document)).map((p) => p.key)).toEqual(["f|forward"]);
  });

  it("reads absent fields the way PocketBase returns them", () => {
    const bare = { ...base, id: "b", type: SENTENCE, title: "" } as unknown as Document;
    expect(plain(materialOf(defOf(SENTENCE), bare))).toEqual({ id: "b", type: SENTENCE, title: "", topicId: "", addedAt: base.createdAt, live: true, slots: [], originId: "" });
  });
});
