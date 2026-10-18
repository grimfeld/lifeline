import { describe, expect, it } from "vitest";
import { fieldChangeProblems, fitsKind, kindRefusals, removedFieldValues, reservedKeyProblems, reservedKeyRefusal, typeDeleteRefusal } from "./typeRules";
import type { Document, FieldDef } from "./types";

const doc = (fields: Record<string, unknown>): Document => ({ id: "x", type: "person", title: "P", tags: [], folder: "", createdAt: "2026-01-01", updatedAt: "", deleted: 0, ...fields }) as Document;

describe("fitsKind", () => {
  it("lets an empty value fit every kind", () => {
    for (const v of [undefined, null, "", []]) expect(fitsKind(v, { kind: "number" })).toBe(true);
  });

  it("checks each kind's stored shape", () => {
    expect(fitsKind("one line", { kind: "text" })).toBe(true);
    expect(fitsKind("two\nlines", { kind: "text" })).toBe(false);
    expect(fitsKind("two\nlines", { kind: "longtext" })).toBe(true);
    expect(fitsKind("42", { kind: "number" })).toBe(false);
    expect(fitsKind(42, { kind: "number" })).toBe(true);
    expect(fitsKind("2026-10-16", { kind: "date" })).toBe(true);
    expect(fitsKind("2026-10-16", { kind: "datetime" })).toBe(false);
    expect(fitsKind("2026-10-16T09:30", { kind: "datetime" })).toBe(true);
    expect(fitsKind("a", { kind: "multiselect" })).toBe(false);
    expect(fitsKind(["a"], { kind: "multiselect", options: [{ value: "a", label: "A" }] })).toBe(true);
    expect(fitsKind("id1", { kind: "links" })).toBe(false);
    expect(fitsKind([51.5, -0.1], { kind: "geo" })).toBe(true);
  });
});

describe("fieldChangeProblems", () => {
  const born: FieldDef = { key: "born", label: "Born", kind: "text" };

  it("allows relabelling and adding Fields", () => {
    expect(fieldChangeProblems([born], [{ ...born, label: "Birthday" }, { key: "met", label: "Met", kind: "date" }], [doc({ born: "1990" })])).toEqual([]);
  });

  it("allows a kind change every held value still fits", () => {
    expect(fieldChangeProblems([born], [{ ...born, kind: "longtext" }], [doc({ born: "1990" })])).toEqual([]);
    expect(fieldChangeProblems([born], [{ ...born, kind: "date" }], [doc({ born: "1990-04-02" }), doc({})])).toEqual([]);
  });

  it("refuses a kind change a held value does not fit, and counts them", () => {
    const p = fieldChangeProblems([born], [{ ...born, kind: "number" }], [doc({ born: "1990" }), doc({ born: "1991" }), doc({})]);
    expect(p).toHaveLength(1);
    expect(p[0]).toContain("2 Documents");
  });

  it("refuses dropping a choice a Document still uses", () => {
    const mood: FieldDef = { key: "mood", label: "Mood", kind: "select", options: [{ value: "up", label: "Up" }, { value: "down", label: "Down" }] };
    const fewer = { ...mood, options: [{ value: "up", label: "Up" }] };
    expect(fieldChangeProblems([mood], [fewer], [doc({ mood: "up" })])).toEqual([]);
    expect(fieldChangeProblems([mood], [fewer], [doc({ mood: "down" })])[0]).toContain("no longer offered");
  });

  it("doesn't blame a Field that keeps its kind for a value that didn't fit it already", () => {
    const held = [doc({ born: "two\nlines" })];
    expect(fieldChangeProblems([born], [{ ...born, label: "Birth" }], held)).toEqual([]);
    expect(fieldChangeProblems([born], [{ ...born, kind: "number" }], held)).toHaveLength(1);
  });
});

describe("removedFieldValues", () => {
  it("counts the Documents that keep a removed Field's value", () => {
    const f: FieldDef = { key: "born", label: "Born", kind: "text" };
    expect(removedFieldValues([f], [], [doc({ born: "1990" }), doc({ born: "" }), doc({})])).toEqual([{ field: f, count: 1 }]);
    expect(removedFieldValues([f], [f], [doc({ born: "1990" })])).toEqual([]);
  });
});

describe("typeDeleteRefusal", () => {
  it("lets an empty type go", () => {
    expect(typeDeleteRefusal("People", { here: 0, elsewhere: 0, total: 0 })).toBeUndefined();
  });

  it("refuses while Documents are left, naming the ones in other Workspaces", () => {
    expect(typeDeleteRefusal("People", { here: 12, elsewhere: 0, total: 12 })).toMatch(/^People still has 12 Documents\. /);
    expect(typeDeleteRefusal("People", { here: 12, elsewhere: 200, total: 212 })).toContain("212 Documents (200 in other Workspaces)");
    expect(typeDeleteRefusal("People", { here: 0, elsewhere: 1, total: 1 })).toContain("1 Document, all in other Workspaces");
  });
});

describe("reservedKeyProblems", () => {
  const f = (key: string, label = key): FieldDef => ({ key, label, kind: "text" });

  it("refuses a new Field keyed with one of a Document's own keys, saying why", () => {
    expect(reservedKeyProblems([], [f("tags", "Tags"), f("mood")])).toEqual([{ key: "tags", label: "Tags", refused: true, message: "`tags` — every Document already has Tags" }]);
  });

  it("covers every Document key, Roles and Tallies", () => {
    const keys = ["id", "type", "title", "body", "tags", "folder", "createdAt", "updatedAt", "deleted", "workspace", "roles", "tallies"];
    expect(reservedKeyProblems([], keys.map((k) => f(k))).map((p) => p.key)).toEqual(keys);
    expect(reservedKeyProblems([], [f("tag"), f("titles"), f("role")])).toEqual([]);
  });

  it("only warns about a saved Field that already collides, so it still saves", () => {
    const [p] = reservedKeyProblems([f("folder", "Folder")], [f("folder", "Shelf")]);
    expect(p).toMatchObject({ key: "folder", label: "Shelf", refused: false });
    expect(p.message).toContain("every Document already has a Folder");
  });

  it("gives the store's refusal only for new reserved keys", () => {
    expect(reservedKeyRefusal([f("title")], [f("title"), f("mood")])).toBeUndefined();
    expect(reservedKeyRefusal([f("title")], [f("title"), f("body", "Notes")])).toBe("Can't add “Notes”: `body` — every Document already has a body");
  });
});

describe("kindRefusals", () => {
  const kinds = ["text", "longtext", "number", "list", "select"] as const;
  const notes = { key: "notes", kind: "text" as const, options: [], saved: true };

  it("refuses, with a reason, the kinds a saved Field's values don't fit", () => {
    const docs = [doc({ notes: "two\nlines" }), doc({ notes: "one" }), doc({})];
    const r = kindRefusals(notes, kinds, docs);
    expect(r.number).toBe("2 Documents hold a value it can't take");
    expect(r.list).toBe("2 Documents hold a value it can't take");
    expect(r.longtext).toBeUndefined();
  });

  it("checks Choice kinds against the draft's options, offering none yet as open", () => {
    const docs = [doc({ notes: "home" }), doc({ notes: "work" })];
    expect(kindRefusals(notes, kinds, docs).select).toBeUndefined();
    const some = { ...notes, options: [{ value: "home" }] };
    expect(kindRefusals(some, kinds, docs).select).toBe("1 Document holds a choice its options don't offer");
    expect(kindRefusals({ ...some, options: [{ value: "home" }, { value: "work" }] }, kinds, docs).select).toBeUndefined();
  });

  it("leaves every kind open on an unsaved Field and never refuses its current kind", () => {
    const docs = [doc({ notes: "two\nlines" })];
    expect(kindRefusals({ ...notes, saved: false }, kinds, docs)).toEqual({});
    expect(kindRefusals(notes, kinds, docs).text).toBeUndefined();
  });
});
