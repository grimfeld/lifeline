import type { Document, RecallableDef } from "@lifeline/core";
import type { Material } from "./types";

/** Material with the Document it was read from — what a Practice shows a Prompt of. */
export interface MaterialDoc extends Material {
  doc: Document;
}

/** One Recallable Document read as Material, through its type's declaration (ADR 0073). */
export function materialOf(def: RecallableDef, doc: Document): MaterialDoc {
  return { id: doc.id, type: doc.type, title: doc.title, topicId: def.topicOf(doc), addedAt: def.addedAt(doc), live: def.inPractice(doc), slots: def.slots(doc), doc };
}
