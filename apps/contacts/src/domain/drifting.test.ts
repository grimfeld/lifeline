import { describe, expect, it } from "vitest";
import { buildLinkIndex, type Document, type DocumentTypeDef } from "@lifeline/core";
import { personTypeDef } from "../types";
import { drifting, groupByRelationship } from "./drifting";
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
];

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
const names = (rows: ReturnType<typeof drifting>) => rows.map((r) => r.person.title);

describe("Drifting", () => {
  it("ranks Not seen in 90 days by default, longest unseen first", () => {
    expect(names(drifting(idx, people, { today }))).toEqual(["Anne", "Bob"]);
    expect(drifting(idx, people, { today })[0]).toMatchObject({ last: "2026-05-01", daysSince: 191 });
  });
  it("never drifts a Person with no Relationship", () => {
    expect(names(drifting(idx, people, { today, days: 10 }))).not.toContain("Stranger");
    expect(names(drifting(idx, [P("Stranger", { relationship: "  " })], { today }))).toEqual([]);
  });
  it("never drifts a Person excluded from Drifting", () => {
    expect(names(drifting(idx, people, { today, days: 10 }))).not.toContain("Gone");
  });
  it("takes a custom N", () => {
    expect(names(drifting(idx, people, { today, days: 60 }))).toEqual(["Anne", "Bob", "Cy"]);
    expect(names(drifting(idx, people, { today, days: 150 }))).toEqual(["Anne"]);
  });
  it("switches to Not mentioned over the Mentioned days", () => {
    const rows = drifting(idx, people, { today, source: "mentioned" });
    // Anne is on an Event but on no Day: never mentioned, so she drifts first.
    expect(rows.map((r) => [r.person.title, r.last, r.daysSince])).toEqual([["Anne", null, null], ["Bob", "2026-03-01", 252], ["Fresh", "2026-03-01", 252]]);
    expect(names(drifting(idx, people, { today, source: "mentioned", days: 30 }))).toEqual(["Anne", "Bob", "Fresh", "Cy"]);
  });
  it("counts a Person never seen at all as drifting, before everyone seen, by name", () => {
    const rows = drifting(idx, [...people, P("Zoe"), P("New")], { today });
    expect(rows.map((r) => [r.person.title, r.last, r.daysSince])).toEqual([["New", null, null], ["Zoe", null, null], ["Anne", "2026-05-01", 191], ["Bob", "2026-07-01", 130]]);
  });
  it("still leaves out a never-seen Person with no Relationship or excluded", () => {
    expect(names(drifting(idx, [P("Nobody", { relationship: "" }), P("Left", { excludedFromDrifting: true })], { today }))).toEqual([]);
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
