import { describe, expect, it } from "vitest";
import { applyView, availableLayouts, defaultColumns, fieldByKey, layoutFieldOf, layoutPickKey, matchesFilter } from "./views";
import type { Document, DocumentTypeDef, FieldDef } from "./types";

const doc = (id: string, extra: Partial<Document> = {}): Document => ({
  id, type: "book", title: id, body: "", folder: "", tags: [], createdAt: "2026-01-01", updatedAt: "2026-01-01T00:00:00Z", deleted: 0, ...extra,
});
const T = (fields: FieldDef[], extra: Partial<DocumentTypeDef> = {}): DocumentTypeDef => ({
  id: "book", label: "Books", titleRule: "name", body: "optional", fields, linkable: true, builtIn: true, ...extra,
});
const ids = (docs: Document[]) => docs.map((d) => d.id);

describe("matchesFilter", () => {
  it("is / is not compare as text, and look inside a list", () => {
    const d = doc("a", { status: "read", pages: 120, tags: ["fiction", "fr"] });
    expect(matchesFilter(d, { field: "status", op: "eq", value: "read" })).toBe(true);
    expect(matchesFilter(d, { field: "pages", op: "eq", value: "120" })).toBe(true);
    expect(matchesFilter(d, { field: "tags", op: "eq", value: "fr" })).toBe(true);
    expect(matchesFilter(d, { field: "tags", op: "neq", value: "fr" })).toBe(false);
    expect(matchesFilter(d, { field: "status", op: "neq", value: "unread" })).toBe(true);
  });

  it("is on a yes/no field takes true or \"true\"", () => {
    const d = doc("a", { owned: true });
    expect(matchesFilter(d, { field: "owned", op: "eq", value: true })).toBe(true);
    expect(matchesFilter(d, { field: "owned", op: "eq", value: "true" })).toBe(true);
    expect(matchesFilter(doc("b", { owned: false }), { field: "owned", op: "eq", value: true })).toBe(false);
  });

  it("contains ignores case and accents", () => {
    const d = doc("Kraków Diaries");
    expect(matchesFilter(d, { field: "title", op: "contains", value: "krakow" })).toBe(true);
    expect(matchesFilter(d, { field: "title", op: "contains", value: "warsaw" })).toBe(false);
  });

  it("is empty / is set treat null, \"\" and [] as empty", () => {
    for (const v of [null, undefined, "", []]) expect(matchesFilter(doc("a", { note: v }), { field: "note", op: "empty" })).toBe(true);
    expect(matchesFilter(doc("a", { note: "x" }), { field: "note", op: "notEmpty" })).toBe(true);
    expect(matchesFilter(doc("a", { note: 0 }), { field: "note", op: "empty" })).toBe(false);
  });

  it("> and < compare numbers as numbers and the rest as text", () => {
    expect(matchesFilter(doc("a", { pages: 120 }), { field: "pages", op: "gt", value: "99" })).toBe(true);
    expect(matchesFilter(doc("a", { pages: 120 }), { field: "pages", op: "lt", value: 99 })).toBe(false);
    expect(matchesFilter(doc("a", { createdAt: "2026-03-01" }), { field: "createdAt", op: "gt", value: "2026-02-28" })).toBe(true);
    expect(matchesFilter(doc("a", { createdAt: "2026-03-01" }), { field: "createdAt", op: "lt", value: "2026-02-28" })).toBe(false);
  });

  it("any of matches one shared value, and everything when none are given", () => {
    const d = doc("a", { status: "read", tags: ["fiction"] });
    expect(matchesFilter(d, { field: "status", op: "anyOf", value: ["unread", "read"] })).toBe(true);
    expect(matchesFilter(d, { field: "tags", op: "anyOf", value: ["poetry", "fiction"] })).toBe(true);
    expect(matchesFilter(d, { field: "tags", op: "anyOf", value: ["poetry"] })).toBe(false);
    expect(matchesFilter(d, { field: "status", op: "anyOf", value: "read" })).toBe(true);
    expect(matchesFilter(d, { field: "status", op: "anyOf", value: [] })).toBe(true);
  });
});

describe("applyView", () => {
  const docs = [
    doc("b", { title: "Beta", pages: 300, updatedAt: "2026-01-02T00:00:00Z", tags: ["fiction"] }),
    doc("a", { title: "alpha", pages: 20, updatedAt: "2026-01-03T00:00:00Z", body: "about whales" }),
    doc("c", { title: "Gamma 10", pages: undefined, updatedAt: "2026-01-01T00:00:00Z" }),
    doc("d", { title: "Gamma 9", pages: 100, updatedAt: "2026-01-04T00:00:00Z" }),
  ];

  it("with nothing set, is every Document, last updated first", () => {
    expect(ids(applyView(docs, {}))).toEqual(["d", "a", "b", "c"]);
  });

  it("keeps the Documents every filter matches", () => {
    expect(ids(applyView(docs, { filters: [{ field: "pages", op: "gt", value: 50 }, { field: "title", op: "contains", value: "gamma" }] }))).toEqual(["d"]);
  });

  it("searches the title, the body and the tags", () => {
    expect(ids(applyView(docs, { search: " WHALES " }))).toEqual(["a"]);
    expect(ids(applyView(docs, { search: "fict" }))).toEqual(["b"]);
    expect(ids(applyView(docs, { search: "beta" }))).toEqual(["b"]);
  });

  it("searches a derived title too", () => {
    const untitled = [doc("x", { title: "", isbn: "978" })];
    expect(ids(applyView(untitled, { search: "isbn 978" }, T([], { titleOf: (d) => `ISBN ${String(d.isbn)}` })))).toEqual(["x"]);
  });

  it("sorts by title ascending by default, ignoring case and reading numbers as numbers", () => {
    expect(ids(applyView(docs, { sortBy: "title" }))).toEqual(["a", "b", "d", "c"]);
    expect(ids(applyView(docs, { sortBy: "title", sortDir: "desc" }))).toEqual(["c", "d", "b", "a"]);
  });

  it("sorts numbers as numbers, the empty last whichever way", () => {
    expect(ids(applyView(docs, { sortBy: "pages", sortDir: "asc" }))).toEqual(["a", "d", "b", "c"]);
    expect(ids(applyView(docs, { sortBy: "pages", sortDir: "desc" }))).toEqual(["b", "d", "a", "c"]);
  });

  it("sorts by created newest first by default", () => {
    const dated = [doc("old", { createdAt: "2025-01-01" }), doc("new", { createdAt: "2026-05-01" })];
    expect(ids(applyView(dated, { sortBy: "createdAt" }))).toEqual(["new", "old"]);
  });

  it("leaves the list it was given as it was", () => {
    const before = ids(docs);
    applyView(docs, { sortBy: "title" });
    expect(ids(docs)).toEqual(before);
  });
});

describe("defaultColumns", () => {
  it("is title, the fields flagged as columns, tags", () => {
    const def = T([{ key: "author", label: "Author", kind: "text" }, { key: "pages", label: "Pages", kind: "number", column: true }]);
    expect(defaultColumns(def)).toEqual(["title", "pages", "tags"]);
  });

  it("is title, the first four visible fields, tags, when none is flagged", () => {
    const f = (key: string, hidden = false): FieldDef => ({ key, label: key, kind: "text", hidden });
    expect(defaultColumns(T([f("a"), f("secret", true), f("b"), f("c"), f("d"), f("e")]))).toEqual(["title", "a", "b", "c", "d", "tags"]);
    expect(defaultColumns(undefined)).toEqual(["title", "tags"]);
  });
});

describe("fieldByKey", () => {
  it("finds the type's own field, then a common one", () => {
    const def = T([{ key: "title", label: "Name", kind: "text" }]);
    expect(fieldByKey(def, "title")?.label).toBe("Name");
    expect(fieldByKey(def, "createdAt")?.label).toBe("Created");
    expect(fieldByKey(def, "nope")).toBeUndefined();
  });
});

describe("layouts", () => {
  const def = T([
    { key: "status", label: "Status", kind: "select", options: [{ value: "read", label: "Read" }] },
    { key: "shelf", label: "Shelf", kind: "select", options: [] },
    { key: "finished", label: "Finished", kind: "date" },
  ]);

  it("offers a board only with a select field, a map only with a geo field", () => {
    expect(availableLayouts(def)).toEqual(["table", "list", "cards", "gallery", "board", "calendar"]);
    expect(availableLayouts(T([{ key: "at", label: "At", kind: "geo" }]))).toContain("map");
  });

  it("reads the field picked, while it still fits, else the first that does", () => {
    expect(layoutPickKey("board")).toBe("groupField");
    expect(layoutPickKey("table")).toBeUndefined();
    expect(layoutFieldOf({ groupField: "shelf" }, def, "board")?.key).toBe("shelf");
    expect(layoutFieldOf({ groupField: "finished" }, def, "board")?.key).toBe("status");
    expect(layoutFieldOf({}, def, "calendar")?.key).toBe("finished");
    expect(layoutFieldOf({}, T([]), "calendar")?.key).toBe("createdAt");
  });
});
