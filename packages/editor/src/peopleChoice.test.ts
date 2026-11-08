import { describe, expect, it } from "vitest";
import type { Document } from "@lifeline/core";
import { afterKey, personOptions, withPerson } from "./peopleChoice";

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
