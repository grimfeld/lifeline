import { describe, expect, it } from "vitest";
import { documentToText, textToDocument } from "./text";
import type { Document, DocumentTypeDef } from "./types";

const def: DocumentTypeDef = {
  id: "task", label: "Tasks", titleRule: "name", body: "optional", builtIn: true,
  fields: [
    { key: "date", label: "Day", kind: "date", guarded: true },
    { key: "done", label: "Done", kind: "boolean" },
    { key: "effort", label: "Effort", kind: "number" },
    { key: "project", label: "Project", kind: "link" },
    { key: "where", label: "Where", kind: "geo" },
    { key: "secret", label: "Secret", kind: "text", hidden: true },
  ],
};
const doc: Document = { id: "t1", type: "task", title: "Buy milk", body: "Skimmed.\n", tags: ["home"], folder: "", createdAt: "2026-01-01", updatedAt: "", deleted: 0,
  date: "2026-08-20", done: false, effort: 2, project: "p1", where: [48.85, 2.35], secret: "x" };
const codec = { linkName: (id: string) => (id === "p1" ? "Groceries" : undefined), resolveLink: (n: string) => (n === "Groceries" ? "p1" : undefined) };

describe("text projection", () => {
  it("renders fields as frontmatter (links as wikilinks, hidden omitted) + body", () => {
    const text = documentToText(doc, def, codec);
    expect(text).toBe("---\ndate: 2026-08-20\ndone: false\neffort: 2\nproject: \"[[Groceries]]\"\nwhere: [48.85, 2.35]\ntags:\n  - home\n---\nSkimmed.\n");
  });
  it("round-trips, rejects guarded edits, resolves links back to ids", () => {
    const text = "---\ndate: 2026-08-21\ndone: true\neffort: 3\nproject: \"[[Groceries]]\"\nwhere: [1, 2]\ntags: [home, urgent]\nextra: hi\n---\nNew body\n";
    const { patch, rejected } = textToDocument(text, doc, def, codec);
    expect(rejected).toEqual(["date"]);
    expect(patch).toEqual({ done: true, effort: 3, where: [1, 2], tags: ["home", "urgent"], extra: "hi", body: "New body\n" });
  });
});

describe("links fields (ADR 0052)", () => {
  const many: DocumentTypeDef = { id: "book", label: "Books", titleRule: "name", body: "none", builtIn: true, fields: [{ key: "authors", label: "Authors", kind: "links", linkType: "author" }] };
  const names = { linkName: (id: string) => ({ a1: "Frank Herbert", a2: "Brian Herbert" })[id], resolveLink: (n: string) => ({ "Frank Herbert": "a1", "Brian Herbert": "a2" })[n] };
  const book: Document = { id: "b1", type: "book", title: "Dune", tags: [], folder: "", createdAt: "2026-01-01", updatedAt: "", deleted: 0, authors: ["a1", "a2"] };
  it("writes every id as a wikilink list, even a single one, and omits an empty list", () => {
    expect(documentToText(book, many, names)).toBe('---\nauthors:\n  - "[[Frank Herbert]]"\n  - "[[Brian Herbert]]"\n---\n');
    expect(documentToText({ ...book, authors: ["a1"] }, many, names)).toBe('---\nauthors:\n  - "[[Frank Herbert]]"\n---\n');
    expect(documentToText({ ...book, authors: [] }, many, names)).toBe("");
  });
  it("reads a list, a single wikilink, or nothing back as an array of ids", () => {
    expect(textToDocument('---\nauthors:\n  - "[[Brian Herbert]]"\n---\n', book, many, names).patch.authors).toEqual(["a2"]);
    expect(textToDocument('---\nauthors: "[[Frank Herbert]]"\n---\n', { ...book, authors: [] }, many, names).patch.authors).toEqual(["a1"]);
    expect(textToDocument("---\n---\n", book, many, names).patch.authors).toEqual([]);
  });
});
