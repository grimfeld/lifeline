import { useEffect, useMemo, useRef } from "react";
import { createDocument, documentsOf, normalizeTags, putDocument, todayStr, useDocuments, useLinkIndex, type Document, type LinkIndex } from "@lifeline/core";
import { BOOK_ORDER, type CanonBook } from "../domain/canon";
import { canonical, chapterTitle, chapterTitles, kindOf, parseRef, verseTitle, verseTitles, type Ref } from "../domain/refs";
import { BIBLE_BOOK, BIBLE_CHAPTER, CHARACTER, CONCEPT, REFERENCE_TYPES, STUDY_FOLDER, VERSE, type BibleBook, type BibleChapter, type Character, type Concept, type Verse } from "../domain/types";

const SCRIPTURE_FOLDER = `${STUDY_FOLDER}/Scripture`;

function norm(s: string): string {
  return s.trim().toLowerCase();
}

// ---- reads ----

export function useBooks(): BibleBook[] {
  const rows = useDocuments<BibleBook>(BIBLE_BOOK);
  return useMemo(() => [...rows].sort((a, b) => (BOOK_ORDER.get(a.title) ?? 99) - (BOOK_ORDER.get(b.title) ?? 99)), [rows]);
}
export function useChapters(): BibleChapter[] {
  const rows = useDocuments<BibleChapter>(BIBLE_CHAPTER);
  return useMemo(() => [...rows].sort((a, b) => (BOOK_ORDER.get(a.book) ?? 99) - (BOOK_ORDER.get(b.book) ?? 99) || a.chapter - b.chapter), [rows]);
}
export function useVerses(): Verse[] {
  const rows = useDocuments<Verse>(VERSE);
  return useMemo(() => [...rows].sort((a, b) => (BOOK_ORDER.get(a.book) ?? 99) - (BOOK_ORDER.get(b.book) ?? 99) || a.chapter - b.chapter || a.verse - b.verse), [rows]);
}
export function useCharacters(): Character[] {
  const rows = useDocuments<Character>(CHARACTER);
  return useMemo(() => [...rows].sort((a, b) => a.title.localeCompare(b.title)), [rows]);
}
export function useConcepts(): Concept[] {
  const rows = useDocuments<Concept>(CONCEPT);
  return useMemo(() => [...rows].sort((a, b) => a.title.localeCompare(b.title)), [rows]);
}

/**
 * The study (CONTEXT.md "Bible study"): every Document that links to a
 * Verse, Chapter, Book, Character or Concept — Notes, Clippings, Writings,
 * whatever — newest first. The references themselves are not the study.
 */
export function studyOf(index: LinkIndex): Document[] {
  const refTypes = new Set<string>(REFERENCE_TYPES);
  const out: Document[] = [];
  // `linkSources`, not every Document: an internal type's links are the owner's
  // (CONTEXT.md), so a Writing that quotes a Verse joins the study once and not
  // again for each of its Versions.
  for (const d of index.linkSources) {
    if (refTypes.has(d.type) || d.deleted) continue;
    if (index.linksFrom(d.id).some((l) => l.ref.kind === "doc" && refTypes.has(l.ref.type))) out.push(d);
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function useStudy(): Document[] {
  const index = useLinkIndex();
  return useMemo(() => studyOf(index), [index]);
}

// ---- creation on first mention (ADR 0032) ----

async function findByTitle<T extends Document>(type: string, title: string): Promise<T | undefined> {
  return (await documentsOf<T>(type)).find((d) => norm(d.title) === norm(title));
}

async function ensureBook(book: CanonBook): Promise<BibleBook> {
  const found = await findByTitle<BibleBook>(BIBLE_BOOK, book.name);
  if (found) return found;
  return putDocument<BibleBook>({
    type: BIBLE_BOOK,
    title: book.name,
    folder: SCRIPTURE_FOLDER,
    order: BOOK_ORDER.get(book.name) ?? 0,
    testament: book.testament,
    aliases: book.abbr.map((a) => a.replace(/\b\w/g, (c) => c.toUpperCase())),
    body: "",
  });
}

async function ensureChapter(book: CanonBook, chapter: number): Promise<BibleChapter> {
  const title = chapterTitle(book, chapter);
  const found = await findByTitle<BibleChapter>(BIBLE_CHAPTER, title);
  if (found) return found;
  const b = await ensureBook(book);
  return putDocument<BibleChapter>({ type: BIBLE_CHAPTER, title, folder: `${SCRIPTURE_FOLDER}/${book.name}`, bookId: b.id, book: book.name, chapter, body: "" });
}

async function ensureVerse(book: CanonBook, chapter: number, verse: number): Promise<Verse> {
  const title = verseTitle(book, chapter, verse);
  const found = await findByTitle<Verse>(VERSE, title);
  if (found) return found;
  const c = await ensureChapter(book, chapter);
  return putDocument<Verse>({ type: VERSE, title, folder: `${SCRIPTURE_FOLDER}/${book.name}`, chapterId: c.id, bookId: c.bookId, book: book.name, chapter, verse, body: "" });
}

/** Every Document a reference stands for, created where missing; returns the one to open (the first). */
export async function ensureRef(ref: Ref): Promise<Document> {
  switch (kindOf(ref)) {
    case "book":
      return ensureBook(ref.book);
    case "chapter":
      return ensureChapter(ref.book, ref.chapter!);
    case "verse": {
      const verses = verseTitles(ref);
      if (verses.length === 0) {
        // cross-chapter: its chapters
        const chapters = chapterTitles(ref).map((t) => Number(t.slice(ref.book.name.length + 1)));
        const docs = await Promise.all(chapters.map((c) => ensureChapter(ref.book, c)));
        return docs[0];
      }
      const end = ref.toVerse ?? ref.verse!;
      let first: Verse | null = null;
      for (let v = ref.verse!; v <= end; v++) {
        const d = await ensureVerse(ref.book, ref.chapter!, v);
        first ??= d;
      }
      return first!;
    }
  }
}

/**
 * Background (ADR 0032): every unresolved wikilink name that reads as a
 * scripture reference becomes its Verse/Chapter/Book. Runs whenever the link
 * index changes; a name is tried once per session so a failing write cannot
 * loop.
 */
export function useBibleBackground(): void {
  const index = useLinkIndex();
  const tried = useRef(new Set<string>());
  const names = useMemo(() => [...index.unresolved.keys()].filter((n) => parseRef(n) !== null), [index]);
  useEffect(() => {
    const todo = names.filter((n) => !tried.current.has(n));
    if (todo.length === 0) return;
    for (const n of todo) tried.current.add(n);
    void (async () => {
      for (const n of todo) {
        const ref = parseRef(n);
        if (ref) await ensureRef(ref).catch(() => undefined);
      }
    })();
  }, [names]);
}

// ---- Characters, Concepts, study Notes ----

export async function addReference(type: typeof CHARACTER | typeof CONCEPT, input: { title: string; aliases?: string[]; body?: string; tags?: string[] }): Promise<Document> {
  const folder = `${STUDY_FOLDER}/${type === CHARACTER ? "Characters" : "Concepts"}`;
  const doc = await createDocument({ type, title: input.title, folder, body: input.body ?? "", fields: { aliases: (input.aliases ?? []).map((a) => a.trim()).filter(Boolean), tags: normalizeTags(input.tags ?? []) } });
  return doc;
}

/** "Note on a verse" (the phone's capture): a Note in the Bible Folder opening with the link. */
export async function noteOnRef(ref: Ref, text: string, title?: string): Promise<Document> {
  await ensureRef(ref);
  const canon = canonical(ref);
  const t = title?.trim() || `${canon} · ${todayStr()}`;
  return createDocument({ type: "note", title: t, folder: STUDY_FOLDER, body: `[[${canon}]]\n\n${text.trim()}\n` });
}
