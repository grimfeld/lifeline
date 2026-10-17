import type { Document, RecallableDef } from "@lifeline/core";
import { itemSlots } from "./domain/prompts";
import { SENTENCE, WORD, type Item, type Word } from "./domain/types";
import { SentenceFace, WordFace } from "./components/faces";

/** What every Word and Sentence reads the same way — PocketBase may hand back an absent field as "" or undefined. */
const shared = {
  topicOf: (d: Document) => String((d as Word).languageId ?? ""),
  inPractice: (d: Document) => !(d as Word).paused,
  addedAt: (d: Document) => (d as Word).addedAt || d.createdAt || "",
};

/**
 * Knowledge's own types, declared through the Recallable Contract (ADR 0073)
 * like any other App's — Practice reads them only this way.
 */
export const knowledgeRecallable: RecallableDef[] = [
  { typeId: WORD, slots: (d) => itemSlots(d as Item), ...shared, face: WordFace },
  { typeId: SENTENCE, slots: (d) => itemSlots(d as Item), ...shared, face: SentenceFace },
];
