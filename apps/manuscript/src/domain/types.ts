import type { Document } from "@lifeline/core";

/**
 * The Manuscript App (ADR 0068): creative work written without distraction —
 * a **Manuscript** (a novel, a collection of poems) of ordered **Chapters**,
 * its outline and plan in its own body, its cut passages kept as
 * **Outtakes**. Versions of a Chapter are the Research App's Versions.
 */
export const MANUSCRIPT = "manuscript";
export const CHAPTER = "chapter";
export const OUTTAKE = "outtake";
export const MANUSCRIPTS_FOLDER = "Manuscripts";

export const STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "revised", label: "Revised" },
  { value: "done", label: "Done" },
] as const;
export type Status = (typeof STATUSES)[number]["value"];

export const FORMS = [
  { value: "novel", label: "Novel" },
  { value: "stories", label: "Stories" },
  { value: "poems", label: "Poems" },
  { value: "play", label: "Play" },
  { value: "other", label: "Other" },
] as const;

export interface Manuscript extends Document {
  type: typeof MANUSCRIPT;
  /** The outline and the plan. */
  body: string;
  status: Status;
  form: string;
}

export interface Chapter extends Document {
  type: typeof CHAPTER;
  body: string;
  manuscriptId: string;
  /** Order inside the Manuscript: ascending, gaps allowed. */
  position: number;
  status: Status;
}

/** A passage cut from a Chapter and kept with its Manuscript (CONTEXT.md "Outtake"). Internal. */
export interface Outtake extends Document {
  type: typeof OUTTAKE;
  body: string;
  manuscriptId: string;
  /** The Chapter it was cut from, or "". */
  chapterId: string;
  /** ISO instant. */
  cutAt: string;
}

export const SHELF_HREF = "/app/manuscripts";
export const manuscriptHref = (id: string, chapterId?: string) => `/app/manuscripts/m/${id}${chapterId ? `?c=${chapterId}` : ""}`;
