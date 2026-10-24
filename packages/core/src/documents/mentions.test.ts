import { describe, expect, it } from "vitest";
import { buildLinkIndex } from "./links";
import { findMentions, linkMentions, planLinkAll, unambiguousHits, unlinkedIn, unlinkedMentionsOf, type MentionName } from "./mentions";
import type { Document, DocumentTypeDef } from "./types";

const T = (id: string, extra: Partial<DocumentTypeDef> = {}): DocumentTypeDef => ({
  id, label: id + "s", titleRule: "name", body: "optional", fields: [], linkable: true, builtIn: true, ...extra,
});
const doc = (id: string, type: string, title: string, body = "", folder = "", extra: Record<string, unknown> = {}): Document => ({
  id, type, title, body, folder, tags: [], createdAt: "2026-01-01", updatedAt: "", deleted: 0, ...extra,
});

const names: MentionName[] = [
  { name: "Alex Doe", canonical: "Alex Doe", targetId: "p1" },
  { name: "Alex", canonical: "Alex Doe", targetId: "p1" },
  { name: "Léa", canonical: "Léa", targetId: "p2" },
  { name: "Dune", canonical: "Books/Dune", targetId: "b1" },
  { name: "A", canonical: "A", targetId: "x" },
];

describe("findMentions", () => {
  it("matches whole words, case- and accent-insensitively, longest name first", () => {
    const body = "Met alex doe and lea; alex again. Dunes are not dune. A.";
    const hits = findMentions(body, names);
    expect(hits.map((h) => [h.text, h.targetId])).toEqual([
      ["alex doe", "p1"],
      ["lea", "p2"],
      ["alex", "p1"],
      ["dune", "b1"],
    ]);
    expect(body.slice(hits[0]!.from, hits[0]!.to)).toBe("alex doe");
    expect(body.slice(hits[3]!.from, hits[3]!.to)).toBe("dune");
  });
  it("keeps offsets right when folding changes string length", () => {
    // decomposed é (2 code units) before the hit; Turkish İ lower-cases to two code units
    const body = "Léa et İ et alex";
    const hits = findMentions(body, names);
    expect(hits.map((h) => body.slice(h.from, h.to))).toEqual(["Léa", "alex"]);
  });
  it("skips existing wikilinks, code, urls and frontmatter", () => {
    const body = "---\ntitle: Alex\n---\n[[Alex]] and [[Alex Doe|alex]] and `alex` and https://alex.example/dune\n\n```\nalex\n```\nbut alex here";
    const hits = findMentions(body, names);
    expect(hits.map((h) => h.text)).toEqual(["alex"]);
    expect(body.slice(hits[0]!.from, hits[0]!.to)).toBe("alex");
  });
  it("offers every Document whose name is at a spot, not only the longest", () => {
    const own: MentionName[] = [
      { name: "Pour Alix", canonical: "Pour Alix", targetId: "essay" },
      { name: "Alix Sintes", canonical: "Alix Sintes", targetId: "alix" },
      { name: "Alix", canonical: "Alix Sintes", targetId: "alix" },
    ];
    const body = "Je m'inquiète pour Alix. Alix Sintes aussi.";
    expect(findMentions(body, own).map((h) => [h.text, h.targetId])).toEqual([
      ["pour Alix", "essay"],
      ["Alix", "alix"],
      ["Alix Sintes", "alix"],
    ]);
  });
  it("offers each Document sharing a name", () => {
    const shared: MentionName[] = [
      { name: "Kraków", canonical: "Kraków", targetId: "place" },
      { name: "Krakow", canonical: "Kraków (note)", targetId: "note" },
    ];
    expect(findMentions("Back in krakow.", shared).map((h) => h.targetId)).toEqual(["place", "note"]);
  });
  it("never suggests one-character names", () => {
    expect(findMentions("A a A", names)).toEqual([]);
  });
});

describe("linkMentions", () => {
  it("writes [[Canonical]] on an exact title, else [[Canonical|text]]", () => {
    const body = "Alex Doe, alex, Dune.";
    const out = linkMentions(body, findMentions(body, names));
    expect(out).toBe("[[Alex Doe]], [[Alex Doe|alex]], [[Books/Dune|Dune]].");
  });
});

describe("unambiguousHits", () => {
  it("keeps the hits no other hit overlaps", () => {
    const own: MentionName[] = [
      { name: "Pour Alix", canonical: "Pour Alix", targetId: "essay" },
      { name: "Alix", canonical: "Alix Sintes", targetId: "alix" },
      { name: "Léa", canonical: "Léa", targetId: "lea" },
    ];
    expect(unambiguousHits(findMentions("pour Alix et Léa", own)).map((h) => h.text)).toEqual(["Léa"]);
  });
});

describe("over the link index", () => {
  const types = [T("note"), T("person"), T("daily", { linkable: { mentions: false } }), T("verse", { linkable: { mentions: false, expand: () => null } }), T("template", { linkable: false }),
    T("version", { internal: true, linkable: false })];
  const docs = [
    doc("p1", "person", "Alex Doe", "Alex is me. See [[Léa]].", "", { aliases: ["Alex"] }),
    doc("p2", "person", "Léa", "Lea knows Alex.", ""),
    doc("d1", "daily", "2026-08-20", "Lunch with alex and Lea. 2026-08-20 was good."),
    doc("v1", "verse", "John 3:16", ""),
    doc("n1", "note", "Verses", "John 3:16 and Alex Doe in [[Alex]] form; Lea again."),
    doc("tpl", "template", "Alex", "alex"),
    doc("ver1", "version", "Snapshot", "Lunch with alex and Lea. 2026-08-20 was good."),
  ];
  const idx = buildLinkIndex(docs, types);

  it("unlinkedIn: names of other Documents found in this body, self excluded", () => {
    expect(unlinkedIn(idx, "p1")).toEqual([]);
    expect(unlinkedIn(idx, "p2").map((h) => [h.text, h.targetId])).toEqual([["Alex", "p1"]]);
    expect(unlinkedIn(idx, "d1").map((h) => [h.text, h.targetId])).toEqual([
      ["alex", "p1"],
      ["Lea", "p2"],
    ]);
  });
  it("unlinkedIn: types with mentions:false are not targets (daily dates, expanded scripture)", () => {
    expect(unlinkedIn(idx, "n1").map((h) => [h.text, h.targetId])).toEqual([
      ["Alex Doe", "p1"],
      ["Lea", "p2"],
    ]);
  });
  it("unlinkedMentionsOf: every other Document mentioning this one (templates are sources, as for backlinks), with context", () => {
    const rows = unlinkedMentionsOf(idx, "p1");
    expect(rows.map((r) => [r.sourceId, r.hit.text])).toEqual([
      ["p2", "Alex"],
      ["d1", "alex"],
      ["n1", "Alex Doe"],
      ["tpl", "alex"],
    ]);
    expect(rows[1]!.context).toContain("Lunch with alex");
    expect(unlinkedMentionsOf(idx, "d1")).toEqual([]);
    expect(unlinkedMentionsOf(idx, "tpl")).toEqual([]);
  });
  it("unlinkedMentionsOf: an internal type's Documents are never a source (a Version repeats its Writing's prose)", () => {
    expect(unlinkedMentionsOf(idx, "p1").map((r) => r.sourceId)).not.toContain("ver1");
    expect(unlinkedMentionsOf(idx, "p2").map((r) => r.sourceId)).not.toContain("ver1");
  });
});

describe("planLinkAll", () => {
  const types = [T("note"), T("person"), T("place"), T("daily", { linkable: { mentions: false } })];
  const docs = [
    doc("anna", "person", "Anna Kowalska", "", "", { aliases: ["Anna"] }),
    doc("annas", "person", "Anna Smith", ""),
    doc("piotr", "person", "Piotr", "", "", { aliases: ["Piotrek"] }),
    doc("krk", "place", "Kraków", ""),
    doc("krk2", "note", "Kraków", ""),
    doc("d1", "daily", "2026-10-01", "Coffee with Anna and piotrek. Then Piotr again."),
    doc("d2", "daily", "2026-10-02", "Anna Smith called. Kraków in the rain."),
    doc("d3", "daily", "2026-10-03", "Dinner with Piotr."),
  ];
  const idx = buildLinkIndex(docs, types);

  it("groups every safe hit by source, so one write per body", () => {
    const plan = planLinkAll(idx, "piotr");
    expect(plan.sources.map((s) => [s.sourceId, s.hits.map((h) => h.text)])).toEqual([
      ["d1", ["piotrek", "Piotr"]],
      ["d3", ["Piotr"]],
    ]);
    expect(plan.skipped).toEqual([]);
  });
  it("leaves a hit covered by another Document's longer name", () => {
    const plan = planLinkAll(idx, "anna");
    expect(plan.sources.map((s) => s.sourceId)).toEqual(["d1"]);
    expect(plan.skipped.map((m) => [m.sourceId, m.hit.text])).toEqual([["d2", "Anna"]]);
  });
  it("leaves a name two Documents share", () => {
    const plan = planLinkAll(idx, "krk");
    expect(plan.sources).toEqual([]);
    expect(plan.skipped.map((m) => m.sourceId)).toEqual(["d2"]);
  });
});
