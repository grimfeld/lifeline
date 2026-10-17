import type { RecallableDef } from "@lifeline/core";
import { knowledgeReadings } from "./domain/declarations";
import { FACT, SENTENCE, WORD } from "./domain/types";
import { FactFace, SentenceFace, WordFace } from "./components/faces";

/**
 * Knowledge's own types, declared through the Recallable Contract (ADR 0073)
 * like any other App's — Practice reads them only this way.
 */
export const knowledgeRecallable: RecallableDef[] = [
  { ...knowledgeReadings[WORD], face: WordFace },
  { ...knowledgeReadings[SENTENCE], face: SentenceFace },
  { ...knowledgeReadings[FACT], face: FactFace },
];
