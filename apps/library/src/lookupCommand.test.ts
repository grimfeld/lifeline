// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { documentsTable, initApps, invokeCommand } from "@lifeline/core";
import { workTypeDefs, authorRole, authorTypeDef } from "./types";
import { libraryParts } from "./parts";
import { libraryLookupCommand } from "./lookupCommand";
import { fetchHitByKey } from "./data/lookupCandidates";
import { addWork, patchWork, allWorks } from "./data/repo";
import { start } from "./domain/rules";

initApps([{ id: "library", title: "Library", types: [...workTypeDefs, authorTypeDef, ...libraryParts.typeDefs], roles: [authorRole], screens: [], cards: [], commands: [] }]);

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const olDoc = { key: "/works/OL1W", title: "Dune", author_name: ["Frank Herbert"], author_key: ["OL1A"], first_publish_year: 1965, number_of_pages_median: 412, cover_i: 7 };
const gbVol = { id: "gb1", volumeInfo: { title: "Dune Messiah", authors: ["Frank Herbert"], publishedDate: "1969-01-01", pageCount: 256, description: "Paul rules." } };

let fetchMock: ReturnType<typeof vi.fn>;
const answer = (route: (url: string) => Response) => {
  fetchMock = vi.fn(async (u: URL | string) => route(String(u)));
  vi.stubGlobal("fetch", fetchMock);
};
const run = async (args: Record<string, unknown>) => JSON.parse((await invokeCommand(libraryLookupCommand, args)).message) as { candidates: Record<string, any>[] };

beforeEach(async () => {
  await documentsTable().clear();
});
afterEach(() => vi.unstubAllGlobals());

describe("library.lookup", () => {
  it("an ISBN returns the one work", async () => {
    answer((url) => (url.includes("/isbn/") ? json({ works: [{ key: "/works/OL1W" }] }) : json({ docs: [olDoc] })));
    const { candidates } = await run({ query: "978-0-441-17271-9" });
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ externalKey: "openlibrary:/works/OL1W", title: "Dune", authors: ["Frank Herbert"], year: 1965, size: 412, coverUrl: "https://covers.openlibrary.org/b/id/7-M.jpg" });
  });

  it("a text query returns the chain's candidates, falling to Google Books when Open Library has none", async () => {
    answer((url) => (url.includes("openlibrary") ? json({ docs: [] }) : json({ items: [gbVol] })));
    const { candidates } = await run({ query: "dune messiah" });
    expect(candidates).toEqual([expect.objectContaining({ externalKey: "googlebooks:gb1", title: "Dune Messiah", year: 1969, size: 256, synopsis: "Paul rules." })]);
  });

  it("title and author work without a query", async () => {
    answer(() => json({ docs: [olDoc] }));
    await run({ title: "Dune", author: "Herbert" });
    const url = new URL(String(fetchMock.mock.calls[0]![0]));
    expect([url.searchParams.get("title"), url.searchParams.get("author")]).toEqual(["Dune", "Herbert"]);
  });

  it("marks a candidate already on the shelf with its id and Shelf, and only reads", async () => {
    const id = await addWork({ medium: "book", title: "Dune", externalKey: "openlibrary:/works/OL1W", acquisition: "WANTED", reason: "" });
    await patchWork((await allWorks())[0]!, start());
    answer(() => json({ docs: [olDoc, { ...olDoc, key: "/works/OL2W", title: "Children of Dune" }] }));
    const { candidates } = await run({ query: "dune" });
    expect(candidates[0]!.onShelf).toEqual({ id, shelf: "In progress" });
    expect(candidates[1]!.onShelf).toBeUndefined();
    expect(await allWorks()).toHaveLength(1);
  });

  it("refuses an empty lookup, and reports unreachable providers without failing", async () => {
    await expect(invokeCommand(libraryLookupCommand, {})).rejects.toThrow(/query|title|author/i);
    answer(() => json({}, 500));
    const out = await invokeCommand(libraryLookupCommand, { query: "dune" });
    expect(out.message).toMatch(/unavailable|could not/i);
  });
});

describe("fetchHitByKey", () => {
  it("fetches an Open Library work, a Google Books volume, or nothing", async () => {
    answer((url) => (url.includes("googleapis") ? json(gbVol) : json({ docs: [olDoc] })));
    expect((await fetchHitByKey("openlibrary:/works/OL1W"))?.title).toBe("Dune");
    expect((await fetchHitByKey("googlebooks:gb1"))?.externalKey).toBe("googlebooks:gb1");
    expect(await fetchHitByKey("openlibrary:/works/OL9W")).toBeUndefined();
    expect(await fetchHitByKey("tmdb:1")).toBeUndefined();
  });
});
