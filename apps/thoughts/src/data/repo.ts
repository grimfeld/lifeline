import { createDocument, documentsOf, normalizeTags, useDocuments } from "@lifeline/core";
import { freeTitle, titleFromText } from "../domain/stream";
import { THOUGHT, THOUGHTS_FOLDER, type Thought, type ThoughtKind } from "../domain/types";

export function useThoughts(): Thought[] {
  return useDocuments<Thought>(THOUGHT);
}

/**
 * Keep a Thought: the text as its body, its first line as its title unless
 * one is given — numbered when a Thought of that name already sits in the
 * folder, since capture must never fail for a repeated first line.
 */
export async function captureThought(input: { text: string; title?: string; kind?: ThoughtKind; tags?: string[] }): Promise<Thought> {
  const text = input.text.trimEnd();
  if (!text.trim()) throw new Error("A Thought needs some text");
  const wanted = input.title?.trim() || titleFromText(text) || "Thought";
  const taken = (await documentsOf<Thought>(THOUGHT)).filter((t) => t.folder === THOUGHTS_FOLDER).map((t) => t.title);
  return (await createDocument({
    type: THOUGHT,
    title: freeTitle(wanted, taken),
    folder: THOUGHTS_FOLDER,
    body: text + "\n",
    fields: { kind: input.kind ?? "", aliases: [], tags: normalizeTags(input.tags ?? []) },
  })) as Thought;
}
