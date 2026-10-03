import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { documentsTable, getDocument, initApps, patchDocument } from "@lifeline/core";
import { workTypeDefs, authorTypeDef } from "../types";
import type { Work } from "../domain/types";
import { addWork, allAuthors, allWorks, ensureAuthor, normalize, patchWork, quickAddWork } from "./repo";

initApps([{ id: "library", title: "Library", types: [...workTypeDefs, authorTypeDef], screens: [], cards: [], commands: [] }]);

const work = async (id: string) => normalize((await getDocument<Work>(id))!);

beforeEach(async () => {
  await documentsTable().clear();
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
    expect((await allAuthors())[0].externalKey).toBe(ol("9"));
  });

  it("links a typed name to the Author it names, keyed or not", async () => {
    const keyed = await ensureAuthor({ name: "Frank Herbert", externalKey: ol("9") });
    expect(await ensureAuthor({ name: "Frank Herbert" })).toBe(keyed);
  });
});
