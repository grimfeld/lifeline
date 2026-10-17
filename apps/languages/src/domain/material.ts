import type { Document } from "@lifeline/core";
import type { RecallableReading } from "./declarations";
import type { Material } from "./types";

/** Material with the Document it was read from — what a Practice shows a Prompt of. */
export interface MaterialDoc extends Material {
  doc: Document;
}

/** One Recallable Document read as Material, through its type's declaration (ADR 0073). */
export function materialOf(def: RecallableReading, doc: Document): MaterialDoc {
  return { id: doc.id, type: doc.type, title: doc.title, topicId: def.topicOf(doc), addedAt: def.addedAt(doc), live: def.inPractice(doc), slots: def.slots(doc), doc };
}
