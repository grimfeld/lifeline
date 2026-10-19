import { createDocument, documentsOf, documentsWhere, getDocument, putDocument, removeDocument, useDocuments, useLiveQuery } from "@lifeline/core";
import { CHAPTER, MANUSCRIPT, MANUSCRIPTS_FOLDER, OUTTAKE, type Chapter, type Manuscript, type Outtake } from "../domain/types";
import { cutPassage, defaultChapterTitle, inOrder, moveChapter, nextPosition } from "../domain/order";

export function useManuscripts(): Manuscript[] {
  return useDocuments<Manuscript>(MANUSCRIPT);
}

export function useChapters(manuscriptId: string | undefined): Chapter[] {
  return useLiveQuery(async () => (manuscriptId ? inOrder(await documentsWhere<Chapter>(CHAPTER, "manuscriptId", manuscriptId)) : []), [manuscriptId], [] as Chapter[]);
}

export function useOuttakes(manuscriptId: string | undefined): Outtake[] {
  return useLiveQuery(
    async () => (manuscriptId ? (await documentsWhere<Outtake>(OUTTAKE, "manuscriptId", manuscriptId)).sort((a, b) => b.cutAt.localeCompare(a.cutAt)) : []),
    [manuscriptId],
    [] as Outtake[],
  );
}

/** Every Chapter, for the shelf's counts. */
export function useAllChapters(): Chapter[] {
  return useDocuments<Chapter>(CHAPTER);
}

/** The Folder a Manuscript's Chapters sit in — its own, so "Chapter 1" can exist in every one. */
const chaptersFolder = (m: Pick<Manuscript, "title">) => `${MANUSCRIPTS_FOLDER}/${m.title}`;

export async function newManuscript(input: { title: string; form?: string }): Promise<Manuscript> {
  return (await createDocument({ type: MANUSCRIPT, title: input.title, folder: MANUSCRIPTS_FOLDER, fields: { status: "draft", form: input.form ?? "novel" } })) as Manuscript;
}

/** A new Chapter at the end, "Chapter N" unless named. */
export async function addChapter(manuscriptId: string, title?: string): Promise<Chapter> {
  const m = await getDocument<Manuscript>(manuscriptId);
  if (!m) throw new Error("That Manuscript isn't here");
  const chapters = await documentsWhere<Chapter>(CHAPTER, "manuscriptId", manuscriptId);
  const wanted = title?.trim() || defaultChapterTitle(chapters.length);
  const folder = chaptersFolder(m);
  const taken = new Set((await documentsOf<Chapter>(CHAPTER)).filter((c) => c.folder === folder).map((c) => c.title.toLowerCase()));
  let name = wanted;
  for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${wanted} (${n})`;
  return (await createDocument({ type: CHAPTER, title: name, folder, body: "", fields: { manuscriptId, position: nextPosition(chapters), status: "draft" } })) as Chapter;
}

export async function moveChapterBy(manuscriptId: string, chapterId: string, by: -1 | 1): Promise<void> {
  const chapters = await documentsWhere<Chapter>(CHAPTER, "manuscriptId", manuscriptId);
  for (const change of moveChapter(chapters, chapterId, by)) {
    const c = chapters.find((x) => x.id === change.id)!;
    await putDocument<Chapter>({ ...c, position: change.position });
  }
}

/**
 * Cut a passage from a Chapter into the Manuscript's Outtakes (CONTEXT.md
 * "Outtake"): cutting never loses words. The Chapter is written first, so a
 * passage is never in both places.
 */
export async function cutToOuttake(chapterId: string, passage: string): Promise<Outtake> {
  const c = await getDocument<Chapter>(chapterId);
  if (!c) throw new Error("That Chapter isn't here");
  const next = cutPassage(c.body ?? "", passage);
  if (next === undefined) throw new Error("Select the passage in the text first");
  await putDocument<Chapter>({ ...c, body: next });
  return putDocument<Outtake>({ type: OUTTAKE, title: "", body: passage.trim() + "\n", manuscriptId: c.manuscriptId, chapterId: c.id, cutAt: new Date().toISOString(), folder: "" } as Outtake);
}

/** Put an Outtake back at the end of a Chapter — a new edit — and let it go. */
export async function restoreOuttake(outtakeId: string, chapterId: string): Promise<void> {
  const o = await getDocument<Outtake>(outtakeId);
  const c = await getDocument<Chapter>(chapterId);
  if (!o || !c) return;
  const body = (c.body ?? "").replace(/\s+$/, "");
  await putDocument<Chapter>({ ...c, body: `${body}${body ? "\n\n" : ""}${o.body.trim()}\n` });
  await removeDocument(o.id);
}

export async function deleteOuttake(id: string): Promise<void> {
  await removeDocument(id);
}
