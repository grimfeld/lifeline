import { describe, expect, it } from "vitest";
import { buildLinkIndex, linkIndexBuilds, linkIndexFor, type LinkIndex } from "./links";
import type { Document, DocumentTypeDef } from "./types";

/**
 * `linkIndexFor` patches the last index when a few Documents' bodies or fields
 * change (#272). Whatever it does, the index must be the one a whole build gives.
 */

const T = (id: string, extra: Partial<DocumentTypeDef> = {}): DocumentTypeDef => ({
  id, label: id + "s", titleRule: "name", body: "optional", fields: [], linkable: true, builtIn: true, ...extra,
});
const types = [T("note"), T("person", { linkable: { extraNames: (d) => [String(d.givenName ?? "")] } }), T("media", { linkable: { aliasesField: "aliases" } }),
  T("recipe", { fields: [{ key: "source", label: "Source", kind: "link" }] }),
  T("version", { internal: true, linkable: false, fields: [{ key: "of", label: "Of", kind: "link" }] })];

const doc = (id: string, type: string, title: string, body = "", extra: Record<string, unknown> = {}): Document => ({
  id, type, title, body, folder: "", tags: [], createdAt: "2026-01-01", updatedAt: "1", deleted: 0, ...extra,
});

const vault = (): Document[] => [
  doc("a", "note", "Alpha", "See [[Beta]] and [[Yas]], not [[Nobody]]. #idea", { tags: ["idea"] }),
  doc("b", "note", "Beta", "Back to [[Alpha]]. [[Dune]]"),
  doc("m", "media", "Dune", "", { aliases: ["Arrakis"] }),
  doc("p", "person", "Yasmine", "Self [[Yasmine]]", { aliases: ["Yas"], givenName: "Yasmina" }),
  doc("r", "recipe", "Cake", "[[Arrakis]] spice", { source: "m" }),
  doc("v", "version", "Snapshot", "[[Beta]] [[Nobody]]", { of: "a" }),
];

/** Everything the index says, in a form `toEqual` compares. */
function snapshot(idx: LinkIndex) {
  const ids = idx.docs.map((d) => d.id);
  return {
    ids,
    sources: idx.linkSources.map((d) => d.id),
    byId: [...idx.byId.entries()],
    linksFrom: ids.map((id) => idx.linksFrom(id)),
    backlinks: ids.map((id) => idx.backlinksTo(id)),
    unresolved: [...idx.unresolved.entries()].sort(),
    tags: [...idx.tags.entries()].sort(),
    names: idx.names(),
    mentions: idx.mentionNames(),
    resolve: ["Alpha", "Beta", "Yas", "Arrakis", "media:Dune", "Nobody", "Gamma", "Yasmina", "Mina"].map((n) => idx.resolve(n)),
  };
}

/** Feed `linkIndexFor` a sequence of vaults; after each, it must agree with a whole build. Returns how it got there. */
function run(...steps: Document[][]): { full: number; patched: number } {
  linkIndexFor([], types); // forget the last test's vault, which has the same ids
  const start = linkIndexBuilds();
  for (const docs of steps) expect(snapshot(linkIndexFor(docs, types))).toEqual(snapshot(buildLinkIndex(docs, types)));
  const end = linkIndexBuilds();
  return { full: end.full - start.full, patched: end.patched - start.patched };
}

const edit = (docs: Document[], id: string, patch: Partial<Document> & Record<string, unknown>) =>
  docs.map((d) => (d.id === id ? { ...d, ...patch, updatedAt: String(Number(d.updatedAt) + 1) } : d));

describe("linkIndexFor patches what a whole build would give", () => {
  it("an edited body: links added, changed and removed", () => {
    const v0 = vault();
    const v1 = edit(v0, "a", { body: "See [[Dune]] and [[Gamma]]. #idea" });
    const v2 = edit(v1, "a", { body: "" });
    const v3 = edit(v2, "b", { body: "[[Alpha]] [[Yas]] [[Yas]] [[Nobody]]" });
    expect(run(v0, v1, v2, v3)).toEqual({ full: 1, patched: 3 });
  });

  it("an edited Link field, tags, and an internal type's body", () => {
    const v0 = vault();
    const v1 = edit(v0, "r", { source: "p" });
    const v2 = edit(v1, "a", { tags: ["idea", "later"] });
    const v3 = edit(v2, "v", { body: "[[Dune]]" });
    expect(run(v0, v1, v2, v3)).toEqual({ full: 1, patched: 3 });
  });

  it("several Documents changed at once", () => {
    const v0 = vault();
    const v1 = edit(edit(v0, "a", { body: "[[Cake]]" }), "b", { body: "[[Gamma]]" });
    expect(run(v0, v1)).toEqual({ full: 1, patched: 1 });
  });

  it("a rename, an alias, a move or a new type is a whole build", () => {
    const v0 = vault();
    const v1 = edit(v0, "b", { title: "Gamma" });
    const v2 = edit(v1, "m", { aliases: ["Desert"] });
    const v3 = edit(v2, "p", { folder: "People" });
    const v4 = edit(v3, "a", { type: "person" });
    expect(run(v0, v1, v2, v3, v4)).toEqual({ full: 5, patched: 0 });
  });

  it("a corrected extra name (a Given name) is a whole build, so [[…]] follows it", () => {
    const v0 = vault().map((d) => (d.id === "b" ? { ...d, body: "[[Mina]]" } : d));
    const v1 = edit(v0, "p", { givenName: "Mina" });
    expect(run(v0, v1)).toEqual({ full: 2, patched: 0 });
    expect(linkIndexFor(v1, types).backlinksTo("p").map((b) => b.sourceId)).toContain("b");
  });

  it("a Document added or deleted is a whole build", () => {
    const v0 = vault();
    const v1 = [...v0, doc("g", "note", "Gamma", "[[Alpha]]")];
    const v2 = v1.filter((d) => d.id !== "b");
    expect(run(v0, v1, v2)).toEqual({ full: 3, patched: 0 });
  });

  it("the same Documents in a new array keep the index", () => {
    const v0 = vault();
    const first = linkIndexFor(v0, types);
    expect(linkIndexFor([...v0], types)).toBe(first);
  });

  it("typing in one Note of 2000 never builds the index whole (#272)", () => {
    let docs = Array.from({ length: 2000 }, (_, i) => doc(`n${i}`, "note", `Note ${i}`, `Links to [[Note ${(i + 1) % 2000}]] and [[Note ${(i + 7) % 2000}]].`));
    linkIndexFor(docs, types);
    const before = linkIndexBuilds();
    let body = "Draft";
    for (let k = 0; k < 40; k++) {
      body += k % 5 === 0 ? ` [[Note ${k}]]` : " word";
      docs = edit(docs, "n42", { body });
      linkIndexFor(docs, types);
    }
    const after = linkIndexBuilds();
    expect(after.full - before.full).toBe(0);
    expect(after.patched - before.patched).toBe(40);
    expect(snapshot(linkIndexFor(docs, types))).toEqual(snapshot(buildLinkIndex(docs, types)));
  });
});

describe("linkIndexFor keeps who a Household link reaches (ADR 0117) across patches", () => {
  const withHouseholds = [...types, T("household", { linkable: { members: (d) => ((d.members ?? []) as { personId: string }[]).map((m) => ({ id: m.personId })) } })];
  const home = (): Document[] => [
    ...vault(),
    doc("h", "household", "Home", "", { members: [{ personId: "p" }] }),
    doc("d", "note", "Dinner", "At [[Home]]"),
  ];
  const reachedBy = (docs: Document[], id: string) => linkIndexFor(docs, withHouseholds).reaches(id).map((r) => [r.sourceId, r.via]);
  const viaBuilt = () => linkIndexBuilds().via;

  it("reuses it after a body-only edit to a Note that links to no Household", () => {
    linkIndexFor([], withHouseholds);
    const v0 = home();
    const start = viaBuilt();
    expect(reachedBy(v0, "p")).toContainEqual(["d", "h"]);
    const before = viaBuilt();
    expect(before).toBe(start + 1);
    const v1 = edit(v0, "a", { body: "Typing [[Beta]] away" });
    expect(reachedBy(v1, "p")).toContainEqual(["d", "h"]);
    expect(viaBuilt()).toBe(before);
  });

  it("works it out again when a Household's members change", () => {
    linkIndexFor([], withHouseholds);
    const v0 = home();
    expect(reachedBy(v0, "p")).toContainEqual(["d", "h"]);
    const v1 = edit(v0, "h", { members: [] });
    expect(reachedBy(v1, "p")).not.toContainEqual(["d", "h"]);
    expect(snapshotReaches(v1)).toEqual(snapshotReaches(v1, true));
  });

  it("works it out again when a source linking to a Household changes", () => {
    linkIndexFor([], withHouseholds);
    const v0 = home();
    expect(reachedBy(v0, "p")).toContainEqual(["d", "h"]);
    const v1 = edit(v0, "d", { body: "Not there after all" });
    expect(reachedBy(v1, "p")).not.toContainEqual(["d", "h"]);
    const v2 = edit(v1, "a", { body: "Now at [[Home]]" });
    expect(reachedBy(v2, "p")).toContainEqual(["a", "h"]);
  });

  it("never works it out when no type declares members", () => {
    linkIndexFor([], types);
    const before = viaBuilt();
    expect(linkIndexFor(vault(), types).reaches("p")).toEqual(linkIndexFor(vault(), types).backlinksTo("p"));
    expect(viaBuilt()).toBe(before);
    expect(typeof before).toBe("number");
  });

  function snapshotReaches(docs: Document[], whole = false) {
    const idx = whole ? buildLinkIndex(docs, withHouseholds) : linkIndexFor(docs, withHouseholds);
    return docs.map((d) => idx.reaches(d.id));
  }
});
