import type { Document } from "@lifeline/core";
import type { RecallableReading } from "./declarations";
import { FACT, SENTENCE, WORD, type Fact, type Material, type Sentence, type Word } from "./types";

/** Material with the Document it was read from — what a Practice shows a Prompt of. */
export interface MaterialDoc extends Material {
  doc: Document;
}

/** One Recallable Document read as Material, through its type's declaration (ADR 0073). */
export function materialOf(def: RecallableReading, doc: Document): MaterialDoc {
  return { id: doc.id, type: doc.type, title: doc.title, topicId: def.topicOf(doc), addedAt: def.addedAt(doc), live: def.inPractice(doc), slots: def.slots(doc), originId: def.originOf?.(doc) ?? "", doc };
}

/** Material whose doc is known by its type: the kinds the Knowledge App owns. Any other Recallable (a Quote) stays a plain MaterialDoc. */
export type TypedMaterial = MaterialDoc & ({ type: typeof WORD; doc: Word } | { type: typeof FACT; doc: Fact } | { type: typeof SENTENCE; doc: Sentence });

export const isTyped = (m: MaterialDoc): m is TypedMaterial => m.type === WORD || m.type === FACT || m.type === SENTENCE;
