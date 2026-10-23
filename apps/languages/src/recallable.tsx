import type { RecallableDef } from "@lifeline/core";
import { knowledgeReadings, type RecallableReading } from "./domain/declarations";
import { FACT, SENTENCE, WORD } from "./domain/types";
import { FactFace, SentenceFace, WordFace } from "./components/faces";

/**
 * Knowledge's own types, declared through the Recallable Contract (ADR 0073)
 * like any other App's — Practice reads them only this way.
 */
export const knowledgeRecallable: RecallableDef[] = [
  { ...reading(WORD), face: WordFace },
  { ...reading(SENTENCE), face: SentenceFace },
  { ...reading(FACT), face: FactFace },
];

function reading(typeId: string): RecallableReading {
  const r = knowledgeReadings[typeId];
  if (!r) throw new Error(`No Recallable reading for ${typeId}`);
  return r;
}
