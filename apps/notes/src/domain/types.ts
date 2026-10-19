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

/** A note-shaped Document: body-first; fields (aliases) are flat on the row. */
export interface Note extends Document {
  body: string;
  aliases?: string[];
}

export const DAILY_TEMPLATE = "```daylog\n```\n\n### Histoire du jour\n\n---\n### Citation du jour\n\n---\n### Quoi de neuf ?\n\n---\n### Et maintenant ?\n\n";

/** The Journal's review stretches (CONTEXT.md "Week, Month, Quarter, Year"): one type each, titled by the stretch. */
export const WEEK = "week";
export const MONTH = "month";
export const QUARTER = "quarter";
export const YEAR = "year";
export const PERIOD_TYPES = [WEEK, MONTH, QUARTER, YEAR] as const;

/** The note-shaped types the Journal App reads together: Thoughts, Days, the review stretches and Templates. */
export const NOTE_TYPES = [THOUGHT, DAILY, ...PERIOD_TYPES, TEMPLATE] as const;

const review = (span: string, next: string) => `## How the ${span} went\n\n## What mattered\n\n## What I learned\n\n## ${next}\n\n`;
export const PERIOD_TEMPLATES: Record<(typeof PERIOD_TYPES)[number], string> = {
  week: review("week", "Next week"),
  month: review("month", "Next month"),
  quarter: review("quarter", "Next quarter"),
  year: review("year", "The year ahead"),
};

/** Routes: the Journal is its own Module now (ADR 0068); the Vault is only the raw editor. */
export const JOURNAL_HREF = "/app/journal";
export const journalHref = (date: string, today?: string) => (today && date === today ? JOURNAL_HREF : `${JOURNAL_HREF}?d=${date}`);
export const periodHref = (key: string) => `${JOURNAL_HREF}/p/${key}`;
export const noteHref = (n: Pick<Document, "id" | "type" | "title">) =>
  n.type === DAILY ? journalHref(n.title) : (PERIOD_TYPES as readonly string[]).includes(n.type) ? periodHref(n.title) : `/vault/d/${n.id}`;
