import type { Document } from "@lifeline/core";

/**
 * The Thought (CONTEXT.md, ADR 0068): something straight out of my head — an
 * idea, a feeling, a reflection, a question — with no Source, no day, no
 * Manuscript. The Thoughts App's one Document type.
 */
export const THOUGHT = "thought";

/** Where a new Thought lands (a home, never a rule). */
export const THOUGHTS_FOLDER = "Thoughts";

export const THOUGHT_KINDS = [
  { value: "idea", label: "Idea" },
  { value: "feeling", label: "Feeling" },
  { value: "reflection", label: "Reflection" },
  { value: "question", label: "Question" },
] as const;

export type ThoughtKind = (typeof THOUGHT_KINDS)[number]["value"];

export interface Thought extends Document {
  type: typeof THOUGHT;
  body: string;
  /** Optional: "" when not said. */
  kind?: ThoughtKind | "";
  aliases?: string[];
}

export const THOUGHTS_HREF = "/app/thoughts";
export const thoughtHref = (id: string) => `/app/thoughts/${id}`;

export function kindLabel(kind: string | undefined): string | undefined {
  return THOUGHT_KINDS.find((k) => k.value === kind)?.label;
}

export function isKind(v: unknown): v is ThoughtKind {
  return THOUGHT_KINDS.some((k) => k.value === v);
}
