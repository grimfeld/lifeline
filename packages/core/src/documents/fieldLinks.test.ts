import { describe, expect, it } from "vitest";
import { buildLinkIndex } from "./links";
import { fieldLinksTo } from "./fieldLinks";
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
const idx = buildLinkIndex(docs, types);

describe("fieldLinksTo", () => {
  it("groups what links in through Link fields by the type of the linking Document, with the field that did it", () => {
    expect(fieldLinksTo(idx, "marc").map((g) => [g.type, g.rows.map((r) => [r.sourceId, r.field])])).toEqual([
      ["event", [["e1", "with"], ["e2", "with"]]],
      ["task", [["t1", "for"]]],
    ]);
  });

  it("leaves out what only a wikilink says", () => {
    expect(fieldLinksTo(idx, "marc").flatMap((g) => g.rows.map((r) => r.sourceId))).not.toContain("n1");
  });

  it("is empty when nothing links through a field", () => {
    expect(fieldLinksTo(idx, "e1")).toEqual([]);
  });
});
