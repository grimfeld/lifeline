import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { documentsTable, getDocument, initApps, patchDocument } from "@lifeline/core";
import { workTypeDefs, playlistTypeDef } from "../types";
import type { Work } from "../domain/types";
import { addWork, allWorks, normalize, patchWork, quickAddWork } from "./repo";

initApps([{ id: "cinema", title: "Cinema", types: [...workTypeDefs, playlistTypeDef], screens: [], cards: [], commands: [] }]);

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
