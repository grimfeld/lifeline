import type { Document } from "@lifeline/core";

/**
 * The Memory (CONTEXT.md, ADR 0136): a moment worth keeping — a title, a date
 * of its own, words and photos (Attachments embedded by name, ADR 0037), and
 * About: links to what it remembers, any Linkable Document, or nothing. The
 * Memories App's one Document type.
 */
export const MEMORY = "memories_memory";

/** Where a new Memory lands (a home, never a rule). */
export const MEMORIES_FOLDER = "Memories";

export interface Memory extends Document {
  type: typeof MEMORY;
  body: string;
  /** "YYYY-MM-DD": the day it is a memory of, its own, not the day it was written. */
  date: string;
  /** Ids of the Documents it is about, of any Linkable type. */
  about: string[];
}

/** A Memory's own page, under the Journal (ADR 0136). */
export const memoryHref = (id: string) => `/app/journal/memories/${id}`;
