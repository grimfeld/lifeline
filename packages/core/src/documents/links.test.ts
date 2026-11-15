import { describe, expect, it } from "vitest";
import { buildLinkIndex } from "./links";
import { aliasesOf } from "./types";
import type { Document, DocumentTypeDef } from "./types";

const T = (id: string, extra: Partial<DocumentTypeDef> = {}): DocumentTypeDef => ({
  id, label: id + "s", titleRule: "name", body: "optional", fields: [], linkable: true, builtIn: true, ...extra,
});
const types = [T("note"), T("daily"), T("person"), T("place"), T("media", { linkable: { aliasesField: "aliases" } }), T("template", { linkable: false }),
  T("recipe", { fields: [{ key: "source", label: "Source", kind: "link" }] }),
  // A Writing's Version, in miniature: internal, a copy of another Document's body, with a Link field back at it.
  T("version", { internal: true, linkable: false, fields: [{ key: "of", label: "Of", kind: "link" }] })];

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
    doc("v1", "version", "Snapshot", "Saw [[Yas]] and [[Nobody]]. #quote", "", { tags: ["quote"], of: "p1" }),
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
    expect(idx.backlinksTo("p1")[0]!.context).toContain("[[Yas]]");
  });
  it("makes no backlink of a Link field holding its own Document, or a Document that is not there", () => {
    const odd = [doc("m1", "media", "Dune"), doc("r2", "recipe", "Loop", "", "", { source: "r2" }), doc("r3", "recipe", "Lost", "", "", { source: "gone" })];
    const li = buildLinkIndex(odd, types);
    expect([li.backlinksTo("r2"), li.backlinksTo("gone")]).toEqual([[], []]);
  });
  it("collects unresolved names and tags", () => {
    expect(idx.unresolved.get("nobody")).toEqual(["d1"]);
    expect(idx.tags.get("quote")).toEqual(["d1", "pl"]);
    expect(idx.linksFrom("d1")).toHaveLength(4);
  });
  it("an internal type's Documents are sources of nothing: no backlink, Ghost or tag of their own", () => {
    // A Version repeats its Writing's prose. Counted again under its own name it
    // would double every relation the Writing already has (CONTEXT.md "internal").
    expect(idx.linkSources.some((d) => d.id === "v1")).toBe(false);
    expect(idx.backlinksTo("p1").map((b) => b.sourceId)).not.toContain("v1");
    expect(idx.unresolved.get("nobody")).toEqual(["d1"]);
    expect(idx.tags.get("quote")).toEqual(["d1", "pl"]);
    // Its own links still resolve — the Document it serves is where it is read.
    expect(idx.linksFrom("v1").map((l) => l.ref)).toEqual([
      { kind: "doc", id: "p1", type: "person" },
      { kind: "unresolved", name: "Nobody" },
    ]);
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
      doc("a", "person", "Alex", "", "People"),
      doc("b", "note", "Alex", "", "Books/Characters"),
      doc("c", "daily", "2026-08-17", "[[Alex]] [[Books/Characters/Alex]] [[people/alex]]", "Journal/2026/08"),
    ],
    types,
  );
  it("exact path wins, else the shallowest title", () => {
    expect(idx.resolve("Books/Characters/Alex")).toMatchObject({ id: "b" });
    expect(idx.resolve("people/alex")).toMatchObject({ id: "a" });
    expect(idx.resolve("Alex")).toMatchObject({ id: "a" });
  });
  it("offers path forms for ambiguous titles", () => {
    const names = idx.names().map((n) => n.name);
    expect(names).toEqual(expect.arrayContaining(["People/Alex", "Books/Characters/Alex", "2026-08-17"]));
    expect(names).not.toContain("Alex");
  });
});

describe("a type's linking text Fields", () => {
  // An Event in miniature: no body, its text in a Notes Field that names its wikilinks as links.
  const evType = T("ev", { body: "none", linkingText: ["notes"], fields: [{ key: "notes", label: "Notes", kind: "longtext" }, { key: "other", label: "Other", kind: "longtext" }] });
  const people = [doc("marc", "person", "Marc"), doc("jo", "person", "Jo")];
  const ev = doc("e1", "ev", "Dinner", "", "", { notes: "Dinner with [[Marc]] and [[Nobody]] #food", other: "[[Jo]]" });
  const idx = buildLinkIndex([...people, ev], [...types, evType]);

  it("reads the declared Field's wikilinks as backlinks, with their context", () => {
    expect(idx.backlinksTo("marc")).toEqual([{ sourceId: "e1", context: "Dinner with [[Marc]] and [[Nobody]] #food" }]);
  });
  it("reads no other Field", () => {
    expect(idx.backlinksTo("jo")).toEqual([]);
  });
  it("makes no Ghost and no tag of it", () => {
    expect(idx.unresolved.has("nobody")).toBe(false);
    expect(idx.tags.has("food")).toBe(false);
  });
  it("reads an Event with no Notes, or Notes that only embed an image, as linking nothing", () => {
    const bare = doc("e3", "ev", "Walk");
    const photo = doc("e4", "ev", "Beach", "", "", { notes: "![[Marc.png]]" });
    const marcPng = doc("img", "person", "Marc.png");
    expect(buildLinkIndex([...people, marcPng, bare, photo], [...types, evType]).backlinksTo("img")).toEqual([]);
  });
  it("still reads the body of a Document whose type is not installed", () => {
    const stray = doc("s1", "gone", "Stray", "Met [[Marc]]");
    expect(buildLinkIndex([...people, stray], types).backlinksTo("marc")).toEqual([{ sourceId: "s1", context: "Met [[Marc]]" }]);
  });
  it("makes no backlink of a Document naming itself in its own Field", () => {
    const self = doc("e2", "ev", "Gala", "", "", { notes: "See [[Gala]] again" });
    expect(buildLinkIndex([self], [...types, evType]).backlinksTo("e2")).toEqual([]);
  });
});

describe("a type's extra names (the Linkable Contract's `extraNames`, a Person's Given name)", () => {
  const given = T("person", { linkable: { extraNames: (d) => [String(d.givenName ?? "")] } });
  const types2 = [T("note"), given];
  const docs = [
    doc("p1", "person", "Anne Martin", "", "", { givenName: "Anne", aliases: ["Annie"] }),
    doc("p2", "person", "Bob Stone", "", "", { givenName: " ", aliases: [] }),
    doc("n1", "note", "Diary", "Tea with [[Anne]] and [[person:anne]]."),
  ];

  it("resolve [[Given name]] to its Document, after titles, as an alias does", () => {
    const idx = buildLinkIndex(docs, types2);
    expect(idx.resolve("anne")).toEqual({ kind: "doc", id: "p1", type: "person" });
    expect(idx.resolve("person:Anne")).toEqual({ kind: "doc", id: "p1", type: "person" });
    expect(idx.linksFrom("n1").map((l) => l.ref)).toEqual([{ kind: "doc", id: "p1", type: "person" }, { kind: "doc", id: "p1", type: "person" }]);
    // A title wins over an extra name, as over an alias.
    const withTitle = buildLinkIndex([...docs, doc("n2", "note", "Anne")], types2);
    expect(withTitle.resolve("Anne")).toEqual({ kind: "doc", id: "n2", type: "note" });
  });
  it("are offered by the completer under the name, showing the title it leads to; a blank one is not", () => {
    const idx = buildLinkIndex(docs, types2);
    const of = (id: string) => idx.names().filter((n) => n.ref.kind === "doc" && n.ref.id === id).map((n) => [n.name, n.subtitle]);
    expect(of("p1")).toEqual([["Anne Martin", "person"], ["Annie", "→ Anne Martin"], ["Anne", "→ Anne Martin"]]);
    expect(of("p2")).toEqual([["Bob Stone", "person"]]);
  });
  it("is the same name once when it is also a typed alias or the title", () => {
    const idx = buildLinkIndex([doc("p1", "person", "Anne", "", "", { givenName: "anne", aliases: ["Anne", "ANNE"] })], types2);
    expect(idx.names().map((n) => n.name)).toEqual(["Anne", "Anne", "ANNE"]);
  });
  it("two Documents with the same extra name: [[Anne]] goes where two equal typed aliases would (the first)", () => {
    const twins = [doc("p1", "person", "Anne Martin", "", "", { givenName: "Anne" }), doc("p2", "person", "Anne Roy", "", "", { givenName: "Anne" })];
    const asAliases = [doc("p1", "person", "Anne Martin", "", "", { aliases: ["Anne"] }), doc("p2", "person", "Anne Roy", "", "", { aliases: ["Anne"] })];
    expect(buildLinkIndex(twins, types2).resolve("Anne")).toEqual(buildLinkIndex(asAliases, types2).resolve("Anne"));
    expect(buildLinkIndex(twins, types2).resolve("person:Anne")).toEqual(buildLinkIndex(asAliases, types2).resolve("person:Anne"));
  });
  it("a corrected extra name changes what [[…]] resolves to", () => {
    const fixed = docs.map((d) => (d.id === "p1" ? { ...d, givenName: "Ann" } : d));
    const idx = buildLinkIndex(fixed, types2);
    expect(idx.resolve("Anne")).toEqual({ kind: "unresolved", name: "Anne" });
    expect(idx.resolve("Ann")).toEqual({ kind: "doc", id: "p1", type: "person" });
  });
});


describe("the Linkable hooks are trusted pure reads: a throwing one is a bug that surfaces", () => {
  const boom = () => {
    throw new Error("boom");
  };
  it("lets a throwing extraNames throw", () => {
    const bad = T("person", { linkable: { extraNames: boom } });
    expect(() => aliasesOf(doc("p1", "person", "Anne"), bad)).toThrow("boom");
  });
  it("lets a throwing members throw", () => {
    const bad = T("household", { linkable: { members: boom } });
    const docs = [doc("h", "household", "Home"), doc("n", "note", "Note", "at [[Home]]")];
    expect(() => buildLinkIndex(docs, [T("note"), bad]).reaches("h")).toThrow("boom");
  });
});
