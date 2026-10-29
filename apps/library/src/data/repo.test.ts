// @vitest-environment jsdom
// The Work types carry the Parts kit (ADR 0074), whose UI imports need a DOM.
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { documentsOf, documentsTable, getDocument, initApps, patchDocument, putDocument, removeDocument, type Document } from "@lifeline/core";
import { workTypeDefs, authorRole, authorTypeDef } from "../types";
import { libraryParts } from "../parts";
import type { Work } from "../domain/types";
import { addWork, allAuthors, allWorks, deleteAuthor, ensureAuthor, normalize, patchWork, quickAddWork, restoreAuthor } from "./repo";

initApps([{ id: "library", title: "Library", types: [...workTypeDefs, authorTypeDef, ...libraryParts.typeDefs], roles: [authorRole], screens: [], cards: [], commands: [] }]);

const work = async (id: string) => normalize((await getDocument<Work>(id))!);

beforeEach(async () => {
  await documentsTable().clear();
});

describe("the Work's descriptive fields", () => {
  it("read as empty / 0 on an old work, and keep what is written", async () => {
    const id = await addWork({ medium: "book", title: "Dune", acquisition: "WANTED", reason: "" });
    const old = await work(id);
    expect([old.synopsis, old.series, old.seriesNumber, old.originalTitle, old.originalLanguage]).toEqual(["", "", 0, "", ""]);
    await patchWork(old, { synopsis: "Spice.", series: "Dune", seriesNumber: 1.5, originalTitle: "Duna", originalLanguage: "Polish" });
    const now = await work(id);
    expect([now.synopsis, now.series, now.seriesNumber, now.originalTitle, now.originalLanguage]).toEqual(["Spice.", "Dune", 1.5, "Duna", "Polish"]);
  });
  it("addWork stores them when given", async () => {
    const id = await addWork({ medium: "manga", title: "Berserk", acquisition: "OWNED", reason: "", series: "Berserk", seriesNumber: 2, originalLanguage: "Japanese" });
    const w = await work(id);
    expect([w.series, w.seriesNumber, w.originalLanguage]).toEqual(["Berserk", 2, "Japanese"]);
  });
});

describe("patchWork", () => {
  it("writes only the patched fields, never reverting what changed since the copy was read (CR-51)", async () => {
    const id = await addWork({ medium: "book", title: "Dune", acquisition: "WANTED", reason: "" });
    const stale = await work(id);
    await patchDocument(id, { reason: "a friend's pick", acquisition: "OWNED" });
    await patchWork(stale, { year: 1965, coverUrl: "https://covers/dune.jpg" });
    const now = await work(id);
    expect([now.year, now.coverUrl, now.reason, now.acquisition]).toEqual([1965, "https://covers/dune.jpg", "a friend's pick", "OWNED"]);
  });

  it("still normalizes tags it is given", async () => {
    const id = await addWork({ medium: "book", title: "Dune", acquisition: "WANTED", reason: "" });
    await patchWork(await work(id), { tags: ["#SciFi", "scifi"] });
    expect((await work(id)).tags).toEqual(["scifi"]);
  });
});

describe("deleting a Work", () => {
  it("takes its Quotes with it, from wherever it is deleted (CR-57)", async () => {
    const dune = await addWork({ medium: "book", title: "Dune", acquisition: "WANTED", reason: "" });
    const emma = await addWork({ medium: "book", title: "Emma", acquisition: "WANTED", reason: "" });
    await putDocument({ type: "quote", source: dune, body: "Fear is the mind-killer." });
    await putDocument({ type: "quote", source: emma, body: "Badly done, Emma!" });
    await removeDocument(dune); // the Vault's or a Base's delete, not the Library's own
    expect((await documentsOf<Document & { source: string }>("quote")).map((q) => q.source)).toEqual([emma]);
  });
});

describe("quickAddWork", () => {
  const hit = (externalKey: string) => ({ externalKey, coverUrl: "", year: 1965, size: 0, authors: [{ name: "Frank Herbert", externalKey: "openlibrary:/authors/OL1A" }] });

  it("hands back the Work you already have instead of adding a twin (CR-53)", async () => {
    const { id } = await quickAddWork({ medium: "book", title: "Dune", hit: hit("openlibrary:/works/OL1W") });
    const again = await quickAddWork({ medium: "book", title: "Dune (40th anniversary)", hit: hit("openlibrary:/works/OL1W") });
    expect(again.twin?.id).toBe(id);
    const typed = await quickAddWork({ medium: "book", title: " dune ", author: "Someone Else" });
    expect(typed.twin?.id).toBe(id);
    expect(await allWorks()).toHaveLength(1);
    expect(await allAuthors()).toHaveLength(1);
  });

  it("adds a same-titled Work in another medium, or with another identity", async () => {
    await quickAddWork({ medium: "book", title: "Dune", hit: hit("openlibrary:/works/OL1W") });
    expect((await quickAddWork({ medium: "comic", title: "Dune" })).twin).toBeUndefined();
    expect((await quickAddWork({ medium: "book", title: "Dune", hit: hit("openlibrary:/works/OL2W") })).twin).toBeUndefined();
    expect(await allWorks()).toHaveLength(3);
  });
});

describe("ensureAuthor", () => {
  const ol = (n: string) => `openlibrary:/authors/OL${n}A`;

  it("never links a hit to a different person who shares the name (CR-54, ADR 0052)", async () => {
    const elder = await ensureAuthor({ name: "John Williams", externalKey: ol("1") });
    const younger = await ensureAuthor({ name: "John Williams", externalKey: ol("2") });
    expect(younger).not.toBe(elder);
    const rows = (await allAuthors()).map((a) => [a.title, a.externalKey]).sort();
    expect(rows).toEqual([["John Williams", ol("1")], ["John Williams", ol("2")]]);
  });

  it("gives a keyless namesake the hit's identity", async () => {
    const typed = await ensureAuthor({ name: "Frank Herbert" });
    expect(await ensureAuthor({ name: "frank herbert", externalKey: ol("9") })).toBe(typed);
    expect((await allAuthors())[0]?.externalKey).toBe(ol("9"));
  });

  it("links a typed name to the Author it names, keyed or not", async () => {
    const keyed = await ensureAuthor({ name: "Frank Herbert", externalKey: ol("9") });
    expect(await ensureAuthor({ name: "Frank Herbert" })).toBe(keyed);
  });
});

describe("deleteAuthor and restoreAuthor", () => {
  it("brings the Author back under its id with its Works re-linked, and leaves other Works alone", async () => {
    const herbert = await putDocument({ type: "author", title: "Frank Herbert", aliases: ["F. Herbert"], externalKey: "openlibrary:/authors/OL1A", photoUrl: "", born: "1920", died: "1986" });
    const other = await putDocument({ type: "author", title: "Jane Austen", aliases: [], externalKey: "", photoUrl: "", born: "", died: "" });
    const dune = await addWork({ medium: "book", title: "Dune", acquisition: "WANTED", reason: "" });
    const messiah = await addWork({ medium: "book", title: "Dune Messiah", acquisition: "WANTED", reason: "" });
    const emma = await addWork({ medium: "book", title: "Emma", acquisition: "WANTED", reason: "" });
    await patchDocument(dune, { authors: [herbert.id] });
    await patchDocument(messiah, { authors: [herbert.id, other.id] });
    await patchDocument(emma, { authors: [other.id] });

    const snapshot = (await getDocument(herbert.id))!;
    const unlinked = await deleteAuthor(herbert.id);
    expect([...unlinked].sort()).toEqual([dune, messiah].sort());
    expect((await allAuthors()).map((a) => a.id)).toEqual([other.id]);
    expect((await work(dune)).authors).toEqual([]);
    expect((await work(messiah)).authors).toEqual([other.id]);

    await restoreAuthor(snapshot as never, unlinked);
    const back = (await getDocument(herbert.id)) as unknown as Record<string, unknown>;
    expect(back).toMatchObject({ id: herbert.id, title: "Frank Herbert", aliases: ["F. Herbert"], externalKey: "openlibrary:/authors/OL1A", born: "1920", died: "1986", deleted: 0 });
    expect((await work(dune)).authors).toEqual([herbert.id]);
    expect((await work(messiah)).authors.sort()).toEqual([herbert.id, other.id].sort());
    expect((await work(emma)).authors).toEqual([other.id]);
  });
});
