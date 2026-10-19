// @vitest-environment jsdom
// The Work types carry the Parts kit (ADR 0074), whose UI imports need a DOM.
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { documentsOf, documentsTable, getDocument, initApps, patchDocument, putDocument, removeDocument } from "@lifeline/core";
import { workTypeDefs, playlistTypeDef } from "../types";
import type { Playlist, Work } from "../domain/types";
import { cinemaParts } from "../parts";
import { addPlaylist, addWork, allWorks, normalize, patchWork, quickAddWork } from "./repo";

initApps([{ id: "cinema", title: "Cinema", types: [...workTypeDefs, playlistTypeDef, ...cinemaParts.typeDefs], screens: [], cards: [], commands: [] }]);

const work = async (id: string) => normalize((await getDocument<Work>(id))!);

beforeEach(async () => {
  await documentsTable().clear();
});

describe("patchWork", () => {
  it("writes only the patched fields, never reverting what changed since the copy was read (CR-51)", async () => {
    const id = await addWork({ medium: "movie", title: "Dune", reason: "" });
    const stale = await work(id);
    await patchDocument(id, { rating: 4, liked: true });
    await patchWork(stale, { year: 1984, coverUrl: "https://covers/x.jpg" });
    const now = await work(id);
    expect([now.year, now.coverUrl, now.rating, now.liked]).toEqual([1984, "https://covers/x.jpg", 4, true]);
  });
});

describe("deleting a work", () => {
  it("takes its Quotes and its Playlist places with it, from wherever it is deleted (CR-57)", async () => {
    const heat = await addWork({ medium: "movie", title: "Heat", reason: "" });
    const ronin = await addWork({ medium: "movie", title: "Ronin", reason: "" });
    const list = await addPlaylist({ title: "Heists", body: "", ranked: true, workIds: [heat, ronin] });
    await putDocument({ type: "quote", source: heat, body: "Don't let yourself get attached to anything." });
    await removeDocument(heat); // the Vault's or a Base's delete, not the Cinema's own
    expect(await documentsOf("quote")).toEqual([]);
    expect((await getDocument<Playlist>(list))!.workIds).toEqual([ronin]);
  });
});

describe("quickAddWork", () => {
  const hit = (externalKey: string, year: number) => ({ externalKey, coverUrl: "", year, size: 0, creator: "" });

  it("hands back the film you already have instead of adding a twin (CR-53)", async () => {
    const { id } = await quickAddWork({ medium: "movie", title: "Dune", hit: hit("tmdb:movie/438631", 2021) });
    expect((await quickAddWork({ medium: "movie", title: "Dune", hit: hit("tmdb:movie/438631", 2021) })).twin?.id).toBe(id);
    expect((await quickAddWork({ medium: "movie", title: "dune" })).twin?.id).toBe(id);
    expect(await allWorks()).toHaveLength(1);
  });

  it("adds a namesake with another identity: two films called Dune are two films", async () => {
    await quickAddWork({ medium: "movie", title: "Dune", hit: hit("tmdb:movie/438631", 2021) });
    expect((await quickAddWork({ medium: "movie", title: "Dune", hit: hit("tmdb:movie/841", 1984) })).twin).toBeUndefined();
    expect(await allWorks()).toHaveLength(2);
  });
});
