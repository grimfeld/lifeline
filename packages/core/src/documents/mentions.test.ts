import { describe, expect, it } from "vitest";
import { buildLinkIndex } from "./links";
import { findMentions, linkMentions, unlinkedIn, unlinkedMentionsOf, type MentionName } from "./mentions";
import type { Document, DocumentTypeDef } from "./types";

const T = (id: string, extra: Partial<DocumentTypeDef> = {}): DocumentTypeDef => ({
  id, label: id + "s", titleRule: "name", body: "optional", fields: [], linkable: true, builtIn: true, ...extra,
});
const doc = (id: string, type: string, title: string, body = "", folder = "", extra: Record<string, unknown> = {}): Document => ({
  id, type, title, body, folder, tags: [], createdAt: "2026-01-01", updatedAt: "", deleted: 0, ...extra,
});

const names: MentionName[] = [
  { name: "Alex Doe", canonical: "Alex Doe", targetId: "p1" },
  { name: "Paul", canonical: "Alex Doe", targetId: "p1" },
  { name: "Léa", canonical: "Léa", targetId: "p2" },
  { name: "Dune", canonical: "Books/Dune", targetId: "b1" },
  { name: "A", canonical: "A", targetId: "x" },
];

describe("findMentions", () => {
  it("matches whole words, case- and accent-insensitively, longest name first", () => {
    const body = "Met alex doe and lea; paul again. Dunes are not dune. A.";
    const hits = findMentions(body, names);
    expect(hits.map((h) => [h.text, h.targetId])).toEqual([
      ["alex doe", "p1"],
      ["lea", "p2"],
      ["paul", "p1"],
      ["dune", "b1"],
    ]);
    expect(body.slice(hits[0].from, hits[0].to)).toBe("alex doe");
    expect(body.slice(hits[3].from, hits[3].to)).toBe("dune");
  });
  it("keeps offsets right when folding changes string length", () => {
    // decomposed é (2 code units) before the hit; Turkish İ lower-cases to two code units
    const body = "Léa et İ et paul";
    const hits = findMentions(body, names);
    expect(hits.map((h) => body.slice(h.from, h.to))).toEqual(["Léa", "paul"]);
  });
  it("skips existing wikilinks, code, urls and frontmatter", () => {
    const body = "---\ntitle: Paul\n---\n[[Paul]] and [[Alex Doe|paul]] and `paul` and https://paul.example/dune\n\n```\npaul\n```\nbut paul here";
    const hits = findMentions(body, names);
    expect(hits.map((h) => h.text)).toEqual(["paul"]);
    expect(body.slice(hits[0].from, hits[0].to)).toBe("paul");
  });
  it("never suggests one-character names", () => {
    expect(findMentions("A a A", names)).toEqual([]);
  });
});

describe("linkMentions", () => {
  it("writes [[Canonical]] on an exact title, else [[Canonical|text]]", () => {
    const body = "Alex Doe, paul, Dune.";
    const out = linkMentions(body, findMentions(body, names));
    expect(out).toBe("[[Alex Doe]], [[Alex Doe|paul]], [[Books/Dune|Dune]].");
  });
});

describe("over the link index", () => {
  const types = [T("note"), T("person"), T("daily", { linkable: { mentions: false } }), T("verse", { linkable: { mentions: false, expand: () => null } }), T("template", { linkable: false })];
  const docs = [
    doc("p1", "person", "Alex Doe", "Paul is me. See [[Léa]].", "", { aliases: ["Paul"] }),
    doc("p2", "person", "Léa", "Lea knows Paul.", ""),
    doc("d1", "daily", "2026-08-20", "Lunch with paul and Lea. 2026-08-20 was good."),
    doc("v1", "verse", "John 3:16", ""),
    doc("n1", "note", "Verses", "John 3:16 and Alex Doe in [[Paul]] form; Lea again."),
    doc("tpl", "template", "Paul", "paul"),
  ];
  const idx = buildLinkIndex(docs, types);

  it("unlinkedIn: names of other Documents found in this body, self excluded", () => {
    expect(unlinkedIn(idx, "p1")).toEqual([]);
    expect(unlinkedIn(idx, "p2").map((h) => [h.text, h.targetId])).toEqual([["Paul", "p1"]]);
    expect(unlinkedIn(idx, "d1").map((h) => [h.text, h.targetId])).toEqual([
      ["paul", "p1"],
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
      ["p2", "Paul"],
      ["d1", "paul"],
      ["n1", "Alex Doe"],
      ["tpl", "paul"],
    ]);
    expect(rows[1].context).toContain("Lunch with paul");
    expect(unlinkedMentionsOf(idx, "d1")).toEqual([]);
    expect(unlinkedMentionsOf(idx, "tpl")).toEqual([]);
  });
});
