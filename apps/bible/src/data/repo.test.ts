import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { removeDocument, documentsOf, initApps, type DocumentTypeDef } from "@lifeline/core";
import { parseRef } from "../domain/refs";
import { BIBLE_BOOK, BIBLE_CHAPTER, VERSE, type BibleBook, type BibleChapter, type Verse } from "../domain/types";
import { ensureRef } from "./repo";

// The scripture types, bare: the App manifest pulls in screens that need a DOM.
const bare = (id: string, indexes: string[] = []) => ({ id, label: id, titleRule: "name", body: "optional", fields: [], indexes, builtIn: true }) as unknown as DocumentTypeDef;
initApps([{ id: "bible", title: "Bible", types: [bare(BIBLE_BOOK), bare(BIBLE_CHAPTER, ["bookId"]), bare(VERSE, ["chapterId"])], screens: [], cards: [], commands: [] }]);

beforeEach(async () => {
  for (const t of [VERSE, BIBLE_CHAPTER, BIBLE_BOOK]) for (const d of await documentsOf(t)) await removeDocument(d.id);
});

describe("ensureRef", () => {
  it("a cross-chapter range creates its Book once and each Chapter once", async () => {
    const first = await ensureRef(parseRef("John 3:16-5:2")!);
    expect(first.title).toBe("John 3");
    const books = await documentsOf<BibleBook>(BIBLE_BOOK);
    expect(books.map((b) => b.title)).toEqual(["John"]);
    const chapters = await documentsOf<BibleChapter>(BIBLE_CHAPTER);
    expect(chapters.map((c) => c.title).sort()).toEqual(["John 3", "John 4", "John 5"]);
    expect(chapters.every((c) => c.bookId === books[0].id)).toBe(true);
  });

  it("a verse range creates each Verse under one Chapter and Book, and reuses them next time", async () => {
    await ensureRef(parseRef("John 3:16-18")!);
    await ensureRef(parseRef("John 3:17-19")!);
    const verses = await documentsOf<Verse>(VERSE);
    expect(verses.map((v) => v.title).sort()).toEqual(["John 3:16", "John 3:17", "John 3:18", "John 3:19"]);
    expect(await documentsOf(BIBLE_CHAPTER)).toHaveLength(1);
    expect(await documentsOf(BIBLE_BOOK)).toHaveLength(1);
  });
});
