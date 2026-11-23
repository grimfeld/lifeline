import { describe, expect, it } from "vitest";
import { buildLinkIndex, conflictCopy, type Document, type DocumentTypeDef } from "@lifeline/core";
import { memoryTypeDef } from "./types";

const doc = (id: string, type: string, title: string, more: Record<string, unknown> = {}): Document => ({ id, type, title, body: "", folder: "", tags: [], createdAt: "2026-01-01", updatedAt: "", deleted: 0, ...more });
const linkable = (id: string): DocumentTypeDef => ({ id, label: id, titleRule: "name", body: "optional", linkable: true, fields: [], builtIn: true });
const types = [memoryTypeDef, linkable("event"), linkable("contacts_person"), linkable("atlas_place")];

const party = doc("e1", "event", "Ana's 30th");
const ana = doc("p1", "contacts_person", "Ana");
const janou = doc("pl1", "atlas_place", "Chez Janou");
const memory = doc("m1", "memories_memory", "Dancing on the terrace", { folder: "Memories", date: "2026-06-14", about: ["e1", "p1", "pl1"] });

describe("a Memory (ADR 0136)", () => {
  it("shows in the Backlinks of each Event, Person and Place it is about", () => {
    const index = buildLinkIndex([party, ana, janou, memory], types);
    for (const id of ["e1", "p1", "pl1"]) expect(index.backlinksTo(id).map((b) => b.sourceId), id).toEqual(["m1"]);
  });

  it("is a link target by its title, and opens on its own page under the Journal", () => {
    const index = buildLinkIndex([memory], types);
    expect(index.resolve("Dancing on the terrace")).toMatchObject({ kind: "doc", id: "m1" });
    expect(memoryTypeDef.href?.(memory)).toBe("/app/journal/memories/m1");
  });

  it("has a required date, and an About of any Linkable type", () => {
    expect(memoryTypeDef.fields.find((f) => f.key === "date")).toMatchObject({ kind: "date", required: true });
    const about = memoryTypeDef.fields.find((f) => f.key === "about");
    expect(about).toMatchObject({ kind: "links" });
    expect(about?.linkType).toBeUndefined();
  });

  it("keeps a Conflict copy of an unsynced edit (ADR 0010)", () => {
    expect(memoryTypeDef.onConflict).toBe(conflictCopy);
  });
});
