import { describe, expect, it } from "vitest";
import { formatHuman } from "../dates";
import { buildLinkIndex } from "./links";
import { DEFAULT_REPORTS, REPORT_KINDS, agoText, periodReportsOf, reportLabel, seenSummary, documentFigures, lastText, reportWords, mentionDays, notMentionedSince, rankingRows, seenDays, sourceOf, talkedDays, lastTalkedExchange, reportsIn, reportsOf, topMentioned } from "./reports";
import type { Document, DocumentTypeDef } from "./types";
import { PERSON_TYPE } from "../people";
import { EXCHANGE_TYPE } from "./sourceDays";
import { PLACE_TYPE } from "../places";

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
  it("counts an Event's At toward a Place but never toward a Person, while With and notes still count (ADR 0128)", () => {
    const atTypes = [
      T(PERSON_TYPE),
      T(PLACE_TYPE),
      T("event", {
        body: "none",
        linkingText: ["notes"],
        fields: [
          { key: "notes", label: "Notes", kind: "longtext" },
          { key: "with", label: "With", kind: "links", linkType: PERSON_TYPE },
          { key: "at", label: "At", kind: "link", linkType: [PLACE_TYPE, PERSON_TYPE] },
        ],
      }),
    ];
    const event = (id: string, date: string, at: string, withIds: string[], notes = "") => ({ ...doc(id, "event", id), body: undefined, date, endDate: null, at, with: withIds, notes }) as unknown as Document;
    const atIdx = buildLinkIndex(
      [
        doc("marc", PERSON_TYPE, "Marc"),
        doc("anne", PERSON_TYPE, "Anne"),
        doc("janou", PLACE_TYPE, "Chez Janou"),
        // Feeding Marc's cat while he is away: At Marc, Marc not With.
        event("cat", "2026-11-03", "marc", []),
        // Dinner with Anne at Chez Janou.
        event("dinner", "2026-11-10", "janou", ["anne"]),
        // At Anne's and With her: With counts.
        event("tea", "2026-11-12", "anne", ["anne"]),
        // At Marc's, Marc only named in the notes: the wikilink counts.
        event("party", "2026-11-13", "marc", [], "[[Marc]]'s birthday"),
      ],
      atTypes,
    );
    const on = "2026-11-15";
    expect(seenDays(atIdx, "marc", on)).toEqual(["2026-11-13"]);
    expect(seenDays(atIdx, "anne", on)).toEqual(["2026-11-10", "2026-11-12"]);
    expect(seenDays(atIdx, "janou", on)).toEqual(["2026-11-10"]);
    // The At link is still a backlink: Marc's page lists the Event.
    expect(atIdx.backlinksTo("marc").map((b) => [b.sourceId, b.field ?? "notes"]).sort()).toEqual([["cat", "at"], ["party", "at"], ["party", "notes"]]);
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

describe("Talked (ADR 0131)", () => {
  type M = { personId: string; since?: string; until?: string };
  const spans = (d: Document) => ((d.members ?? []) as M[]).map(({ personId, ...days }) => ({ id: personId, ...days }));
  const talkTypes = [
    T("person"),
    T("household", { linkable: { members: spans } }),
    T("daily", { titleRule: "date", linkable: { mentions: false } }),
    T("event", { body: "none", fields: [{ key: "with", label: "With", kind: "links", linkType: ["person", "household"] }] }),
    T(EXCHANGE_TYPE, { titleRule: "derived", linkable: false, fields: [{ key: "date", label: "Day", kind: "date" }, { key: "with", label: "With", kind: "links", linkType: ["person", "household"] }] }),
  ];
  const x = (id: string, date: string, withIds: string[], body = "") => ({ ...doc(id, EXCHANGE_TYPE, `Call · ${id}`, body), kind: "call", date, with: withIds }) as unknown as Document;
  const today = "2026-10-18";
  const talkDocs = [
    doc("gran", "person", "Gran"),
    doc("lucie", "person", "Lucie"),
    doc("paul", "person", "Paul"),
    doc("tom", "person", "Tom"),
    // Tom moved out at the end of June.
    { ...doc("smiths", "household", "the Smiths"), members: [{ personId: "paul" }, { personId: "tom", until: "2026-06-30" }] } as unknown as Document,
    x("x1", "2026-10-01", ["gran"], "She told me about [[Lucie]]"),
    x("x2", "2026-10-01", ["gran"]),
    x("x3", "2026-10-11", ["gran"]),
    x("x4", "2026-10-25", ["gran"]),
    x("x5", "2026-06-15", ["smiths"]),
    x("x6", "2026-08-15", ["smiths"], "and [[the Smiths]] again"),
    { ...doc("e1", "event", "Lunch"), body: undefined, date: "2026-10-12", endDate: null, with: ["gran"] } as unknown as Document,
    doc("d1", "daily", "2026-10-13", "[[Gran]]"),
  ];
  const tidx = buildLinkIndex(talkDocs, talkTypes);

  it("counts an Exchange's day once however many there are, and nothing in the future", () => {
    expect(talkedDays(tidx, "gran", today)).toEqual(["2026-10-01", "2026-10-11"]);
    expect(talkedDays(tidx, "gran", "2026-10-30")).toEqual(["2026-10-01", "2026-10-11", "2026-10-25"]);
  });
  it("counts through With only: a wikilink in the body is a Backlink, not talking to them", () => {
    expect(tidx.backlinksTo("lucie").map((b) => b.sourceId)).toEqual(["x1"]);
    expect(talkedDays(tidx, "lucie", today)).toEqual([]);
  });
  it("keeps Talked apart from Seen and Mentioned", () => {
    expect(seenDays(tidx, "gran", today)).toEqual(["2026-10-12"]);
    expect(mentionDays(tidx, "gran")).toEqual(["2026-10-13"]);
  });
  it("counts a Household in With for whoever was a member that day (ADR 0117)", () => {
    expect(talkedDays(tidx, "paul", today)).toEqual(["2026-06-15", "2026-08-15"]);
    expect(talkedDays(tidx, "tom", today)).toEqual(["2026-06-15"]);
    expect(talkedDays(tidx, "smiths", today)).toEqual(["2026-06-15", "2026-08-15"]);
  });
  it("feeds the kinds and figures through its source", () => {
    expect(documentFigures(tidx, "gran", today, sourceOf("talked", today))).toMatchObject({ last: "2026-10-11", allTime: 2 });
    expect(reportWords("talked")).toEqual({ count: "Talked", heatmap: "days talked", linker: "Exchange" });
  });
  it("mirrors Seen's kinds one for one in the catalogue, so the Reports editor offers them", () => {
    const talked = REPORT_KINDS.filter((k) => k.source === "talked").map((k) => [k.kind, k.label, k.shape]);
    expect(talked).toEqual([
      ["topTalked", "Top talked", "top"],
      ["quietTalked", "Not talked lately", "quiet"],
      ["lastTalked", "Last talked", "last"],
      ["talkedCount", "Talked count", "count"],
      ["talkedHeatmap", "Talked heatmap", "heatmap"],
    ]);
  });
  it("finds the newest Exchange that counts, none to come, none through a body link or a Household they had left", () => {
    expect(lastTalkedExchange(tidx, "gran", today)?.id).toBe("x3");
    expect(lastTalkedExchange(tidx, "gran", "2026-10-30")?.id).toBe("x4");
    expect(lastTalkedExchange(tidx, "lucie", today)).toBeUndefined();
    expect(lastTalkedExchange(tidx, "tom", today)?.id).toBe("x5");
    expect(lastTalkedExchange(tidx, "paul", today)?.id).toBe("x6");
  });
  it("ranks Top talked and Not talked in N days", () => {
    expect(rankingRows(tidx, "person", { kind: "topTalked" }, {}, today).map((r) => [r.docId, r.count])).toEqual([["gran", 2], ["paul", 2], ["tom", 1]]);
    expect(rankingRows(tidx, "person", { kind: "quietTalked", days: 30 }, {}, today).map((r) => r.docId)).toEqual(["tom", "paul"]);
  });
});

describe("Visited: a Place's Seen (ADR 0128)", () => {
  const placeType = T(PLACE_TYPE, { seenAs: { verb: "visited", one: "visit", many: "visits" }, reports: [{ kind: "lastSeen" }, { kind: "seenCount" }, { kind: "last" }] });
  const visitTypes = [
    placeType,
    T("daily", { titleRule: "date", linkable: { mentions: false } }),
    T("event", {
      body: "none",
      linkingText: ["notes"],
      fields: [
        { key: "notes", label: "Notes", kind: "longtext" },
        { key: "at", label: "At", kind: "link", linkType: [PLACE_TYPE, PERSON_TYPE] },
      ],
    }),
  ];
  type Ev = { date: string; endDate?: string | null; end?: string; at?: string; notes?: string };
  const event = (id: string, e: Ev) => ({ ...doc(id, "event", id), body: undefined, endDate: null, notes: "", ...e }) as unknown as Document;
  const janou = doc("janou", PLACE_TYPE, "Chez Janou");
  const visited = (docs: Document[], on = "2026-11-15") => seenSummary(documentFigures(buildLinkIndex([janou, ...docs], visitTypes), "janou", on, sourceOf("seen", on)), placeType);

  it("shows an Event At Chez Janou on 10 Nov as its last visit, and a future Event not at all", () => {
    expect(visited([event("dinner", { date: "2026-11-10", at: "janou" }), event("booked", { date: "2026-11-20", at: "janou" })])).toBe(`Last visited ${formatHuman("2026-11-10")} · 1 visit`);
    expect(visited([event("booked", { date: "2026-11-20", at: "janou" })])).toBe("Not visited yet");
  });
  it("counts each day of a two-day Event, and two Events on one day once", () => {
    expect(visited([event("weekend", { date: "2026-11-07", endDate: "2026-11-08", at: "janou" })])).toBe(`Last visited ${formatHuman("2026-11-08")} · 2 visits`);
    expect(visited([event("lunch", { date: "2026-11-10", at: "janou" }), event("drinks", { date: "2026-11-10", notes: "after, [[Chez Janou]]" })])).toBe(`Last visited ${formatHuman("2026-11-10")} · 1 visit`);
  });
  it("reads an Event that ends at midnight as over the day before (ADR 0090)", () => {
    expect(visited([event("late", { date: "2026-11-10", endDate: "2026-11-11", end: "00:00", at: "janou" })])).toBe(`Last visited ${formatHuman("2026-11-10")} · 1 visit`);
  });
  it("keeps Mentioned apart from Visited, never added to it", () => {
    const docs = [event("dinner", { date: "2026-11-10", at: "janou" }), doc("d1", "daily", "2026-11-12", "back at [[Chez Janou]]")];
    const vidx = buildLinkIndex([janou, ...docs], visitTypes);
    expect(visited(docs)).toBe(`Last visited ${formatHuman("2026-11-10")} · 1 visit`);
    expect(documentFigures(vidx, "janou", "2026-11-15", sourceOf("mentioned", "2026-11-15")).allTime).toBe(1);
  });
  it("rolls up Top visited on a Journal period beside Top mentioned, and nothing a type didn't choose", () => {
    const both = T(PLACE_TYPE, { reports: [{ kind: "lastSeen" }, { kind: "topSeen", n: 3 }, { kind: "top" }, { kind: "quietSeen" }] });
    expect(periodReportsOf(both).map((r) => [r.kind, r.n])).toEqual([["top", undefined], ["topSeen", 3]]);
    expect(periodReportsOf(T("person", { reports: [{ kind: "lastSeen" }, { kind: "last" }] }))).toEqual([]);
    expect(periodReportsOf(T("note")).map((r) => r.kind)).toEqual(["top"]);
  });
  it("names the Seen Reports Visited for a Place, and Seen for any other type", () => {
    expect(["lastSeen", "seenCount", "topSeen", "quietSeen", "seenHeatmap", "last"].map((k) => reportLabel(k as never, placeType))).toEqual(["Last visited", "Visits", "Top visited", "Not visited lately", "Visited heatmap", "Last mentioned"]);
    expect(["lastSeen", "seenCount", "topSeen"].map((k) => reportLabel(k as never, T("person")))).toEqual(["Last seen", "Seen count", "Top seen"]);
    expect([reportWords("seen", placeType), reportWords("seen", T("person"))]).toEqual([
      { count: "Visits", heatmap: "days visited", linker: "Event" },
      { count: "Seen", heatmap: "days seen", linker: "Event" },
    ]);
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
