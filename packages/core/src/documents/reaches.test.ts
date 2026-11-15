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
const spans = (d: Document) => ((d.members ?? []) as M[]).map(({ personId, ...days }) => ({ id: personId, ...days }));
const types = [
  T("person"),
  T("note"),
  T("daily", { titleRule: "date", linkable: { mentions: false } }),
  T("event", { body: "none", fields: [{ key: "notes", label: "Notes", kind: "longtext" }, { key: "with", label: "With", kind: "links" }], linkingText: ["notes"] }),
  T("household", { linkable: { members: spans } }),
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

describe("reaches through two Households", () => {
  // Ann lives at the Smiths' and keeps a flat in town with Bob; a Day names both.
  const two = buildLinkIndex(
    [
      doc("ann", "person", "Ann"),
      doc("bob", "person", "Bob"),
      doc("home", "household", "Home", "", { members: [{ personId: "ann" }] }),
      doc("flat", "household", "Flat", "", { members: [{ personId: "ann" }, { personId: "bob" }] }),
      doc("w1", "event", "Week away", "", { date: "2026-05-01", endDate: "2026-05-02", notes: "[[Home]] and [[Flat]]" }),
      doc("d9", "daily", "2026-05-03", "Saw [[Flat]] then [[Home]]"),
    ],
    types,
  );
  it("names each source once, through the first of their Households", () => {
    expect(two.reaches("ann").map((r) => [r.sourceId, r.via])).toEqual([
      ["w1", "home"],
      ["d9", "home"],
    ]);
  });
  it("keeps every day the source counts for them", () => {
    expect(two.reaches("ann").find((r) => r.sourceId === "w1")?.days).toEqual(["2026-05-01", "2026-05-02"]);
    expect(seenDays(two, "ann", "2026-12-31")).toEqual(["2026-05-01", "2026-05-02"]);
  });
});

describe("reaches through two Households in turn", () => {
  // Cat lived at the Old house until 1 May and at the New house from 2 May; one Event spans the move.
  const moved = buildLinkIndex(
    [
      doc("cat", "person", "Cat"),
      doc("old", "household", "Old house", "", { members: [{ personId: "cat", until: "2026-05-01" }] }),
      doc("new", "household", "New house", "", { members: [{ personId: "cat", since: "2026-05-02" }] }),
      doc("mv", "event", "Moving", "", { date: "2026-05-01", endDate: "2026-05-02", notes: "[[Old house]] to [[New house]]" }),
    ],
    types,
  );
  it("counts the days through each, as one reach", () => {
    expect(moved.reaches("cat").map((r) => [r.sourceId, r.via, r.days])).toEqual([["mv", "old", ["2026-05-01", "2026-05-02"]]]);
    expect(seenDays(moved, "cat", "2026-12-31")).toEqual(["2026-05-01", "2026-05-02"]);
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

describe("a long Event linking a Household", () => {
  // Ten years at the Smiths': who they stand for is read once per Household, not once per day.
  let reads = 0;
  const counted = T("household", {
    linkable: {
      members: (d: Document) => {
        reads++;
        return spans(d);
      },
    },
  });
  const long = buildLinkIndex(
    [
      doc("paul", "person", "Paul"),
      doc("tom", "person", "Tom"),
      doc("smiths", "household", "the Smiths", "", { members: [{ personId: "paul" }, { personId: "tom", until: "2016-01-02" }] }),
      doc("dec", "event", "A decade", "", { date: "2016-01-01", endDate: "2025-12-31", notes: "at [[the Smiths]]" }),
    ],
    [...types.filter((t) => t.id !== "household"), counted],
  );
  it("reads the members once, and keeps every day for whoever has no bounds", () => {
    reads = 0;
    const paul = long.reaches("paul");
    expect(reads).toBe(1);
    expect(paul[0]!.days).toHaveLength(3653);
    expect(long.reaches("tom")[0]!.days).toEqual(["2016-01-01", "2016-01-02"]);
  });
});
