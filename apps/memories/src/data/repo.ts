import { addAttachment, createDocument, documentsOf, getDocument, patchDocument, putDocument, removeDocument, renameDocument, todayStr } from "@lifeline/core";
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
  /** An image stored as an Attachment first (downscaled, 20 MB ceiling) and embedded after the words; a refusal makes no Memory. */
  photo?: Blob & { name?: string };
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
  let body = input.body?.trimEnd() ?? "";
  if (input.photo) body = `${body}\n\n![[${(await addAttachment(input.photo)).name}]]`.trim();
  return (await createDocument({
    type: MEMORY,
    title: freeTitle(wanted, taken),
    folder: MEMORIES_FOLDER,
    body: body ? body + "\n" : "",
    fields: { date: input.date || todayStr(), about: [...new Set(input.about ?? [])] },
  })) as Memory;
}

export interface MemoryPatch {
  title?: string;
  date?: string;
  about?: readonly string[];
}

/** Change a Memory: only the patched keys; a new title renames it (rewriting links to it), an empty one is refused. */
export async function patchMemory(id: string, patch: MemoryPatch): Promise<void> {
  if (patch.title !== undefined) {
    if (!patch.title.trim()) throw new Error("A Memory needs a title");
    const doc = await getDocument(id);
    if (doc) await renameDocument(doc, patch.title);
  }
  const fields: Record<string, unknown> = {};
  if (patch.date) fields.date = patch.date;
  if (patch.about) fields.about = [...new Set(patch.about)];
  if (Object.keys(fields).length) await patchDocument(id, fields);
}

/** Delete a Memory (a tombstone); returns what `restoreMemory` brings back, for the Undo toast. */
export async function deleteMemory(id: string): Promise<Memory | undefined> {
  const before = await getDocument<Memory>(id);
  await removeDocument(id);
  return before;
}

/** Undo `deleteMemory`: the same Memory, under its own id, as it was. */
export async function restoreMemory(memory: Memory): Promise<void> {
  await putDocument<Memory>({ ...memory, deleted: 0 });
}
