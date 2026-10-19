import { describe, expect, it } from "vitest";
import { buildLinkIndex, type Document, type DocumentTypeDef } from "@lifeline/core";
import { candidatesOf, materialOf } from "./material";

const T = (id: string, extra: Partial<DocumentTypeDef> = {}): DocumentTypeDef => ({ id, label: id + "s", titleRule: "name", body: "optional", fields: [], linkable: true, builtIn: true, ...extra });
const types = [T("essay", { fields: [{ key: "material", label: "Material", kind: "links" }] }), T("note", { fields: [{ key: "source", label: "Source", kind: "link" }] }), T("source"), T("thought")];
const doc = (id: string, type: string, title: string, body = "", extra: Record<string, unknown> = {}): Document => ({ id, type, title, body, folder: "", tags: [], createdAt: "2026-01-01", updatedAt: "", deleted: 0, ...extra });

describe("an Essay's material and candidates", () => {
  const docs = [
    doc("e", "essay", "On naming", "Starts from [[Naming is power]] and [[Earthsea]].", { material: ["t"] }),
    doc("n", "note", "Naming is power", "See also [[A thought on names]].", { source: "s" }),
    doc("s", "source", "Earthsea"),
    doc("t", "thought", "A thought on names"),
    doc("q", "note", "True names in ch. 3", "", { source: "s" }),
    doc("x", "note", "Unrelated", ""),
  ];
  const index = buildLinkIndex(docs, types);

  it("is what I pinned, then what the text links, each once", () => {
    expect(materialOf(docs[0], index)).toEqual([
      { id: "t", via: "pinned" },
      { id: "n", via: "linked" },
      { id: "s", via: "linked" },
    ]);
  });

  it("offers what sits one link from the material and is not material yet", () => {
    const cands = candidatesOf("e", materialOf(docs[0], index), index);
    // q is a Note on the Source s (a Link field), so it touches s; nothing else is near.
    expect(cands).toEqual([{ id: "q", touches: 1 }]);
  });
});
