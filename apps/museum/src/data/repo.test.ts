import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { documentsTable, initApps } from "@lifeline/core";
import { museumTypeDefs } from "../types";
import { allArtists, ensureArtist } from "./repo";

initApps([{ id: "museum", title: "Museum", types: museumTypeDefs, screens: [], cards: [], commands: [] }]);

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
