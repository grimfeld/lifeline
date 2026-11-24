import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { initApps } from "../registry";
import { documentsTable, getDocument, patchDocument } from "./store";
import { createDocument } from "./ops";
import type { DocumentTypeDef } from "./types";

const note: DocumentTypeDef = { id: "note", label: "Notes", singular: "Note", titleRule: "name", body: "optional", fields: [], builtIn: true };
initApps([{ id: "t", title: "T", types: [note], screens: [], cards: [], commands: [] }]);

beforeEach(async () => {
  await documentsTable().clear();
});

describe("patchDocument", () => {
  it("keeps both of two patches to one Document sent at once: neither writes back the other's old value", async () => {
    const doc = await createDocument({ type: "note", title: "Anne Dupont", folder: "" });
    await Promise.all([patchDocument(doc.id, { aliases: ["Mum"] }), patchDocument(doc.id, { relationship: "my mother" }), patchDocument(doc.id, { tags: ["family"] })]);
    expect(await getDocument(doc.id)).toMatchObject({ aliases: ["Mum"], relationship: "my mother", tags: ["family"] });
  });

  it("a failing patch does not stop the next", async () => {
    const doc = await createDocument({ type: "note", title: "A", folder: "" });
    await Promise.all([patchDocument("nope", { x: 1 }), patchDocument(doc.id, { relationship: "x" })]);
    expect((await getDocument(doc.id))?.relationship).toBe("x");
  });
});
