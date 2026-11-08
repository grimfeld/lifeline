import { describe, expect, it } from "vitest";
import type { Person } from "./types";
import { everyone, relationshipsOf, tagsOf } from "./everyone";

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
