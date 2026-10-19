import { describe, expect, it } from "vitest";
import { buildLinkIndex } from "./links";
import { DEFAULT_REPORTS, documentFigures, mentionDays, notMentionedSince, rankingRows, reportsIn, reportsOf, topMentioned } from "./reports";
import type { Document, DocumentTypeDef } from "./types";

const T = (id: string, extra: Partial<DocumentTypeDef> = {}): DocumentTypeDef => ({
  id, label: id + "s", titleRule: "name", body: "optional", fields: [], linkable: true, builtIn: true, ...extra,
});
const doc = (id: string, type: string, title: string, body = ""): Document => ({
  id, type, title, body, folder: "", tags: [], createdAt: "2026-01-01", updatedAt: "", deleted: 0,
});

const types = [T("person"), T("place"), T("note"), T("daily", { titleRule: "date", linkable: { mentions: false } }), T("month", { linkable: { mentions: false } })];
const docs = [
  doc("anna", "person", "Anna"),
  doc("piotr", "person", "Piotr"),
  doc("ola", "person", "Ola"),
  doc("krk", "place", "Kraków"),
  doc("d1", "daily", "2025-12-30", "[[Piotr]]"),
  doc("d2", "daily", "2026-10-01", "[[Anna]] and [[Anna]] again, in [[Kraków]]"),
  doc("d3", "daily", "2026-10-05", "[[Anna]], [[Piotr]]"),
  doc("d4", "daily", "2026-10-18", "[[Anna]]"),
  doc("m1", "month", "2026-10", "[[Anna]] [[Ola]] all month"),
  doc("n1", "note", "Notes", "[[Ola]] [[Anna]]"),
];
const idx = buildLinkIndex(docs, types);

describe("mentionDays", () => {
  it("counts each linking Day once, and nothing but Days", () => {
    expect(mentionDays(idx, "anna")).toEqual(["2026-10-01", "2026-10-05", "2026-10-18"]);
    expect(mentionDays(idx, "ola")).toEqual([]);
  });
});

describe("topMentioned", () => {
  it("ranks a type's Documents by linking Days in the window, leaving out the unmentioned", () => {
    expect(topMentioned(idx, "person").map((r) => [r.docId, r.count, r.last])).toEqual([
      ["anna", 3, "2026-10-18"],
      ["piotr", 2, "2026-10-05"],
    ]);
    expect(topMentioned(idx, "person", { from: "2026-10-02", to: "2026-10-10" }).map((r) => [r.docId, r.count])).toEqual([
      ["anna", 1],
      ["piotr", 1],
    ]);
  });
});

describe("notMentionedSince", () => {
  it("lists what some Day linked to but none lately, longest silence first", () => {
    expect(notMentionedSince(idx, "person", 10, "2026-10-18").map((r) => [r.docId, r.last])).toEqual([["piotr", "2026-10-05"]]);
    expect(notMentionedSince(idx, "person", 400, "2026-10-18")).toEqual([]);
  });
});

describe("rankingRows", () => {
  it("cuts to the setting's N", () => {
    expect(rankingRows(idx, "person", { kind: "top", n: 1 }, {}, "2026-10-18").map((r) => r.docId)).toEqual(["anna"]);
  });
});

describe("documentFigures", () => {
  it("gives last mentioned, days since, this year and all time", () => {
    const f = documentFigures(idx, "piotr", "2026-10-18");
    expect([f.last, f.sinceLast, f.thisYear, f.allTime]).toEqual(["2026-10-05", 13, 1, 2]);
    expect(documentFigures(idx, "ola", "2026-10-18").last).toBeUndefined();
  });
});

describe("reportsOf", () => {
  it("defaults a mentionable type, keeps its own choice, and gives Days and periods none", () => {
    expect(reportsOf(T("person"))).toEqual(DEFAULT_REPORTS);
    expect(reportsOf(T("person", { reports: [{ kind: "heatmap" }] }))).toEqual([{ kind: "heatmap" }]);
    expect(reportsOf(types[3])).toEqual([]);
    expect(reportsOf(T("template", { linkable: false }))).toEqual([]);
    expect(reportsIn(T("person"), "document")).toEqual([{ kind: "last" }]);
  });
});
