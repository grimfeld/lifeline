import { createDocument, documentsOf, todayStr } from "@lifeline/core";
import { MEMORIES_FOLDER, MEMORY, type Memory } from "../domain/types";

/** `title`, or numbered "title (2)", "(3)"… when a Memory in the folder already has it, case aside. */
function freeTitle(title: string, taken: readonly string[]): string {
  const lower = new Set(taken.map((t) => t.toLowerCase()));
  if (!lower.has(title.toLowerCase())) return title;
  for (let n = 2; ; n++) if (!lower.has(`${title} (${n})`.toLowerCase())) return `${title} (${n})`;
}

export interface MemoryInput {
  title: string;
  /** "YYYY-MM-DD"; today when not said. */
  date?: string;
  /** Ids of what it is about, of any Linkable type. */
  about?: readonly string[];
  /** Markdown: words, and photos embedded by name. */
  body?: string;
}

/**
 * Keep a Memory (ADR 0136): a title is all it takes, dated today, about
 * nothing, in Memories. A title another Memory there has is numbered, since
 * two birthdays are two Memories and keeping one must never fail for its name.
 */
export async function addMemory(input: MemoryInput): Promise<Memory> {
  const wanted = input.title.trim();
  if (!wanted) throw new Error("A Memory needs a title");
  const taken = (await documentsOf(MEMORY)).filter((m) => m.folder === MEMORIES_FOLDER).map((m) => m.title);
  const body = input.body?.trimEnd();
  return (await createDocument({
    type: MEMORY,
    title: freeTitle(wanted, taken),
    folder: MEMORIES_FOLDER,
    body: body ? body + "\n" : "",
    fields: { date: input.date || todayStr(), about: [...new Set(input.about ?? [])] },
  })) as Memory;
}
