import { describe, expect, it } from "vitest";
import { buildLinkIndex, type Document, type DocumentTypeDef } from "@lifeline/core";
import { exchangeTypeDef, householdTypeDef, personTypeDef } from "../types";
import { driftLine, driftingFrom, groupByRelationship, lastDays, lastTouches, type DriftSource } from "./drifting";
import type { Person } from "./types";

const base = { folder: "", tags: [], createdAt: "2026-01-01", updatedAt: "", deleted: 0 as const };
const P = (title: string, more: Partial<Person> = {}): Person =>
  ({ ...base, id: title, type: "contacts_person", title, body: "", aliases: [], relationship: "friend", ...more }) as unknown as Person;
// A real Event: no body, its wikilinks in Notes.
const ev = (id: string, date: string, notes: string, endDate?: string): Document => ({ ...base, id, type: "event", title: id, notes, date, endDate }) as unknown as Document;
const day = (date: string, body: string): Document => ({ ...base, id: `d${date}`, type: "daily", title: date, body });
const types: DocumentTypeDef[] = [
  personTypeDef,
  { id: "event", label: "Events", titleRule: "name", body: "none", fields: [{ key: "notes", label: "Notes", kind: "longtext" }], linkingText: ["notes"], builtIn: true },
  { id: "daily", label: "Days", titleRule: "date", body: "optional", fields: [], builtIn: true, linkable: { mentions: false } },
  exchangeTypeDef,
];
// An Exchange (ADR 0131): its People in With, what was said in the body.
const talk = (id: string, date: string, withIds: string[], kind = "call", body = ""): Document => ({ ...base, id, type: "contacts_exchange", title: id, body, kind, date, with: withIds }) as unknown as Document;

const today = "2026-11-08";
const anne = P("Anne");
const bob = P("Bob");
const cy = P("Cy");
const stranger = P("Stranger", { relationship: "" });
const gone = P("Gone", { excludedFromDrifting: true });
const fresh = P("Fresh");
const people = [anne, bob, cy, stranger, gone, fresh];
const docs: Document[] = [
  ...(people as unknown as Document[]),
  ev("e1", "2026-05-01", "[[Anne]]"), // 191 days
  ev("e2", "2026-07-01", "[[Bob]]"), // 130 days
  ev("e3", "2026-08-20", "[[Cy]]"), // 80 days
  ev("e4", "2026-01-01", "[[Stranger]] [[Gone]]"),
  ev("e5", "2026-11-01", "[[Fresh]]"),
  day("2026-10-01", "[[Cy]]"),
  day("2026-03-01", "[[Fresh]] [[Bob]]"),
];
const idx = buildLinkIndex(docs, types);
/** Drifting as the People home works it out: each Person's last day, then who drifts. */
const drifting = (index: typeof idx, ps: readonly Person[], { source = "inTouch", today }: { source?: DriftSource; today: string }) => driftingFrom(ps, lastTouches(index, ps, { source, today }), today);
const names = (rows: ReturnType<typeof driftingFrom>) => rows.map((r) => r.person.title);

describe("Drifting", () => {
  it("ranks Not in touch in 90 days by default, longest out of touch first", () => {
    expect(names(drifting(idx, people, { today }))).toEqual(["Anne", "Bob"]);
    expect(drifting(idx, people, { today })[0]).toMatchObject({ last: "2026-05-01", daysSince: 191 });
  });
  it("never drifts a Person with no Relationship", () => {
    expect(names(drifting(idx, people, { today }))).not.toContain("Stranger");
    expect(names(drifting(idx, [P("Stranger", { relationship: "  " })], { today }))).toEqual([]);
  });
  it("never drifts a Person excluded from Drifting", () => {
    expect(names(drifting(idx, people, { today }))).not.toContain("Gone");
  });
  it("drifts someone last seen exactly 90 days ago, and not 89", () => {
    const edge = [P("Ninety"), P("EightyNine")];
    const at = buildLinkIndex([...(edge as unknown as Document[]), ev("n", "2026-08-10", "[[Ninety]]"), ev("m", "2026-08-11", "[[EightyNine]]")], types);
    expect(drifting(at, edge, { today }).map((r) => [r.person.title, r.daysSince])).toEqual([["Ninety", 90]]);
  });
  it("counts from the last day they were seen, not the first", () => {
    const twice = [P("Twice")];
    const at = buildLinkIndex([...(twice as unknown as Document[]), ev("a", "2026-01-10", "[[Twice]]"), ev("b", "2026-06-01", "[[Twice]]")], types);
    expect(drifting(at, twice, { today })).toMatchObject([{ last: "2026-06-01", daysSince: 160 }]);
  });
  it("switches to Not mentioned over the Mentioned days", () => {
    const rows = drifting(idx, people, { today, source: "mentioned" });
    // Anne is on an Event but on no Day: never mentioned, so she drifts first.
    expect(rows.map((r) => [r.person.title, r.last, r.daysSince])).toEqual([["Anne", null, null], ["Bob", "2026-03-01", 252], ["Fresh", "2026-03-01", 252]]);
  });
  it("counts a Person never seen at all as drifting, before everyone seen, by name", () => {
    const rows = drifting(idx, [...people, P("Zoe"), P("New")], { today });
    expect(rows.map((r) => [r.person.title, r.last, r.daysSince])).toEqual([["New", null, null], ["Zoe", null, null], ["Anne", "2026-05-01", 191], ["Bob", "2026-07-01", 130]]);
  });
  it("still leaves out a never-seen Person with no Relationship or excluded", () => {
    expect(names(drifting(idx, [P("Nobody", { relationship: "" }), P("Left", { excludedFromDrifting: true })], { today }))).toEqual([]);
  });
});

describe("Drifting from the last days already worked out", () => {
  it("drifts by the last days it is handed, whatever walked them", () => {
    const last = new Map([["Anne", { day: "2026-11-01", how: "seen" as const }], ["Bob", { day: "2026-01-01", how: "call" as const }]]);
    expect(driftingFrom([anne, bob, cy], last, today).map((r) => [r.person.title, r.daysSince, r.how])).toEqual([["Cy", null, null], ["Bob", 311, "call"]]);
  });
  it("gives each Person their last day, undefined when never", () => {
    const last = lastDays(idx, people, { source: "seen", today });
    // Cy is on an Event in August and on a Day in October: seen then, mentioned since.
    expect(last.get("Cy")).toBe("2026-08-20");
    expect(lastDays(idx, people, { source: "mentioned", today }).get("Cy")).toBe("2026-10-01");
    expect(lastDays(idx, [P("New")], { source: "seen", today }).get("New")).toBeUndefined();
  });
});

describe("Group by Relationship", () => {
  it("groups People under each Relationship with a count, by label, People by name", () => {
    const g = groupByRelationship([P("Zed", { relationship: "colleague" }), anne, bob, stranger, P("Al", { relationship: " friend " })]);
    expect(g.map((x) => [x.relationship, x.count, x.people.map((p) => p.title)])).toEqual([
      ["colleague", 1, ["Zed"]],
      ["friend", 3, ["Al", "Anne", "Bob"]],
    ]);
  });
  it("leaves out People with no Relationship", () => {
    expect(groupByRelationship([stranger])).toEqual([]);
  });
});

describe("Drifting through a Household (ADR 0117)", () => {
  it("counts an Event or a Day that links to someone's Household as seeing or mentioning them", () => {
    const pair = [P("Paul"), P("Mary")];
    const smiths = { ...base, id: "smiths", type: "contacts_household", title: "the Smiths", body: "", aliases: [], members: [{ personId: "Paul" }, { personId: "Mary" }] } as unknown as Document;
    const at = buildLinkIndex([...(pair as unknown as Document[]), smiths, ev("x", "2026-11-01", "Dinner at [[the Smiths]]"), day("2026-10-01", "[[the Smiths]]")], [...types, householdTypeDef]);
    expect(drifting(at, pair, { today })).toEqual([]);
    expect(drifting(at, pair, { today, source: "mentioned" })).toEqual([]);
    expect(lastDays(at, pair, { source: "seen", today }).get("Mary")).toBe("2026-11-01");
    expect(lastDays(at, pair, { source: "mentioned", today }).get("Paul")).toBe("2026-10-01");
  });
});

describe("Drifting by when I was last in touch (ADR 0131)", () => {
  const gran = P("Gran");
  const ida = P("Ida");
  const jo = P("Jo");
  const kit = P("Kit");
  const lu = P("Lu");
  const folks = [gran, ida, jo, kit, lu];
  const at = buildLinkIndex(
    [
      ...(folks as unknown as Document[]),
      // Gran: seen in the spring, called since.
      ev("g1", "2026-04-01", "[[Gran]]"),
      talk("t1", "2026-11-01", ["Gran"]),
      // Ida: a call 120 days ago, seen 140 days ago.
      talk("t2", "2026-07-11", ["Ida"]),
      ev("i1", "2026-06-21", "[[Ida]]"),
      // Jo: seen 140 days ago, a letter 200 days ago.
      ev("j1", "2026-06-21", "[[Jo]]"),
      talk("t3", "2026-04-22", ["Jo"], "letter"),
      // Kit: only told about, in someone else's message.
      talk("t4", "2026-11-02", ["Lu"], "message", "News of [[Kit]]"),
    ],
    types,
  );

  it("keeps someone whose only contact in 90 days is an Exchange off Drifting", () => {
    expect(names(drifting(at, folks, { today }))).not.toContain("Gran");
    expect(names(drifting(at, folks, { today }))).not.toContain("Lu");
  });
  it("reads in touch as the later of last seen and last talked, and says which", () => {
    const rows = drifting(at, folks, { today });
    expect(rows.map((r) => [r.person.title, r.how, r.daysSince])).toEqual([["Kit", null, null], ["Jo", "seen", 140], ["Ida", "call", 120]]);
    expect(rows.map((r) => driftLine(r, "inTouch"))).toEqual(["Never in touch", "seen · 140 days ago", "call · 120 days ago"]);
  });
  it("counts an Exchange's body link as no contact: someone only talked about is never in touch", () => {
    expect(lastTouches(at, [kit], { source: "inTouch", today }).get("Kit")).toBeUndefined();
  });
  it("names the Exchange's kind, and says seen on a day both happened", () => {
    const both = buildLinkIndex([...(folks as unknown as Document[]), ev("b1", "2026-05-01", "[[Gran]]"), talk("b2", "2026-05-01", ["Gran"], "video")], types);
    expect(lastTouches(both, [gran], { source: "inTouch", today }).get("Gran")).toEqual({ day: "2026-05-01", how: "seen" });
    const video = buildLinkIndex([...(folks as unknown as Document[]), talk("v1", "2026-05-01", ["Gran"], "video")], types);
    expect(driftLine(drifting(video, [gran], { today })[0]!, "inTouch")).toBe("video call · 191 days ago");
  });
  it("says mentioned, or never mentioned, when switched to Not mentioned", () => {
    const rows = drifting(idx, people, { today, source: "mentioned" });
    expect(rows.map((r) => driftLine(r, "mentioned"))).toEqual(["Never mentioned", "mentioned · 252 days ago", "mentioned · 252 days ago"]);
  });
});
