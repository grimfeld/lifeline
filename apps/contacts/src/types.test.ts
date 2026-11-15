import { describe, expect, it } from "vitest";
import { buildLinkIndex, reportsOf, type Document } from "@lifeline/core";
import { householdTypeDef, personTypeDef } from "./types";

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

  it("is reached by its Given name, never copied into its Aliases (ADR 0117)", () => {
    const given: Document = { ...anne, givenName: "Anne" };
    const idx = buildLinkIndex([given, marc], [personTypeDef]);
    expect(idx.resolve("anne")).toMatchObject({ kind: "doc", id: "p1" });
    expect(idx.names().find((n) => n.name === "Anne")?.subtitle).toBe("→ Anne Dupont");
    expect(given.aliases).toEqual(["Mum"]);
    expect(buildLinkIndex([{ ...given, givenName: "Annie" }, marc], [personTypeDef]).resolve("Anne")).toMatchObject({ kind: "unresolved" });
  });

  it("is mentionable, so the Mentioned Reports apply", () => {
    expect(personTypeDef.linkable).not.toMatchObject({ mentions: false });
  });
});

describe("a Household's Reports (ADR 0117)", () => {
  it("are Last seen and Last mentioned, as a Person's: what links to it, by name", () => {
    expect(reportsOf(householdTypeDef).map((r) => r.kind)).toEqual(["lastSeen", "last"]);
  });
});
