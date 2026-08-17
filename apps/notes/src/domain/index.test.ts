import { describe, expect, it } from "vitest";
import { buildIndex } from "./index";
import type { Note } from "./types";

const note = (id: string, title: string, body: string, type: Note["type"] = "plain", folder = ""): Note => ({
  id, title, body, type, folder, createdAt: "2026-01-01", updatedAt: "", deleted: 0,
});

describe("buildIndex", () => {
  const notes = [
    note("d1", "2026-08-16", "Saw [[Yas]] at [[Paris]]. Read [[Dune]] and [[Nobody]]. #quote", "daily"),
    note("p1", "Yasmine", "---\naliases:\n  - Yas\n---\nA friend. Self [[Yasmine]].", "person"),
    note("pl", "Paris", "---\nkind: city\ntags:\n  - travel\n---\n#quote", "place"),
    note("d2", "2026-08-15", "Again [[yasmine]] and [[Dune]]", "daily"),
  ];
  const idx = buildIndex(notes, [{ appId: "media", itemId: "m1", name: "Dune", href: "/app/media" }, { appId: "media", itemId: "m2", name: "Paris", aliases: ["Paname"] }]);

  it("resolves title, alias, app entity, unresolved — notes win over apps", () => {
    expect(idx.resolve("Yasmine")).toEqual({ kind: "note", noteId: "p1" });
    expect(idx.resolve("yas")).toEqual({ kind: "note", noteId: "p1" });
    expect(idx.resolve("Paris")).toEqual({ kind: "note", noteId: "pl" });
    expect(idx.resolve("Dune")).toMatchObject({ kind: "app", appId: "media", itemId: "m1" });
    expect(idx.resolve("Paname")).toMatchObject({ kind: "app", itemId: "m2" });
    expect(idx.resolve("Nobody")).toEqual({ kind: "unresolved", name: "Nobody" });
  });
  it("backlinks for notes and app entities, ignoring self-links", () => {
    expect(idx.backlinksTo({ kind: "note", noteId: "p1" }).map((b) => b.noteId)).toEqual(["d1", "d2"]);
    expect(idx.backlinksTo({ kind: "app", appId: "media", itemId: "m1" }).map((b) => b.noteId)).toEqual(["d1", "d2"]);
    expect(idx.backlinksTo({ kind: "note", noteId: "p1" })[0].context).toContain("[[Yas]]");
  });
  it("collects unresolved names, tags and properties", () => {
    expect(idx.unresolved.get("nobody")).toEqual(["d1"]);
    expect(idx.tags.get("quote")).toEqual(["d1", "pl"]);
    expect(idx.tags.get("travel")).toEqual(["pl"]); // frontmatter tags count too
    expect(idx.properties("pl")).toEqual({ kind: "city", tags: ["travel"] });
    expect(idx.linksFrom("d1")).toHaveLength(4);
  });
  it("names() lists titles, aliases and app targets", () => {
    const names = idx.names().map((n) => n.name);
    expect(names).toEqual(expect.arrayContaining(["2026-08-16", "Yasmine", "Yas", "Paris", "Dune"]));
  });
});

describe("folders in resolution (ADR 0013)", () => {
  const idx = buildIndex([
    note("a", "Paul", "", "person", "People"),
    note("b", "Paul", "", "plain", "Books/Characters"),
    note("c", "2026-08-17", "[[Paul]] [[Books/Characters/Paul]] [[people/paul]]", "daily", "Journal/2026/08"),
  ]);
  it("exact path wins, else the shallowest title", () => {
    expect(idx.resolve("Books/Characters/Paul")).toEqual({ kind: "note", noteId: "b" });
    expect(idx.resolve("people/paul")).toEqual({ kind: "note", noteId: "a" });
    expect(idx.resolve("Paul")).toEqual({ kind: "note", noteId: "a" });
  });
  it("offers path forms for ambiguous titles in autocomplete", () => {
    const names = idx.names().map((n) => n.name);
    expect(names).toEqual(expect.arrayContaining(["People/Paul", "Books/Characters/Paul", "2026-08-17"]));
    expect(names).not.toContain("Paul");
  });
});
