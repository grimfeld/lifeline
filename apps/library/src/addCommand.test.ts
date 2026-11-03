// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { documentsTable, getDocument, initApps, invokeCommand, todayStr } from "@lifeline/core";
import { workTypeDefs, authorRole, authorTypeDef } from "./types";
import { libraryParts } from "./parts";
import { libraryAddCommand } from "./addCommand";
import { addWork, allAuthors, allWorks, normalize } from "./data/repo";
import type { Work } from "./domain/types";

initApps([{ id: "library", title: "Library", types: [...workTypeDefs, authorTypeDef, ...libraryParts.typeDefs], roles: [authorRole], screens: [], cards: [], commands: [] }]);

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const olDoc = { key: "/works/OL1W", title: "Dune", author_name: ["Frank Herbert"], author_key: ["OL1A"], first_publish_year: 1965, number_of_pages_median: 412, cover_i: 7 };
const gbVol = { id: "gb1", volumeInfo: { title: "Dune Messiah", authors: ["Frank Herbert"], publishedDate: "1969-01-01", pageCount: 256, description: "Paul rules." } };

let fetchMock: ReturnType<typeof vi.fn>;
const answer = (route: (url: string) => Response) => {
  fetchMock = vi.fn(async (u: URL | string) => route(String(u)));
  vi.stubGlobal("fetch", fetchMock);
};
const add = (args: Record<string, unknown>) => invokeCommand(libraryAddCommand, args);
const work = async (id?: string) => normalize((await getDocument<Work>(id!))!);

beforeEach(async () => {
  await documentsTable().clear();
});
afterEach(() => vi.unstubAllGlobals());

describe("library.add", () => {
  it("by external key: the source's fields arrive and passed fields win", async () => {
    answer(() => json({ docs: [olDoc] }));
    const r = await add({ externalKey: "openlibrary:/works/OL1W", title: "Dune (my copy)", year: 1966, series: "Dune", seriesNumber: 1 });
    const w = await work(r.id);
    expect([w.title, w.year, w.size, w.coverUrl, w.externalKey, w.series, w.seriesNumber]).toEqual(["Dune (my copy)", 1966, 412, "https://covers.openlibrary.org/b/id/7-M.jpg", "openlibrary:/works/OL1W", "Dune", 1]);
    expect((await allAuthors()).map((a) => a.title)).toEqual(["Frank Herbert"]);
    expect(w.authors).toHaveLength(1);
    expect([w.acquisition, w.engagement]).toEqual(["WANTED", "UNSTARTED"]);
  });

  it("by Google Books key, the hit's synopsis arrives", async () => {
    answer(() => json(gbVol));
    const w = await work((await add({ externalKey: "googlebooks:gb1", title: "Dune Messiah" })).id);
    expect([w.synopsis, w.year, w.size]).toEqual(["Paul rules.", 1969, 256]);
  });

  it("passed authors replace the hit's", async () => {
    answer(() => json({ docs: [olDoc] }));
    await add({ externalKey: "openlibrary:/works/OL1W", title: "Dune", authors: "Brian Herbert, Kevin J. Anderson" });
    expect((await allAuthors()).map((a) => a.title).sort()).toEqual(["Brian Herbert", "Kevin J. Anderson"]);
  });

  it("an unknown or vanished key is refused and nothing is added", async () => {
    answer(() => json({ docs: [] }));
    await expect(add({ externalKey: "openlibrary:/works/NOPE", title: "X" })).rejects.toThrow(/no work/i);
    await expect(add({ externalKey: "isbn:123", title: "X" })).rejects.toThrow(/external key/i);
    expect(await allWorks()).toHaveLength(0);
  });

  it("by hand with every field", async () => {
    const r = await add({
      type: "manga", title: "Berserk", authors: "Kentaro Miura", year: 1989, size: 364, coverUrl: "https://x/b.jpg", synopsis: "Guts.", series: "Berserk", seriesNumber: 1.5,
      originalTitle: "ベルセルク", originalLanguage: "Japanese", reason: "a friend", acquisition: "OWNED", shelf: "IN_PROGRESS", tags: ["#Dark", "seinen"],
    });
    const w = await work(r.id);
    expect(w).toMatchObject({
      type: "manga", title: "Berserk", year: 1989, size: 364, coverUrl: "https://x/b.jpg", synopsis: "Guts.", series: "Berserk", seriesNumber: 1.5,
      originalTitle: "ベルセルク", originalLanguage: "Japanese", reason: "a friend", acquisition: "OWNED", engagement: "IN_PROGRESS", tags: ["dark", "seinen"], slot: 0, slottedOn: "",
    });
    expect([w.acquiredOn, w.startedOn]).toEqual([todayStr(), todayStr()]);
  });

  it("as Done with a finished date, never backdating started or slotted", async () => {
    const w = await work((await add({ title: "Emma", acquisition: "BORROWED", shelf: "DONE", finishedOn: "2024-03-05" })).id);
    expect(w).toMatchObject({ engagement: "DONE", finishedOn: "2024-03-05", acquisition: "BORROWED", startedOn: "", slottedOn: "", slot: 0 });
    expect(w.acquiredOn).toBe(todayStr());
  });

  it("Done without a date is finished today", async () => {
    const w = await work((await add({ title: "Emma", shelf: "DONE" })).id);
    expect(w.finishedOn).toBe(todayStr());
  });

  it("a finished date without Done is refused, not thrown at the network", async () => {
    answer(() => json({ docs: [olDoc] }));
    await expect(add({ title: "Emma", shelf: "UNSTARTED", finishedOn: "2024-03-05" })).rejects.toThrow(/Done/);
    await expect(add({ title: "Emma", finishedOn: "2024-03-05" })).rejects.toThrow(/Done/);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await allWorks()).toHaveLength(0);
  });

  it("a twin is refused, naming the work, and nothing is overwritten or created", async () => {
    answer(() => json({ docs: [olDoc] }));
    const id = await addWork({ medium: "book", title: "Dune", externalKey: "openlibrary:/works/OL1W", acquisition: "OWNED", reason: "keep" });
    await expect(add({ externalKey: "openlibrary:/works/OL1W", title: "Dune", reason: "other" })).rejects.toThrow(/“Dune” is already on the shelf/);
    await expect(add({ title: "dune" })).rejects.toThrow(/already on the shelf/);
    expect(await allWorks()).toHaveLength(1);
    expect((await work(id)).reason).toBe("keep");
    expect(await allAuthors()).toHaveLength(0);
  });

  it("a twin is the same external key: the same title under another key is added; a keyless work on the shelf is a twin by title", async () => {
    answer((url) => json({ docs: [{ ...olDoc, key: `/works/${/OL\dW/.exec(decodeURIComponent(url))![0]}` }] }));
    await addWork({ medium: "book", title: "Dune", externalKey: "openlibrary:/works/OL1W", acquisition: "WANTED", reason: "" });
    await add({ externalKey: "openlibrary:/works/OL2W", title: "Dune" });
    expect(await allWorks()).toHaveLength(2);
    await addWork({ medium: "comic", title: "Watchmen", acquisition: "WANTED", reason: "" });
    await expect(add({ type: "comic", externalKey: "openlibrary:/works/OL3W", title: "Watchmen" })).rejects.toThrow(/“Watchmen” is already on the shelf/);
  });
});
