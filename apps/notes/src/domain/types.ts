import type { Document } from "@lifeline/core";

/** Document types the Notes App owns (ADR 0019). */
export const DAILY = "daily";
export const TEMPLATE = "template";
/**
 * The Thoughts App's type (ADR 0068). What used to be a plain `note` is a
 * Thought now: the bare "make a page for this name" — an unresolved link, a
 * Folder's "+" — makes one, and the note-shaped Cards read it.
 */
export const THOUGHT = "thought";
export const NOTE_TYPES = [THOUGHT, DAILY, TEMPLATE] as const;

/** A note-shaped Document: body-first; fields (aliases) are flat on the row. */
export interface Note extends Document {
  body: string;
  aliases?: string[];
}

export const DAILY_TEMPLATE = "```daylog\n```\n\n### Histoire du jour\n\n---\n### Citation du jour\n\n---\n### Quoi de neuf ?\n\n---\n### Et maintenant ?\n\n";

/** Routes (the shell's Vault hosts both). */
export const journalHref = (date: string, today?: string) => (today && date === today ? "/vault/journal" : `/vault/journal?d=${date}`);
export const noteHref = (n: Pick<Document, "id" | "type" | "title">) => (n.type === DAILY ? `/vault/journal?d=${n.title}` : `/vault/d/${n.id}`);
