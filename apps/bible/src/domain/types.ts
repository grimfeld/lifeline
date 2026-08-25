import type { Document } from "@lifeline/core";

export const APP_ID = "bible";
export const BIBLE_HREF = "/app/bible";
export const DESK_HREF = "/vault/bible";
/** The Folder new study Notes land in. */
export const STUDY_FOLDER = "Bible";

/** Document type ids (ADR 0032). `book` belongs to the Library, hence the prefixes. */
export const BIBLE_BOOK = "bible_book";
export const BIBLE_CHAPTER = "bible_chapter";
export const VERSE = "verse";
export const CHARACTER = "character";
export const CONCEPT = "concept";

export const SCRIPTURE_TYPES = [BIBLE_BOOK, BIBLE_CHAPTER, VERSE] as const;
export const REFERENCE_TYPES = [BIBLE_BOOK, BIBLE_CHAPTER, VERSE, CHARACTER, CONCEPT] as const;

/** A book of the Bible (CONTEXT.md "Book"), created on first mention. */
export interface BibleBook extends Document {
  type: typeof BIBLE_BOOK;
  /** Position in the canon, 0-based. */
  order: number;
  testament: "OT" | "NT";
  aliases: string[];
}

/** A chapter (CONTEXT.md "Chapter"). */
export interface BibleChapter extends Document {
  type: typeof BIBLE_CHAPTER;
  bookId: string;
  book: string;
  chapter: number;
}

/** One verse (CONTEXT.md "Verse"): a hub, no text. */
export interface Verse extends Document {
  type: typeof VERSE;
  chapterId: string;
  bookId: string;
  book: string;
  chapter: number;
  verse: number;
}

/** A person of the Bible (CONTEXT.md "Character"). */
export interface Character extends Document {
  type: typeof CHARACTER;
  aliases: string[];
  notes: string;
}

/** An idea the study keeps returning to (CONTEXT.md "Concept"). */
export interface Concept extends Document {
  type: typeof CONCEPT;
  aliases: string[];
}

/** Sort verses and chapters in reading order. */
export function compareScripture(a: { book: string; chapter: number; verse?: number }, b: { book: string; chapter: number; verse?: number }, order: Map<string, number>): number {
  return (order.get(a.book) ?? 99) - (order.get(b.book) ?? 99) || a.chapter - b.chapter || (a.verse ?? 0) - (b.verse ?? 0);
}
