import { describe, expect, it } from "vitest";
import type { Person } from "./types";
import { formatHuman } from "@lifeline/core";
import { upcomingOccasions } from "./occasions";
import { activeFilter, byLetter, everyone, lastSeenLabel, relationshipsOf, rowNews, tagsOf } from "./everyone";

const P = (title: string, more: Partial<Person> = {}): Person =>
  ({ id: title, type: "contacts_person", title, aliases: [], relationship: "", tags: [], ...more }) as unknown as Person;

const anne = P("Anne Dupont", { aliases: ["Mum"], relationship: "my mother", tags: ["family"] });
const marc = P("Marc Petit", { relationship: "colleague", tags: ["work", "climbing"] });
const lea = P("Léa Martin", { relationship: "my mother", tags: ["family", "climbing"] });
const stranger = P("Zed");
const all = [marc, stranger, lea, anne];
const names = (ps: Person[]) => ps.map((p) => p.title);

describe("Everyone", () => {
  it("lists every Person by name, accents and case aside", () => {
    expect(names(everyone(all, {}))).toEqual(["Anne Dupont", "Léa Martin", "Marc Petit", "Zed"]);
  });

  it("searches names and aliases, ignoring case and accents", () => {
    expect(names(everyone(all, { query: "mum" }))).toEqual(["Anne Dupont"]);
    expect(names(everyone(all, { query: "LEA" }))).toEqual(["Léa Martin"]);
    expect(names(everyone(all, { query: "  pet " }))).toEqual(["Marc Petit"]);
    expect(everyone(all, { query: "nobody" })).toEqual([]);
  });

  it("filters by Relationship and by Tag, and the filters combine", () => {
    expect(names(everyone(all, { relationship: "my mother" }))).toEqual(["Anne Dupont", "Léa Martin"]);
    expect(names(everyone(all, { tag: "climbing" }))).toEqual(["Léa Martin", "Marc Petit"]);
    expect(names(everyone(all, { relationship: "my mother", tag: "climbing" }))).toEqual(["Léa Martin"]);
    expect(names(everyone(all, { relationship: "my mother", tag: "climbing", query: "anne" }))).toEqual([]);
  });

  it("offers the Relationships and Tags in use, once each, sorted", () => {
    expect(relationshipsOf(all)).toEqual(["colleague", "my mother"]);
    expect(tagsOf(all)).toEqual(["climbing", "family", "work"]);
  });
});

describe("Everyone's filters and rows", () => {
  it("keeps a filter only while someone carries its value", () => {
    expect(activeFilter(["colleague", "my mother"], "colleague")).toBe("colleague");
    expect(activeFilter(["my mother"], "colleague")).toBe("");
    expect(activeFilter([], "")).toBe("");
  });
  it("says when a Person was last seen, or that they never were", () => {
    expect(lastSeenLabel("2026-03-04")).toBe(`Last seen ${formatHuman("2026-03-04")}`);
    expect(lastSeenLabel("2026-03-04")).not.toBe("Last seen ");
    expect(lastSeenLabel(undefined)).toBe("Never seen");
  });
});

describe("Everyone A to Z", () => {
  const letters = (ps: Person[]) => byLetter(ps).map(([letter, rows]) => [letter, names(rows)]);
  it("puts each Person under the first letter of their name, accent and case aside", () => {
    expect(letters(everyone([P("Émile"), P("anne"), P("Eve"), P("Bob")], {}))).toEqual([["A", ["anne"]], ["B", ["Bob"]], ["E", ["Émile", "Eve"]]]);
  });
  it("puts a name that does not start with a letter under #", () => {
    expect(letters([P("42nd Street Café"), P("@marc"), P("Zed")])).toEqual([["#", ["42nd Street Café", "@marc"]], ["Z", ["Zed"]]]);
  });
});

describe("What a row says", () => {
  const today = "2026-11-08";
  const wed = { id: "w", label: "Wedding", day: "2001-11-20", yearly: true };
  const bday = { id: "b", label: "Birthday", day: "1990-11-10", yearly: true };
  it("shows a Person's nearest Occasion soon, with the age a Birthday reaches", () => {
    // The Upcoming the home already shows, soonest first: each row takes its Person's first.
    const news = rowNews(upcomingOccasions([P("Anne", { occasions: [wed, bday] })], today, 30), []);
    expect(news.upcoming.get("Anne")).toMatchObject({ label: "Birthday", inDays: 2, age: 36 });
  });
  it("shows no Occasion that Upcoming leaves out", () => {
    expect(rowNews(upcomingOccasions([P("Anne", { occasions: [wed] })], today, 7), []).upcoming.has("Anne")).toBe(false);
  });
  it("says how long the drifting have drifted, and nothing for the never seen", () => {
    const news = rowNews([], [{ person: anne, last: "2026-05-01", daysSince: 191 }, { person: marc, last: null, daysSince: null }]);
    expect([...news.drifting]).toEqual([["Anne Dupont", 191], ["Marc Petit", null]]);
    expect(news.drifting.has("Zed")).toBe(false);
  });
});
