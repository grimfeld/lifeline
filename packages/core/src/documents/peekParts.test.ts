import { describe, expect, it } from "vitest";
import { registerBuiltinTypes } from "./registry";
import type { DocumentTypeDef, FieldDef } from "./types";
import { peekPartOf, userFieldsOf } from "./peekParts";

const f = (key: string, kind: FieldDef["kind"] = "text"): FieldDef => ({ key, label: key, kind });

const book: DocumentTypeDef = { id: "book", label: "Books", appId: "library", titleRule: "name", body: "optional", fields: [f("year", "number"), f("authors", "links")], builtIn: true };
registerBuiltinTypes([book]);

const Read = () => null;
const Edit = () => null;

describe("userFieldsOf", () => {
  it("is nothing on a built-in the user never touched", () => {
    expect(userFieldsOf(book)).toEqual([]);
  });

  it("is the Fields the user added to a built-in, never the App's own", () => {
    const overridden: DocumentTypeDef = { ...book, overridden: true, fields: [...book.fields, f("rating", "number")] };
    expect(userFieldsOf(overridden).map((x) => x.key)).toEqual(["rating"]);
  });

  it("is every Field of a user-defined type", () => {
    const person: DocumentTypeDef = { id: "person", label: "People", titleRule: "name", body: "optional", fields: [f("aliases", "list"), f("home", "geo")], builtIn: false };
    expect(userFieldsOf(person).map((x) => x.key)).toEqual(["aliases", "home"]);
  });

  it("is nothing for an unknown type", () => {
    expect(userFieldsOf(undefined)).toEqual([]);
  });
});

describe("peekPartOf", () => {
  it("is the App's editable part when it has adopted one", () => {
    expect(peekPartOf({ ...book, peek: Read, peekEdit: Edit })).toEqual({ Part: Edit, edits: true });
  });

  it("falls back to the App's read-only part", () => {
    expect(peekPartOf({ ...book, peek: Read })).toEqual({ Part: Read, edits: false });
  });

  it("is none when the App brings no part, or the type is the user's", () => {
    expect(peekPartOf(book)).toBeNull();
    const person: DocumentTypeDef = { id: "person", label: "People", titleRule: "name", body: "optional", fields: [], builtIn: false };
    expect(peekPartOf(person)).toBeNull();
    expect(peekPartOf(undefined)).toBeNull();
  });
});
