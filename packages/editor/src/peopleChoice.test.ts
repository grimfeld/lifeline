import { describe, expect, it } from "vitest";
import type { Document } from "@lifeline/core";
import { afterKey, groupOptions, personOptions, withMembers, withPerson } from "./peopleChoice";

const person = (id: string, title: string, aliases?: unknown): Document =>
  ({ id, type: "contacts_person", title, body: "", folder: "", tags: [], createdAt: "", updatedAt: "", deleted: 0, aliases }) as Document;

describe("a People field's choice", () => {
  const people = [person("m", "Marc", ["Marco", "", 7]), person("j", "Jo"), person("a", "Ana", "Annie")];

  it("offers the People not chosen yet, completing their aliases and saying them", () => {
    expect(personOptions(people, ["j"])).toEqual([
      { value: "m", label: "Marc", keywords: ["Marco", "7"], description: "also Marco, 7" },
      { value: "a", label: "Ana", keywords: ["Annie"], description: "also Annie" },
    ]);
  });
  it("says nothing more of someone with no alias", () => {
    expect(personOptions(people, ["m", "a"])).toEqual([{ value: "j", label: "Jo", keywords: [], description: undefined }]);
  });
  it("adds a Person once", () => {
    expect([withPerson(["m"], "j"), withPerson(["m"], "m")]).toEqual([["m", "j"], undefined]);
  });
  it("takes the last Person off on Backspace in an empty box, and nothing else", () => {
    expect(afterKey("Backspace", "", ["m", "j", "a"])).toEqual(["m", "j"]);
    expect([afterKey("Backspace", "Ma", ["m"]), afterKey("Backspace", "", []), afterKey("Enter", "", ["m"])]).toEqual([undefined, undefined, undefined]);
  });
});

describe("a People field that also offers Households (an Event's With, ADR 0117)", () => {
  const people = [person("paul", "Paul Smith"), person("mary", "Mary Martin"), person("lily", "Lily Smith"), person("jo", "Jo")];
  const household = (id: string, title: string, aliases?: unknown): Document =>
    ({ id, type: "contacts_household", title, body: "", folder: "", tags: [], createdAt: "", updatedAt: "", deleted: 0, aliases }) as Document;
  const smiths = { doc: household("h", "the Smiths", ["Smiths"]), kind: "Household", members: ["paul", "mary", "lily"] };

  it("offers a Household by name or alias, saying who it adds", () => {
    expect(groupOptions([smiths], people, ["mary"])).toEqual([
      { value: "h", label: "the Smiths", keywords: ["Smiths"], description: "Household · Paul Smith, Lily Smith" },
    ]);
  });
  it("leaves out a Household that would add no one: all there already, or no member among the People", () => {
    const strangers = { doc: household("g", "the Greens"), kind: "Household", members: ["gone"] };
    expect(groupOptions([smiths, strangers], people, ["paul", "mary", "lily"])).toEqual([]);
  });
  it("adds a Household's members as People, after those there, never twice", () => {
    expect(withMembers(["jo", "mary"], smiths.members, people)).toEqual(["jo", "mary", "paul", "lily"]);
  });
  it("adds only members who are People here, and nothing when all are there", () => {
    expect(withMembers([], ["gone", "paul"], people)).toEqual(["paul"]);
    expect(withMembers(["paul", "mary", "lily"], smiths.members, people)).toBeUndefined();
  });
});
