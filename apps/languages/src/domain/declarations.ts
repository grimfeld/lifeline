import type { Document, RecallableDef } from "@lifeline/core";
import { itemSlots } from "./prompts";
import { FACT, SENTENCE, WORD, type Item, type Word } from "./types";

/** A Recallable declaration without its face — everything that decides which Prompts exist. */
export type RecallableReading = Omit<RecallableDef, "face">;

/** What every Word, Sentence and Fact reads the same way — PocketBase may hand back an absent field as "" or undefined. */
const shared = {
  slots: (d: Document) => itemSlots(d as Item),
  topicOf: (d: Document) => String((d as Word).languageId ?? ""),
  inPractice: (d: Document) => !(d as Word).paused,
  addedAt: (d: Document) => (d as Word).addedAt || d.createdAt || "",
};

/** How Knowledge's own types are read through the Recallable Contract (ADR 0073), faces aside. */
export const knowledgeReadings: Record<string, RecallableReading> = {
  [WORD]: { typeId: WORD, ...shared },
  [SENTENCE]: { typeId: SENTENCE, ...shared },
  [FACT]: { typeId: FACT, ...shared },
};
