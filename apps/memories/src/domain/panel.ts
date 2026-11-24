import { DAY_TYPE, EVENT_TYPE, type Document } from "@lifeline/core";
import type { Memory } from "./types";

/**
 * What the Memories panel lists for a Document (ADR 0137): an Event's Memories
 * (About it), a Day's Memories (dated that day; a Day's title is its date).
 * Any other Document gets none.
 */
export function panelMemories(doc: Document, memories: Memory[]): Memory[] {
  if (doc.type === EVENT_TYPE) return memories.filter((m) => m.about?.includes(doc.id));
  if (doc.type === DAY_TYPE) return memories.filter((m) => m.date === doc.title);
  return [];
}
