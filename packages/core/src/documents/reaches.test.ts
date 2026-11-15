import { describe, expect, it } from "vitest";
import { buildLinkIndex } from "./links";
import { mentionDays, seenDays } from "./reports";
import type { Document, DocumentTypeDef } from "./types";

/**
 * "Reaches" (ADR 0117): what links to a Document, plus what links to a
 * Document it is a member of — a Household's links count for its members.
 */
const T = (id: string, extra: Partial<DocumentTypeDef> = {}): DocumentTypeDef => ({
  id, label: id + "s", titleRule: "name", body: "optional", fields: [], linkable: true, builtIn: true, ...extra,
});
type M = { personId: string; since?: string; until?: string };
const on = (m: M, day: string) => (!m.since || m.since <= day) && (!m.until || day <= m.until);
const types = [
  T("person"),
  T("note"),
  T("daily", { titleRule: "date", linkable: { mentions: false } }),
  T("event", { body: "none", fields: [{ key: "notes", label: "Notes", kind: "longtext" }, { key: "with", label: "With", kind: "links" }], linkingText: ["notes"] }),
  T("household", { linkable: { members: (doc, day) => ((doc.members ?? []) as M[]).filter((m) => on(m, day)).map((m) => m.personId) } }),
];
const doc = (id: string, type: string, title: string, body = "", extra: Record<string, unknown> = {}): Document => ({
  id, type, title, body, folder: "", tags: [], createdAt: "2026-01-01", updatedAt: "", deleted: 0, ...extra,
});
const docs = [
  doc("paul", "person", "Paul"),
  doc("mary", "person", "Mary"),
  doc("tom", "person", "Tom"),
  // Tom moved out at the end of June; Mary joined in March.
  doc("smiths", "household", "the Smiths", "", { members: [{ personId: "paul" }, { personId: "mary", since: "2026-03-01" }, { personId: "tom", until: "2026-06-30" }] }),
  doc("d1", "daily", "2026-02-01", "Dinner at [[the Smiths]]"),
  doc("d2", "daily", "2026-08-01", "At [[the Smiths]] with [[Tom]]"),
  doc("d3", "daily", "2026-08-02", "[[the Smiths]] again, twice: [[the Smiths]]"),
  doc("e1", "event", "Weekend", "", { date: "2026-06-29", endDate: "2026-07-02", notes: "at [[the Smiths]]" }),
  doc("n1", "note", "Gift list", "for [[the Smiths]]"),
];
const idx = buildLinkIndex(docs, types);
const via = (id: string) => idx.reaches(id).map((r) => [r.sourceId, r.via, r.days]);

describe("reaches", () => {
  it("is a Document's backlinks plus those of the Documents it is a member of, marked with what they came via", () => {
    expect(via("paul")).toEqual([
      ["d1", "smiths", ["2026-02-01"]],
      ["d2", "smiths", ["2026-08-01"]],
      ["d3", "smiths", ["2026-08-02"]],
      ["e1", "smiths", ["2026-06-29", "2026-06-30", "2026-07-01", "2026-07-02"]],
      ["n1", "smiths", undefined],
    ]);
  });
  it("counts a link for whoever was a member on the source's date", () => {
    expect(via("mary").map((r) => r[0])).toEqual(["d2", "d3", "e1"]);
    expect(via("tom")).toEqual([
      ["d2", undefined, undefined],
      ["d1", "smiths", ["2026-02-01"]],
      ["e1", "smiths", ["2026-06-29", "2026-06-30"]],
    ]);
  });
  it("lets a dateless source count only for members with neither bound", () => {
    expect(idx.reaches("paul").some((r) => r.sourceId === "n1")).toBe(true);
    expect(idx.reaches("mary").some((r) => r.sourceId === "n1")).toBe(false);
    expect(idx.reaches("tom").some((r) => r.sourceId === "n1")).toBe(false);
  });
  it("names a source that links directly once, as the direct link", () => {
    const tom = idx.reaches("tom").filter((r) => r.sourceId === "d2");
    expect(tom).toHaveLength(1);
    expect(tom[0]!.via).toBeUndefined();
  });
  it("leaves backlinksTo as it was", () => {
    expect(idx.backlinksTo("paul")).toEqual([]);
    expect(idx.backlinksTo("tom").map((b) => b.sourceId)).toEqual(["d2"]);
    expect(idx.backlinksTo("smiths").map((b) => b.sourceId)).toEqual(["d1", "d2", "d3", "d3", "e1", "n1"]);
  });
  it("is a Document's backlinks alone for a type with no members", () => {
    expect(idx.reaches("smiths").map((r) => r.sourceId)).toEqual(idx.backlinksTo("smiths").map((b) => b.sourceId));
  });
});

describe("Mentioned and Seen through a Household", () => {
  it("count the Days that link to a member's Household, once per day", () => {
    expect(mentionDays(idx, "paul")).toEqual(["2026-02-01", "2026-08-01", "2026-08-02"]);
    expect(mentionDays(idx, "mary")).toEqual(["2026-08-01", "2026-08-02"]);
    expect(mentionDays(idx, "tom")).toEqual(["2026-02-01", "2026-08-01"]);
  });
  it("count an Event's days only while they were a member", () => {
    expect(seenDays(idx, "paul", "2026-12-31")).toEqual(["2026-06-29", "2026-06-30", "2026-07-01", "2026-07-02"]);
    expect(seenDays(idx, "tom", "2026-12-31")).toEqual(["2026-06-29", "2026-06-30"]);
    expect(seenDays(idx, "mary", "2026-07-01")).toEqual(["2026-06-29", "2026-06-30", "2026-07-01"]);
  });
});
