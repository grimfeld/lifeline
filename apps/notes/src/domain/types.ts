import type { Document } from "@lifeline/core";

/** Document types the Notes App owns (ADR 0019). */
export const NOTE = "note";
export const DAILY = "daily";
export const TEMPLATE = "template";
export const NOTE_TYPES = [NOTE, DAILY, TEMPLATE] as const;

/** A Note-shaped Document: body-first; fields (aliases) are flat on the row. */
export interface Note extends Document {
  body: string;
  aliases?: string[];
}

export const DAILY_TEMPLATE = "```daylog\n```\n\n### Histoire du jour\n\n---\n### Citation du jour\n\n---\n### Quoi de neuf ?\n\n---\n### Et maintenant ?\n\n";

/** Routes (the shell's Vault hosts both). */
export const journalHref = (date: string, today?: string) => (today && date === today ? "/vault/journal" : `/vault/journal?d=${date}`);
export const noteHref = (n: Pick<Document, "id" | "type" | "title">) => (n.type === DAILY ? `/vault/journal?d=${n.title}` : `/vault/d/${n.id}`);
