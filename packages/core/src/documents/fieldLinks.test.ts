import { describe, expect, it } from "vitest";
import { backlinkContext, linkFieldLabel } from "./fieldLinks";
import type { Document, DocumentTypeDef, FieldDef } from "./types";

const T = (id: string, fields: FieldDef[] = []): DocumentTypeDef => ({ id, label: id + "s", titleRule: "name", body: "optional", fields, linkable: true, builtIn: true });
const doc = (id: string, type: string, title: string, extra: Record<string, unknown> = {}): Document => ({
  id, type, title, body: "", folder: "", tags: [], createdAt: "2026-01-01", updatedAt: "", deleted: 0, ...extra,
});

const types = [
  T("person"),
  T("event", [{ key: "with", label: "With", kind: "links", linkType: "person" }]),
  T("task", [{ key: "for", label: "For", kind: "links", linkType: "person" }]),
  T("note"),
];
const docs = [
  doc("marc", "person", "Marc"),
  doc("e1", "event", "Dinner", { with: ["marc"] }),
  doc("e2", "event", "Hike", { with: ["marc"] }),
  doc("t1", "task", "Buy a gift", { for: ["marc"] }),
  doc("n1", "note", "Notes", { body: "[[Marc]] said hi" }),
];

describe("the Backlinks a page lists", () => {
  it("says a Backlink by the field it came through, the words around it, or the start of the linking body", () => {
    const n2 = doc("n2", "note", "Old", { body: "# Long ago\n\nWe met **once**." });
    expect([
      backlinkContext({ sourceId: "e1", context: "", field: "with" }, docs[1]),
      backlinkContext({ sourceId: "n1", context: "[[Marc]] said hi" }, docs[4]),
      backlinkContext({ sourceId: "n2", context: "" }, n2),
      backlinkContext({ sourceId: "gone", context: "" }, undefined),
    ]).toEqual(["via with", "[[Marc]] said hi", "Long ago We met once.", ""]);
  });
});

describe("a Link field's label", () => {
  it("is the label the linking Document's type gives the field, or else its key", () => {
    expect([linkFieldLabel(docs[1], types[1], "with"), linkFieldLabel(docs[1], types[1], "gone"), linkFieldLabel(undefined, undefined, "with")]).toEqual(["With", "gone", "with"]);
  });
});
