import { extractLinks, proseSegments } from "@lifeline/core";
import { BOOK_FORMS, MAX_VERSE, WORD_FORMS, bookByName, type CanonBook } from "./canon";

/**
 * A scripture reference as read from text (ADR 0032). Three shapes:
 *   book            — "John"
 *   chapter         — "John 3"
 *   verse / range   — "John 3:16", "John 3:16–18", "John 3:16–4:2" (cross-chapter)
 */
export interface Ref {
  book: CanonBook;
  chapter: number | null;
  verse: number | null;
  /** Range end (same chapter unless `toChapter`). */
  toVerse: number | null;
  toChapter: number | null;
}

const DASH = "[-–—]";
const FORMS = BOOK_FORMS.map((f) => f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
/** "Book 3:16-18", "Book 3.16", "Book 3", "Book" — book forms are case-insensitive, dots allowed after abbreviations. */
const REF_RE = new RegExp(`^\\s*(${FORMS})\\.?\\s*(?:(\\d+)(?:[:.](\\d+)(?:\\s*${DASH}\\s*(?:(\\d+)[:.])?(\\d+))?)?)?\\s*$`, "i");
/** The same, loose in prose: a word boundary before, nothing alphabetic right after. The dot is captured (see `writtenAsRef`). */
const SCAN_RE = new RegExp(`(^|[^\\p{L}\\p{N}])(${FORMS})(\\.?)\\s+(\\d+)(?:[:.](\\d+)(?:\\s*${DASH}\\s*(?:(\\d+)[:.])?(\\d+))?)?(?![\\p{L}\\p{N}])`, "giu");

function build(bookForm: string, ch?: string, v?: string, toCh?: string, toV?: string): Ref | null {
  const book = bookByName(bookForm);
  if (!book) return null;
  if (ch === undefined) return { book, chapter: null, verse: null, toVerse: null, toChapter: null };
  let chapter = Number(ch);
  let verse = v === undefined ? null : Number(v);
  // A single-chapter book written "Jude 3" means verse 3.
  if (book.chapters === 1 && verse === null && chapter > 1) {
    verse = chapter;
    chapter = 1;
  }
  if (chapter < 1 || chapter > book.chapters) return null;
  if (verse !== null && (verse < 1 || verse > MAX_VERSE)) return null;
  const toChapter = toCh === undefined ? null : Number(toCh);
  let toVerse = toV === undefined ? null : Number(toV);
  if (toVerse !== null && toVerse > MAX_VERSE) return null;
  if (toChapter !== null && (toChapter < chapter || toChapter > book.chapters)) return null;
  if (toChapter === null && toVerse !== null && verse !== null && toVerse <= verse) toVerse = null;
  return { book, chapter, verse, toVerse, toChapter };
}

/** Read one reference written on its own (a wikilink name, a lookup box). null when it is not one. */
export function parseRef(text: string): Ref | null {
  const m = REF_RE.exec(text);
  if (!m) return null;
  return build(m[1], m[2], m[3], m[4], m[5]);
}

export function bookTitle(r: Pick<Ref, "book">): string {
  return r.book.name;
}
export function chapterTitle(book: CanonBook, chapter: number): string {
  return `${book.name} ${chapter}`;
}
export function verseTitle(book: CanonBook, chapter: number, verse: number): string {
  return `${book.name} ${chapter}:${verse}`;
}

/** The reference written canonically: "John 3:16–18", "John 3:16–4:2", "John 3", "John". */
export function canonical(r: Ref): string {
  if (r.chapter === null) return r.book.name;
  if (r.verse === null) return chapterTitle(r.book, r.chapter);
  const head = verseTitle(r.book, r.chapter, r.verse);
  if (r.toChapter !== null && r.toVerse !== null) return `${head}–${r.toChapter}:${r.toVerse}`;
  if (r.toVerse !== null) return `${head}–${r.toVerse}`;
  return head;
}

export type RefKind = "book" | "chapter" | "verse";

export function kindOf(r: Ref): RefKind {
  return r.chapter === null ? "book" : r.verse === null ? "chapter" : "verse";
}

/**
 * The Verse titles a verse reference stands for — one, or every verse of a
 * same-chapter range. A cross-chapter range has none (it stands for Chapters).
 */
export function verseTitles(r: Ref): string[] {
  if (r.chapter === null || r.verse === null || r.toChapter !== null) return [];
  const end = r.toVerse ?? r.verse;
  const out: string[] = [];
  for (let v = r.verse; v <= end; v++) out.push(verseTitle(r.book, r.chapter, v));
  return out;
}

/** The Chapter titles a reference spans: a chapter ref, or the chapters of a cross-chapter range. */
export function chapterTitles(r: Ref): string[] {
  if (r.chapter === null) return [];
  if (r.verse === null) return [chapterTitle(r.book, r.chapter)];
  if (r.toChapter === null) return [];
  const out: string[] = [];
  for (let c = r.chapter; c <= r.toChapter; c++) out.push(chapterTitle(r.book, c));
  return out;
}

/** Linkable expanders (ADR 0032): one per scripture type; the link index tries each and the first non-null wins. */
export const expanders = {
  book(name: string): string[] | null {
    const r = parseRef(name);
    return r && kindOf(r) === "book" ? [bookTitle(r)] : null;
  },
  chapter(name: string): string[] | null {
    const r = parseRef(name);
    if (!r) return null;
    const titles = chapterTitles(r);
    return titles.length ? titles : null;
  },
  verse(name: string): string[] | null {
    const r = parseRef(name);
    if (!r) return null;
    const titles = verseTitles(r);
    return titles.length ? titles : null;
  },
};

/** A bare reference found in prose: what was written, where, and what it means. */
export interface FoundRef {
  text: string;
  from: number;
  to: number;
  ref: Ref;
}

/**
 * A short or everyday-word book form ("is", "de", "mt") in prose is a
 * reference only when written like one: capitalised ("Is 53:5"), dotted
 * ("is. 53:5"), or — unless it is an everyday word, where "is 10:30" is a
 * time — with chapter and verse ("mt 5:3").
 */
function writtenAsRef(form: string, dot: string, verse: string | undefined): boolean {
  const word = form.toLowerCase();
  const isWord = WORD_FORMS.has(word);
  if (!isWord && word.length > 2) return true;
  if (dot || form[0] !== word[0]) return true;
  return !isWord && verse !== undefined;
}

/**
 * Bare references in a body — "see Rom 8:28", "(Jn 3:16–18)" — outside code
 * and outside existing wikilinks. Book names alone are not scanned: "John"
 * in prose is a person more often than a gospel.
 */
export function scanRefs(body: string): FoundRef[] {
  const linked = extractLinks(body);
  const inLink = (from: number, to: number) => linked.some((l) => from < l.to && to > l.from);
  const out: FoundRef[] = [];
  for (const seg of proseSegments(body)) {
    SCAN_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = SCAN_RE.exec(seg.text))) {
      const start = seg.offset + m.index + m[1].length;
      const end = seg.offset + m.index + m[0].length;
      if (inLink(start, end)) continue;
      if (!writtenAsRef(m[2], m[3], m[5])) continue;
      const ref = build(m[2], m[4], m[5], m[6], m[7]);
      if (!ref) continue;
      out.push({ text: seg.text.slice(m.index + m[1].length, m.index + m[0].length), from: start, to: end, ref });
    }
  }
  return out;
}

/** The body with the found references wrapped as wikilinks, canonical form inside, what was written kept as the alias. */
export function linkRefs(body: string, found: FoundRef[]): string {
  let out = body;
  for (const f of [...found].sort((a, b) => b.from - a.from)) {
    const canon = canonical(f.ref);
    const written = f.text.trim();
    out = out.slice(0, f.from) + (written === canon ? `[[${canon}]]` : `[[${canon}|${written}]]`) + out.slice(f.to);
  }
  return out;
}
