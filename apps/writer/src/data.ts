import { createDocument, documentsWhere, getDocument, putDocument, removeDocument, useDocuments, useLiveQuery } from "@lifeline/core";
import { VERSION, WRITING, wordCount, type Version, type Writing } from "./types";

export function useWritings(): Writing[] {
  return useDocuments<Writing>(WRITING);
}

export function useVersions(writingId: string | undefined): Version[] {
  return useLiveQuery(
    async () => (writingId ? (await documentsWhere<Version>(VERSION, "writingId", writingId)).sort((a, b) => b.takenAt.localeCompare(a.takenAt)) : []),
    [writingId],
    [] as Version[],
  );
}

export async function newWriting(input: { title: string; project?: string }): Promise<Writing> {
  return (await createDocument({ type: WRITING, title: input.title, fields: { status: "draft", project: input.project ?? "" } })) as Writing;
}

/** Take a Version: a snapshot of the current body, on purpose (never automatic). */
export async function snapshot(writing: Writing, label = ""): Promise<Version> {
  return putDocument<Version>({
    type: VERSION,
    title: "",
    body: writing.body,
    writingId: writing.id,
    label: label.trim(),
    takenAt: new Date().toISOString(),
    words: wordCount(writing.body),
    folder: writing.folder,
  } as Version);
}

/** Restore is a new edit of the Writing, not a rewind: the current text is snapshotted first so nothing is lost. */
export async function restore(writing: Writing, version: Version): Promise<void> {
  if (writing.body !== version.body) await snapshot(writing, "before restore");
  await putDocument<Writing>({ ...writing, body: version.body });
}

export async function deleteVersion(id: string): Promise<void> {
  await removeDocument(id);
}

/** Deleting a Writing tombstones its Versions too — the cascade is the type's `onDelete` (ADR 0045). */
export async function deleteWriting(id: string): Promise<void> {
  await removeDocument(id);
}

export async function setStatus(id: string, status: Writing["status"]): Promise<void> {
  const w = await getDocument<Writing>(id);
  if (w) await putDocument<Writing>({ ...w, status });
}
