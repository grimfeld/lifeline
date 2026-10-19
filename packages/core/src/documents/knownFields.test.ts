import { describe, expect, it } from "vitest";
import { knownFieldReadings, knownFieldsToAdd } from "./knownFields";
import type { FieldKind } from "./types";

const F = (key: string, kind: FieldKind) => ({ key, kind });
const userType = { builtIn: false, linkable: true };

describe("Known fields: which Fields Lifeline recognises (ADR 0078)", () => {
  it("knows Aliases only by key and kind together", () => {
    const r = knownFieldReadings([F("aliases", "list"), F("aliases", "text"), F("nicknames", "list")], userType);
    expect(r.map((x) => x.known)).toEqual(["aliases", undefined, undefined]);
  });

  it("knows a user type's first geo Field as Coordinates; extra ones are ordinary", () => {
    const r = knownFieldReadings([F("place", "geo"), F("aliases", "list"), F("second", "geo")], userType);
    expect(r.map((x) => x.known)).toEqual(["coordinates", "aliases", undefined]);
  });

  it("knows the type's map Field as Coordinates when it names one", () => {
    const r = knownFieldReadings([F("place", "geo"), F("home", "geo")], { ...userType, locatableField: "home" });
    expect(r.map((x) => x.known)).toEqual([undefined, "coordinates"]);
  });

  it("never knows a geo Field on a built-in type — built-ins don't become Locatable from data", () => {
    const r = knownFieldReadings([F("place", "geo"), F("aliases", "list")], { builtIn: true, linkable: true });
    expect(r.map((x) => x.known)).toEqual([undefined, "aliases"]);
  });
});

describe("Known fields: the note on each row (ADR 0078)", () => {
  const notes = (fields: ReturnType<typeof F>[], type = userType as Parameters<typeof knownFieldReadings>[1]) => knownFieldReadings(fields, type).map((r) => r.note);

  it("says what a Known field does", () => {
    const [aliases, coords] = notes([F("aliases", "list"), F("place", "geo")]);
    expect(aliases).toMatch(/\[\[links\]\]/);
    expect(coords).toMatch(/map/);
  });

  it("says Aliases does nothing while the type isn't Linkable — it stays Aliases", () => {
    const [r] = knownFieldReadings([F("aliases", "list")], { builtIn: false, linkable: false });
    expect(r).toEqual({ known: "aliases", note: expect.stringMatching(/does nothing until the type is Linkable/i) });
  });

  it("tells an `aliases` Field of another kind that links won't use it", () => {
    expect(notes([F("aliases", "text")])[0]).toMatch(/links won't use it/i);
  });

  it("tells an extra geo Field it doesn't put the type on the map, naming the one that does", () => {
    expect(notes([F("place", "geo"), F("second", "geo")])[1]).toMatch(/not on the map.*place/i);
  });

  it("has nothing to say about an ordinary Field", () => {
    expect(notes([F("mood", "select")])).toEqual([undefined]);
  });
});

describe("Known fields a type may still add (ADR 0078)", () => {
  const ids = (fields: ReturnType<typeof F>[], type: Parameters<typeof knownFieldsToAdd>[1]) => knownFieldsToAdd(fields, type).map((k) => k.id);

  it("offers a user type both, Aliases first, each with a note", () => {
    const offered = knownFieldsToAdd([F("mood", "select")], userType);
    expect(offered.map((k) => [k.id, k.key, k.kind])).toEqual([["aliases", "aliases", "list"], ["coordinates", "coordinates", "geo"]]);
    expect(offered.every((k) => k.note.length > 0)).toBe(true);
  });

  it("offers a built-in only Aliases, and only when it is Linkable", () => {
    expect(ids([], { builtIn: true, linkable: true })).toEqual(["aliases"]);
    expect(ids([], { builtIn: true, linkable: false })).toEqual([]);
  });

  it("offers Aliases on a user type that isn't Linkable, saying picking it turns Linkable on", () => {
    const [aliases] = knownFieldsToAdd([], { builtIn: false, linkable: false });
    expect(aliases).toMatchObject({ id: "aliases", makesLinkable: true });
    expect(knownFieldsToAdd([], userType)[0].makesLinkable).toBeFalsy();
  });

  it("doesn't offer what the type already has: an `aliases` key of any kind, or any geo Field", () => {
    expect(ids([F("aliases", "list")], userType)).toEqual(["coordinates"]);
    expect(ids([F("aliases", "text")], userType)).toEqual(["coordinates"]);
    expect(ids([F("place", "geo")], userType)).toEqual(["aliases"]);
  });
});
