// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { documentsTable, getDocument, initApps } from "@lifeline/core";
import { workTypeDefs, authorRole, authorTypeDef } from "../types";
import { libraryParts } from "../parts";
import type { Work } from "../domain/types";
import type { WorkHit } from "./openlibrary";
import { addWork, normalize, patchWork } from "./repo";
import { applyPick, refreshFromSource } from "./enrichActions";

initApps([{ id: "library", title: "Library", types: [...workTypeDefs, authorTypeDef, ...libraryParts.typeDefs], roles: [authorRole], screens: [], cards: [], commands: [] }]);

const work = async (id: string) => normalize((await getDocument<Work>(id))!);
const hit: WorkHit = {
  externalKey: "openlibrary:/works/OL1W",
  title: "Dune",
  authors: [],
  year: 1965,
  size: 604,
  coverUrl: "https://c/dune.jpg",
  synopsis: "From the source.",
  series: "Dune Chronicles",
  seriesNumber: 1,
  originalTitle: "Dune",
  originalLanguage: "English",
};

beforeEach(async () => {
  await documentsTable().clear();
});

describe("applying a hit to the new fields", () => {
  it("fills them when empty and leaves typed ones alone", async () => {
    const id = await addWork({ medium: "book", title: "Dune", acquisition: "WANTED", reason: "" });
    await patchWork(await work(id), { synopsis: "Mine.", series: "" });
    await applyPick(await work(id), hit);
    const w = await work(id);
    expect([w.synopsis, w.series, w.seriesNumber, w.originalTitle, w.originalLanguage]).toEqual(["Mine.", "Dune Chronicles", 1, "Dune", "English"]);
  });
  it("refresh from source never touches them", async () => {
    const id = await addWork({ medium: "book", title: "Dune", acquisition: "WANTED", reason: "", externalKey: hit.externalKey });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ docs: [{ key: "/works/OL1W", title: "Dune", first_publish_year: 1965, cover_i: 9 }] }) })));
    await refreshFromSource(await work(id), {});
    vi.unstubAllGlobals();
    const w = await work(id);
    expect(w.year).toBe(1965);
    expect([w.synopsis, w.series, w.seriesNumber]).toEqual(["", "", 0]);
  });
});
