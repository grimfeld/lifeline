import { useEffect, useMemo, useRef } from "react";
import { createDocument, documentsOf, normalizeTags, putDocument, todayStr, useDocuments, useLinkIndex, type Document, type DocumentInput, type LinkIndex } from "@lifeline/core";
import { BOOK_ORDER, type CanonBook } from "../domain/canon";
import { canonical, chapterTitle, kindOf, parseRef, verseTitle, verseTitles, type Ref } from "../domain/refs";
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

/**
 * The scripture references already stored, read once per `ensureRef` and kept
 * in step with what it creates: one scan per type rather than one per verse,
 * and a Book or Chapter made for one part of a range is found by the rest.
 */
class RefLookup {
  private byType = new Map<string, Promise<Map<string, Document>>>();

  private table(type: string): Promise<Map<string, Document>> {
    let t = this.byType.get(type);
    if (!t) {
      t = documentsOf(type).then((docs) => new Map(docs.map((d) => [norm(d.title), d])));
      this.byType.set(type, t);
    }
    return t;
  }

  async find<T extends Document>(type: string, title: string): Promise<T | undefined> {
    return (await this.table(type)).get(norm(title)) as T | undefined;
  }

  async put<T extends Document>(input: DocumentInput<T>): Promise<T> {
    const created = await putDocument<T>(input);
    (await this.table(created.type)).set(norm(created.title), created);
    return created;
  }
}

async function ensureBook(refs: RefLookup, book: CanonBook): Promise<BibleBook> {
  const found = await refs.find<BibleBook>(BIBLE_BOOK, book.name);
  if (found) return found;
  return refs.put<BibleBook>({
    type: BIBLE_BOOK,
    title: book.name,
    folder: SCRIPTURE_FOLDER,
    order: BOOK_ORDER.get(book.name) ?? 0,
    testament: book.testament,
    aliases: book.abbr.map((a) => a.replace(/\b\w/g, (c) => c.toUpperCase())),
    body: "",
  });
}

async function ensureChapter(refs: RefLookup, book: CanonBook, chapter: number): Promise<BibleChapter> {
  const title = chapterTitle(book, chapter);
  const found = await refs.find<BibleChapter>(BIBLE_CHAPTER, title);
  if (found) return found;
  const b = await ensureBook(refs, book);
  return refs.put<BibleChapter>({ type: BIBLE_CHAPTER, title, folder: `${SCRIPTURE_FOLDER}/${book.name}`, bookId: b.id, book: book.name, chapter, body: "" });
}

async function ensureVerse(refs: RefLookup, book: CanonBook, chapter: number, verse: number): Promise<Verse> {
  const title = verseTitle(book, chapter, verse);
  const found = await refs.find<Verse>(VERSE, title);
  if (found) return found;
  const c = await ensureChapter(refs, book, chapter);
  return refs.put<Verse>({ type: VERSE, title, folder: `${SCRIPTURE_FOLDER}/${book.name}`, chapterId: c.id, bookId: c.bookId, book: book.name, chapter, verse, body: "" });
}

/**
 * Every Document a reference stands for, created where missing; returns the
 * one to open (the first). One at a time, so a range's Book (and Chapter) is
 * created once and found by the rest of it.
 */
export async function ensureRef(ref: Ref): Promise<Document> {
  const refs = new RefLookup();
  switch (kindOf(ref)) {
    case "book":
      return ensureBook(refs, ref.book);
    case "chapter":
      return ensureChapter(refs, ref.book, ref.chapter!);
    case "verse": {
      if (verseTitles(ref).length === 0) {
        // cross-chapter: its chapters
        let first: BibleChapter | null = null;
        for (let c = ref.chapter!; c <= ref.toChapter!; c++) {
          const d = await ensureChapter(refs, ref.book, c);
          first ??= d;
        }
        return first!;
      }
      const end = ref.toVerse ?? ref.verse!;
      let first: Verse | null = null;
      for (let v = ref.verse!; v <= end; v++) {
        const d = await ensureVerse(refs, ref.book, ref.chapter!, v);
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
