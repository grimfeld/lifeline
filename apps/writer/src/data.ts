import { createDocument, documentsWhere, getDocument, normalizeTags, putDocument, removeDocument, useDocuments, useLiveQuery, type Document } from "@lifeline/core";
import { ESSAY, ESSAYS_FOLDER, VERSION, wordCount, type Essay, type Version } from "./types";

export function useEssays(): Essay[] {
  return useDocuments<Essay>(ESSAY);
}

export function useVersions(ofId: string | undefined): Version[] {
  return useLiveQuery(
    async () => (ofId ? (await documentsWhere<Version>(VERSION, "writingId", ofId)).sort((a, b) => b.takenAt.localeCompare(a.takenAt)) : []),
    [ofId],
    [] as Version[],
  );
}

/** A new Essay, grouped by Tags rather than a container (ADR 0068): a thesis's chapters are Essays sharing a Tag. */
export async function newEssay(input: { title: string; tags?: string[] }): Promise<Essay> {
  return (await createDocument({ type: ESSAY, title: input.title, folder: ESSAYS_FOLDER, fields: { status: "draft", material: [], tags: normalizeTags(input.tags ?? []) } })) as Essay;
}

/** Take a Version: a snapshot of the current body, on purpose (never automatic). Of an Essay or a Chapter. */
export async function snapshot(of: Pick<Document, "id" | "folder"> & { body?: unknown }, label = ""): Promise<Version> {
  const body = typeof of.body === "string" ? of.body : "";
  return putDocument<Version>({
    type: VERSION,
    title: "",
    body,
    writingId: of.id,
    label: label.trim(),
    takenAt: new Date().toISOString(),
    words: wordCount(body),
    folder: of.folder,
  } as Version);
}

/** Restore is a new edit, not a rewind: the current text is snapshotted first so nothing is lost. */
export async function restore(of: Document, version: Version): Promise<void> {
  if (of.body !== version.body) await snapshot(of, "before restore");
  await putDocument({ ...of, body: version.body });
}

export async function deleteVersion(id: string): Promise<void> {
  await removeDocument(id);
}

export async function setStatus(id: string, status: Essay["status"]): Promise<void> {
  const w = await getDocument<Essay>(id);
  if (w) await putDocument<Essay>({ ...w, status });
}

/** Pin a Document to an Essay's material (ADR 0068), or take it off. */
export async function setPinned(essayId: string, docId: string, pinned: boolean): Promise<void> {
  const e = await getDocument<Essay>(essayId);
  if (!e) return;
  const now = Array.isArray(e.material) ? e.material : [];
  const next = pinned ? (now.includes(docId) ? now : [...now, docId]) : now.filter((x) => x !== docId);
  if (next.length !== now.length) await putDocument<Essay>({ ...e, material: next });
}
