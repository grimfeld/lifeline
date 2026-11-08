import { describe, expect, it } from "vitest";
import { formatHuman } from "../dates";
import { buildLinkIndex } from "./links";
import { DEFAULT_REPORTS, agoText, documentFigures, lastText, reportWords, mentionDays, notMentionedSince, rankingRows, seenDays, sourceOf, reportsIn, reportsOf, topMentioned } from "./reports";
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

describe("a days source", () => {
  // A stand-in for a second family: Ola is on two days, nobody else on any.
  const other = (_i: unknown, docId: string) => (docId === "ola" ? ["2026-09-01", "2026-09-02"] : []);
  it("feeds the same kinds in place of the Days that link", () => {
    expect(topMentioned(idx, "person", {}, other).map((r) => [r.docId, r.count, r.last])).toEqual([["ola", 2, "2026-09-02"]]);
    expect(notMentionedSince(idx, "person", 30, "2026-10-18", other).map((r) => r.docId)).toEqual(["ola"]);
    expect(rankingRows(idx, "person", { kind: "top", n: 5 }, {}, "2026-10-18", other).map((r) => r.docId)).toEqual(["ola"]);
    expect(documentFigures(idx, "ola", "2026-10-18", other)).toMatchObject({ last: "2026-09-02", allTime: 2, thisYear: 2 });
  });
});

describe("Seen (ADR 0112)", () => {
  // Real Events: no body, their wikilinks in Notes (a linking text Field).
  const ev = (id: string, title: string, date: string, notes: string, endDate: string | null = null): Document =>
    ({ ...doc(id, "event", title), body: undefined, notes, date, endDate }) as unknown as Document;
  const eventType = T("event", { body: "none", linkingText: ["notes"], fields: [{ key: "notes", label: "Notes", kind: "longtext" }] });
  const task = { ...doc("t1", "task", "Call Marc", "[[Marc]]"), date: "2026-10-02" } as unknown as Document;
  const marker = { ...doc("o1", "occasion", "Birthday", "[[Marc]]"), date: "2026-10-03" } as unknown as Document;
  const seenTypes = [T("person"), eventType, T("task"), T("occasion"), T("daily", { titleRule: "date", linkable: { mentions: false } })];
  const seenDocs = [
    doc("marc", "person", "Marc"),
    doc("jo", "person", "Jo"),
    ev("e1", "Lunch", "2026-10-01", "with [[Marc]]"),
    ev("e2", "Dinner", "2026-10-01", "[[Marc]] again"),
    ev("e3", "Trip", "2026-10-10", "[[Marc]] and [[Jo]]", "2026-10-12"),
    ev("e4", "Tomorrow", "2026-10-19", "[[Marc]]"),
    doc("d1", "daily", "2026-10-01", "[[Marc]]"),
    task,
    marker,
  ];
  const sidx = buildLinkIndex(seenDocs, seenTypes);
  const today = "2026-10-18";

  it("counts a day once however many Events link, each day of a span, and nothing in the future", () => {
    expect(seenDays(sidx, "marc", today)).toEqual(["2026-10-01", "2026-10-10", "2026-10-11", "2026-10-12"]);
    expect(seenDays(sidx, "marc", "2026-10-11")).toEqual(["2026-10-01", "2026-10-10", "2026-10-11"]);
  });
  it("reads an Event whose end is before its start as on its start day", () => {
    const backwards = buildLinkIndex([doc("marc", "person", "Marc"), ev("e1", "Typo", "2026-10-05", "[[Marc]]", "2026-10-02")], seenTypes);
    expect(seenDays(backwards, "marc", today)).toEqual(["2026-10-05"]);
  });
  it("stops counting a runaway Event after ten years of days", () => {
    const runaway = buildLinkIndex([doc("marc", "person", "Marc"), ev("e1", "Typo", "2000-01-01", "[[Marc]]", "2099-01-01")], seenTypes);
    const days = seenDays(runaway, "marc", today);
    expect([days.length, days[0], days.at(-1)]).toEqual([3660, "2000-01-01", "2010-01-07"]);
  });
  it("keeps Seen and Mentioned apart, and counts a group Event for each Person", () => {
    expect(mentionDays(sidx, "marc")).toEqual(["2026-10-01"]);
    expect(seenDays(sidx, "jo", today)).toEqual(["2026-10-10", "2026-10-11", "2026-10-12"]);
  });
  it("leaves Tasks and markers out", () => {
    expect(seenDays(buildLinkIndex([doc("marc", "person", "Marc"), task, marker], seenTypes), "marc", today)).toEqual([]);
  });
  it("leaves the People fields (a Task's For, a Transaction's For, a Work's Recommended by) out", () => {
    const peopleField = (key: string) => ({ key, label: key, kind: "links" as const, linkType: "person" });
    const fieldTypes = [
      T("person"),
      T("task", { fields: [peopleField("for")] }),
      T("ledger_transaction", { fields: [peopleField("for")] }),
      T("book", { fields: [peopleField("recommendedBy")] }),
      T("event", { fields: [peopleField("with")] }),
    ];
    const dated = (id: string, type: string, key: string, date: string) => ({ ...doc(id, type, id), [key]: ["marc"], date }) as unknown as Document;
    const people = [
      doc("marc", "person", "Marc"),
      dated("t2", "task", "for", "2026-10-02"),
      dated("x1", "ledger_transaction", "for", "2026-10-04"),
      dated("b1", "book", "recommendedBy", "2026-10-06"),
    ];
    const fidx = buildLinkIndex(people, fieldTypes);
    // The links exist (they feed the index and the Person page)…
    expect(fidx.backlinksTo("marc").map((b) => [b.sourceId, b.field]).sort()).toEqual([["b1", "recommendedBy"], ["t2", "for"], ["x1", "for"]]);
    // …but none counts as Seen, and an Event's With still does.
    expect(seenDays(fidx, "marc", today)).toEqual([]);
    expect(rankingRows(fidx, "person", { kind: "topSeen", n: 5 }, {}, today)).toEqual([]);
    const withEvent = buildLinkIndex([...people, { ...doc("e9", "event", "Dinner"), date: "2026-10-07", endDate: null, with: ["marc"] } as unknown as Document], fieldTypes);
    expect(seenDays(withEvent, "marc", today)).toEqual(["2026-10-07"]);
  });
  it("ranks Top seen and Not seen in N days over a window", () => {
    const top = rankingRows(sidx, "person", { kind: "topSeen", n: 5 }, {}, today);
    expect(top.map((r) => [r.docId, r.count, r.last])).toEqual([["marc", 4, "2026-10-12"], ["jo", 3, "2026-10-12"]]);
    expect(rankingRows(sidx, "person", { kind: "topSeen" }, { to: "2026-10-05" }, today).map((r) => [r.docId, r.count])).toEqual([["marc", 1]]);
    expect(rankingRows(sidx, "person", { kind: "quietSeen", days: 5 }, {}, today).map((r) => r.docId).sort()).toEqual(["jo", "marc"]);
    expect(rankingRows(sidx, "person", { kind: "quietSeen", days: 7 }, {}, today).map((r) => r.docId)).toEqual([]);
  });
  it("gives the per-Document figures", () => {
    const f = documentFigures(sidx, "marc", today, sourceOf("seen", today));
    expect([f.last, f.sinceLast, f.thisYear, f.allTime]).toEqual(["2026-10-12", 6, 4, 4]);
  });
  it("offers a Person Last seen and Last mentioned by default", () => {
    expect(reportsOf(T("person", { reports: [{ kind: "lastSeen" }, { kind: "last" }] })).map((r) => r.kind)).toEqual(["lastSeen", "last"]);
  });
});

describe("a Report's words", () => {
  it("counts Days for Mentioned and days seen for Seen, and names what links", () => {
    expect([reportWords("mentioned"), reportWords("seen")]).toEqual([
      { count: "Days", heatmap: "Days", linker: "Day" },
      { count: "Seen", heatmap: "days seen", linker: "Event" },
    ]);
  });
  it("says how long ago in days", () => {
    expect([agoText(-1), agoText(0), agoText(1), agoText(12)]).toEqual(["today", "today", "yesterday", "12 days ago"]);
  });
  it("says the last day and how long ago, or never", () => {
    const f = documentFigures(idx, "ola", "2026-10-18", () => ["2026-10-15"]);
    expect([lastText(f), lastText(documentFigures(idx, "ola", "2026-10-18", () => []))]).toEqual([`${formatHuman("2026-10-15")} · 3 days ago`, "never"]);
  });
});
