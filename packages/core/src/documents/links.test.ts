import { describe, expect, it } from "vitest";
import { buildLinkIndex } from "./links";
import type { Document, DocumentTypeDef } from "./types";

const T = (id: string, extra: Partial<DocumentTypeDef> = {}): DocumentTypeDef => ({
  id, label: id + "s", titleRule: "name", body: "optional", fields: [], linkable: true, builtIn: true, ...extra,
});
const types = [T("note"), T("daily"), T("person"), T("place"), T("media", { linkable: { aliasesField: "aliases" } }), T("template", { linkable: false }),
  T("recipe", { fields: [{ key: "source", label: "Source", kind: "link" }] })];

const doc = (id: string, type: string, title: string, body = "", folder = "", extra: Record<string, unknown> = {}): Document => ({
  id, type, title, body, folder, tags: [], createdAt: "2026-01-01", updatedAt: "", deleted: 0, ...extra,
});

describe("buildLinkIndex", () => {
  const docs = [
    doc("d1", "daily", "2026-08-16", "Saw [[Yas]] at [[Paris]]. Read [[Dune]] and [[Nobody]]. #quote", "", { tags: ["quote"] }),
    doc("p1", "person", "Yasmine", "A friend. Self [[Yasmine]].", "", { aliases: ["Yas"] }),
    doc("pl", "place", "Paris", "#quote", "", { tags: ["quote", "travel"] }),
    doc("d2", "daily", "2026-08-15", "Again [[yasmine]] and [[Dune]] and [[media:Paris]]"),
    doc("m1", "media", "Dune"),
    doc("m2", "media", "Paris", "", "", { aliases: ["Paname"] }),
    doc("tpl", "template", "Dune", "[[Yas]]"),
    doc("r1", "recipe", "Cake", "", "", { source: "m1" }),
  ];
  const idx = buildLinkIndex(docs, types);

  it("resolves title, alias, type prefix, unresolved; shallowest path wins ties", () => {
    expect(idx.resolve("Yasmine")).toEqual({ kind: "doc", id: "p1", type: "person" });
    expect(idx.resolve("yas")).toEqual({ kind: "doc", id: "p1", type: "person" });
    expect(idx.resolve("Paris")).toEqual({ kind: "doc", id: "pl", type: "place" });
    expect(idx.resolve("media:Paris")).toEqual({ kind: "doc", id: "m2", type: "media" });
    expect(idx.resolve("medias:Paname")).toEqual({ kind: "doc", id: "m2", type: "media" });
    expect(idx.resolve("Dune")).toEqual({ kind: "doc", id: "m1", type: "media" });
    expect(idx.resolve("Nobody")).toEqual({ kind: "unresolved", name: "Nobody" });
  });
  it("a name behind the locked Private folder is a lock, not a hole (ADR 0038): no Ghost, no backlink", () => {
    const locked = { names: new Set(["nobody"]), ids: new Set(["hidden"]) };
    const li = buildLinkIndex(docs, types, locked);
    expect(li.resolve("Nobody")).toEqual({ kind: "locked", name: "Nobody" });
    expect(li.resolve("Yasmine")).toEqual({ kind: "doc", id: "p1", type: "person" });
    expect(li.unresolved.has("nobody")).toBe(false);
    expect(li.linksFrom("d1").find((l) => l.link.name === "Nobody")?.ref.kind).toBe("locked");
    expect(idx.unresolved.has("nobody")).toBe(true);
  });
  it("backlinks from bodies and Link fields, ignoring self-links; templates are not targets", () => {
    expect(idx.backlinksTo("p1").map((b) => b.sourceId)).toEqual(["d1", "d2", "tpl"]);
    expect(idx.backlinksTo("m1").map((b) => [b.sourceId, b.field])).toEqual([["d1", undefined], ["d2", undefined], ["r1", "source"]]);
    expect(idx.backlinksTo("tpl")).toEqual([]);
    expect(idx.backlinksTo("p1")[0].context).toContain("[[Yas]]");
  });
  it("collects unresolved names and tags", () => {
    expect(idx.unresolved.get("nobody")).toEqual(["d1"]);
    expect(idx.tags.get("quote")).toEqual(["d1", "pl"]);
    expect(idx.linksFrom("d1")).toHaveLength(4);
  });
  it("names() lists titles, aliases with type", () => {
    const names = idx.names();
    expect(names.map((n) => n.name)).toEqual(expect.arrayContaining(["2026-08-16", "Yasmine", "Yas", "Dune", "Paname"]));
    expect(names.find((n) => n.name === "Yas")?.type).toBe("person");
    expect(names.some((n) => n.ref.kind === "doc" && n.ref.id === "tpl")).toBe(false);
  });
});

describe("folders in resolution (ADR 0013)", () => {
  const idx = buildLinkIndex(
    [
      doc("a", "person", "Paul", "", "People"),
      doc("b", "note", "Paul", "", "Books/Characters"),
      doc("c", "daily", "2026-08-17", "[[Paul]] [[Books/Characters/Paul]] [[people/paul]]", "Journal/2026/08"),
    ],
    types,
  );
  it("exact path wins, else the shallowest title", () => {
    expect(idx.resolve("Books/Characters/Paul")).toMatchObject({ id: "b" });
    expect(idx.resolve("people/paul")).toMatchObject({ id: "a" });
    expect(idx.resolve("Paul")).toMatchObject({ id: "a" });
  });
  it("offers path forms for ambiguous titles", () => {
    const names = idx.names().map((n) => n.name);
    expect(names).toEqual(expect.arrayContaining(["People/Paul", "Books/Characters/Paul", "2026-08-17"]));
    expect(names).not.toContain("Paul");
  });
});
