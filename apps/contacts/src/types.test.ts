import { describe, expect, it } from "vitest";
import { buildLinkIndex, type Document } from "@lifeline/core";
import { personTypeDef } from "./types";

const anne: Document = { id: "p1", type: "contacts_person", title: "Anne Dupont", aliases: ["Mum"], relationship: "my mother", body: "", folder: "People", tags: [], createdAt: "2026-01-01", updatedAt: "", deleted: 0 };
const marc: Document = { id: "p2", type: "contacts_person", title: "Marc", aliases: [], relationship: "", body: "", folder: "People", tags: [], createdAt: "2026-01-01", updatedAt: "", deleted: 0 };

describe("a Person as a link target (ADR 0113)", () => {
  const index = buildLinkIndex([anne, marc], [personTypeDef]);

  it("is reached by its name and by each of its aliases", () => {
    expect(index.resolve("Mum")).toMatchObject({ kind: "doc", id: "p1" });
    expect(index.resolve("Anne Dupont")).toMatchObject({ kind: "doc", id: "p1" });
  });

  it("shows in the completer as a Person, with what they are to me when I said", () => {
    const names = index.names();
    expect(names.find((n) => n.name === "Anne Dupont")?.subtitle).toBe("Person · my mother");
    expect(names.find((n) => n.name === "Marc")?.subtitle).toBe("Person");
  });

  it("is mentionable, so the Mentioned Reports apply", () => {
    expect(personTypeDef.linkable).not.toMatchObject({ mentions: false });
  });
});
