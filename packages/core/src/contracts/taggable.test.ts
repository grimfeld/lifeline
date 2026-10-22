import { describe, expect, it } from "vitest";
import { tagVocabularyOf, taggedItemsFor } from "./taggable";
import type { Document, DocumentTypeDef } from "../documents/types";

const T = (id: string, extra: Partial<DocumentTypeDef> = {}): DocumentTypeDef => ({
  id, label: id + "s", titleRule: "name", body: "optional", fields: [], linkable: true, builtIn: true, ...extra,
});
const types = [T("note"), T("version", { internal: true })];
const doc = (id: string, type: string, tags: string[]): Document => ({
  id, type, title: id, body: "", folder: "", tags, createdAt: "2026-01-01", updatedAt: "1", deleted: 0,
});

describe("tag vocabulary (#283)", () => {
  const docs = [doc("a", "note", ["idea", "work"]), doc("b", "note", ["work"]), doc("c", "note", []), doc("v", "version", ["idea"])];

  it("lists tagged Documents but not internal ones, and counts their tags, most used first", () => {
    expect(taggedItemsFor(docs, types).map((i) => i.itemId)).toEqual(["a", "b"]);
    expect(tagVocabularyOf(taggedItemsFor(docs, types)).map((e) => [e.tag, e.count])).toEqual([["work", 2], ["idea", 1]]);
  });

  it("is worked out once per change, whoever asks", () => {
    const items = taggedItemsFor(docs, types);
    expect(taggedItemsFor(docs, types)).toBe(items);
    expect(tagVocabularyOf(items)).toBe(tagVocabularyOf(items));
    const next = [...docs, doc("d", "note", ["new"])];
    expect(taggedItemsFor(next, types)).not.toBe(items);
    expect(tagVocabularyOf(taggedItemsFor(next, types)).map((e) => e.tag)).toEqual(["work", "idea", "new"]);
  });
});
