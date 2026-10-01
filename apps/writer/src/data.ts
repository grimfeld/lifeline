import { createDocument, documentsOf, documentsWhere, getDocument, moveDocument, normalizeFolder, putDocument, removeDocument, useDocuments, useLiveQuery } from "@lifeline/core";
import { useEffect } from "react";
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

/** A new Writing, in `Writings` or a Folder below it ("Talks" → `Writings/Talks`). */
export async function newWriting(input: { title: string; group?: string }): Promise<Writing> {
  const group = normalizeFolder(input.group ?? "");
  return (await createDocument({ type: WRITING, title: input.title, folder: group ? `Writings/${group}` : "Writings", fields: { status: "draft" } })) as Writing;
}

/**
 * The retired free-text `project` field (ADR 0060) becomes a Folder: a Writing
 * that still carries one moves to `<its folder>/<project>` and drops the
 * field. Runs on every device and is idempotent; a Writing whose title is
 * already taken there keeps its field and is tried again next time.
 */
export async function foldProjectsIntoFolders(): Promise<void> {
  for (const w of await documentsOf<Writing & { project?: unknown }>(WRITING)) {
    const project = typeof w.project === "string" ? w.project.trim() : "";
    if (w.project === undefined) continue;
    try {
      let doc: Writing & { project?: unknown } = w;
      if (project) {
        const folder = normalizeFolder(`${w.folder || "Writings"}/${project}`);
        await moveDocument(w, folder);
        doc = { ...w, folder };
      }
      const { project: _gone, ...rest } = doc;
      await putDocument<Writing>(rest as Writing);
    } catch (e) {
      console.warn(`[writer] could not fold project "${project}" of "${w.title}" into a folder`, e);
    }
  }
}

export function useFoldProjects(): void {
  useEffect(() => {
    void foldProjectsIntoFolders();
  }, []);
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
