import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { documentsTable, hasRole, initApps, isLinkTarget, putDocument, type DocumentTypeDef } from "@lifeline/core";
import { artistRole, museumTypeDefs } from "../types";
import { allArtists, ensureArtist } from "./repo";

const personType: DocumentTypeDef = { id: "contacts_person", label: "People", titleRule: "name", body: "optional", linkable: {}, builtIn: true, fields: [{ key: "aliases", label: "Aliases", kind: "list" }] };
initApps([
  { id: "museum", title: "Museum", types: museumTypeDefs, roles: [artistRole], screens: [], cards: [], commands: [] },
  { id: "contacts", title: "Contacts", types: [personType], screens: [], cards: [], commands: [] },
]);

beforeEach(async () => {
  await documentsTable().clear();
});

describe("ensureArtist", () => {
  it("never links a hit to a different person who shares the name (CR-54)", async () => {
    const elder = await ensureArtist({ name: "Jan Brueghel", externalKey: "wikidata:Q1" });
    const younger = await ensureArtist({ name: "Jan Brueghel", externalKey: "wikidata:Q2" });
    expect(younger).not.toBe(elder);
    expect((await allArtists()).map((a) => a.externalKey).sort()).toEqual(["wikidata:Q1", "wikidata:Q2"]);
  });

  it("gives a keyless namesake the hit's identity", async () => {
    const typed = await ensureArtist({ name: "Vermeer" });
    expect(await ensureArtist({ name: "vermeer", externalKey: "wikidata:Q41264" })).toBe(typed);
    expect((await allArtists())[0]?.externalKey).toBe("wikidata:Q41264");
  });

  it("links a typed name to the Artist it names, keyed or not", async () => {
    const keyed = await ensureArtist({ name: "Vermeer", externalKey: "wikidata:Q41264" });
    expect(await ensureArtist({ name: "Vermeer" })).toBe(keyed);
  });
});

describe("an Artist who is a Person (the Artist Role)", () => {
  it("is still an Artist: listed, found by name and alias, and a valid artist link", async () => {
    const friend = await putDocument({ type: "contacts_person", title: "Anselm", aliases: ["Anselm K."], roles: ["artist"], years: "1945" });
    expect((await allArtists()).map((a) => a.title)).toEqual(["Anselm"]);
    expect(await ensureArtist({ name: "anselm k." })).toBe(friend.id);
    expect(hasRole(friend, "artist")).toBe(true);
    expect(isLinkTarget({ linkRole: "artist" }, friend)).toBe(true);
  });
});
