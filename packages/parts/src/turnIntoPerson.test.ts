import "fake-indexeddb/auto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildLinkIndex, documentsTable, documentTypeSync, getDocument, hasRole, initApps, isLinkTarget, putDocument, type DocumentTypeDef, type RoleDef } from "@lifeline/core";
import { canTurnIntoPerson, turnIntoPerson } from "./turnIntoPerson";

const author: DocumentTypeDef = {
  id: "author", label: "Authors", titleRule: "name", body: "optional", linkable: {}, builtIn: true,
  fields: [{ key: "aliases", label: "Aliases", kind: "list" }, { key: "born", label: "Born", kind: "text" }],
};
const book: DocumentTypeDef = {
  id: "book", label: "Books", titleRule: "name", body: "optional", linkable: {}, builtIn: true,
  fields: [{ key: "authors", label: "Authors", kind: "links", linkRole: "author" }],
};
const person: DocumentTypeDef = {
  id: "contacts_person", label: "People", titleRule: "name", body: "optional", linkable: {}, folder: "People", builtIn: true,
  fields: [{ key: "aliases", label: "Aliases", kind: "list" }, { key: "relationship", label: "Relationship", kind: "text" }],
};
const authorRole: RoleDef = { id: "author", label: "Author", homeType: "author", fields: author.fields.filter((f) => f.key !== "aliases") };

initApps([
  { id: "library", title: "Library", types: [author, book], roles: [authorRole], screens: [], cards: [], commands: [] },
  { id: "contacts", title: "Contacts", types: [person], screens: [], cards: [], commands: [] },
]);

beforeEach(async () => {
  await documentsTable().clear();
});

describe("turning an Author into a Person", () => {
  it("makes it a Person wearing the Role, keeping its id, title, aliases, body, born and folder", async () => {
    const ursula = await putDocument({ type: "author", title: "Ursula Le Guin", aliases: ["Ursula K."], born: "1929", body: "Met at a reading.", folder: "Writers", tags: ["sf"] });
    const out = await turnIntoPerson(ursula.id, "author");
    expect(out).toMatchObject({ id: ursula.id, type: "contacts_person", title: "Ursula Le Guin", aliases: ["Ursula K."], born: "1929", body: "Met at a reading.", folder: "Writers", tags: ["sf"], roles: ["author"] });
    expect(await getDocument(ursula.id)).toMatchObject({ type: "contacts_person", roles: ["author"] });
  });

  it("still counts as an Author: its works keep linking to it and a link target accepts it", async () => {
    const ursula = await putDocument({ type: "author", title: "Ursula Le Guin" });
    const dispossessed = await putDocument({ type: "book", title: "The Dispossessed", authors: [ursula.id] });
    await turnIntoPerson(ursula.id, "author");
    const now = (await getDocument(ursula.id))!;
    expect(hasRole(now, "author")).toBe(true);
    expect(isLinkTarget({ linkRole: "author" }, now)).toBe(true);
    const docs = [now, (await getDocument(dispossessed.id))!];
    const index = buildLinkIndex(docs, [author, book, person]);
    expect(index.backlinksTo(ursula.id).map((b) => b.field)).toEqual(["authors"]);
  });

  it("keeps wikilinks resolving to it by title and alias", async () => {
    const ursula = await putDocument({ type: "author", title: "Ursula Le Guin", aliases: ["Ursula K."] });
    const note = await putDocument({ type: "book", title: "N", body: "see [[Ursula K.]]" });
    await turnIntoPerson(ursula.id, "author");
    const index = buildLinkIndex([(await getDocument(ursula.id))!, (await getDocument(note.id))!], [author, book, person]);
    expect(index.backlinksTo(ursula.id)).toHaveLength(1);
  });

  it("refuses a Document that is not of the Role's home type, and a name a Person already has", async () => {
    const b = await putDocument({ type: "book", title: "Dune" });
    expect(canTurnIntoPerson(b, "author")).toBe(false);
    await expect(turnIntoPerson(b.id, "author")).rejects.toThrow("Only an Author");
    await putDocument({ type: "contacts_person", title: "Ursula Le Guin", folder: "" });
    const u = await putDocument({ type: "author", title: "Ursula Le Guin", folder: "" });
    await expect(turnIntoPerson(u.id, "author")).rejects.toThrow("already");
    expect(documentTypeSync("author")).toBeTruthy();
  });

  it("offers it for an Author while Contacts is in the build, never for a Role that does not exist", () => {
    expect(canTurnIntoPerson({ type: "author" }, "author")).toBe(true);
    expect(canTurnIntoPerson({ type: "author" }, "painter")).toBe(false);
  });

  it("refuses what is not there: a Document gone, or a Role that does not exist", async () => {
    const u = await putDocument({ type: "author", title: "A" });
    await expect(turnIntoPerson("gone", "author")).rejects.toThrow("Not found");
    await expect(turnIntoPerson(u.id, "painter")).rejects.toThrow("Not found");
  });

  it("names the folder a Person of that name is already in, or the root", async () => {
    await putDocument({ type: "contacts_person", title: "Ursula Le Guin", folder: "Writers" });
    await putDocument({ type: "contacts_person", title: "Ursula Le Guin", folder: "" });
    const inFolder = await putDocument({ type: "author", title: "ursula le guin ", folder: "Writers" });
    const atRoot = await putDocument({ type: "author", title: "Ursula Le Guin", folder: "" });
    await expect(turnIntoPerson(inFolder.id, "author")).rejects.toThrow("already exists in Writers");
    await expect(turnIntoPerson(atRoot.id, "author")).rejects.toThrow("already exists in the root");
  });

  it("keeps the Roles it already wore, and wears the Role once", async () => {
    const both = await putDocument({ type: "author", title: "A", roles: ["artist"] });
    const already = await putDocument({ type: "author", title: "B", roles: ["author"] });
    expect((await turnIntoPerson(both.id, "author")).roles).toEqual(["artist", "author"]);
    expect((await turnIntoPerson(already.id, "author")).roles).toEqual(["author"]);
  });

  it("leaves a Person alone", async () => {
    const u = await putDocument({ type: "author", title: "A" });
    await turnIntoPerson(u.id, "author");
    expect(canTurnIntoPerson((await getDocument(u.id))!, "author")).toBe(false);
  });
});

describe("without Contacts in the build", () => {
  beforeAll(() => {
    initApps([{ id: "library", title: "Library", types: [author, book], roles: [authorRole], screens: [], cards: [], commands: [] }]);
  });

  it("neither offers nor does it", async () => {
    const u = await putDocument({ type: "author", title: "A" });
    expect(canTurnIntoPerson(u, "author")).toBe(false);
    await expect(turnIntoPerson(u.id, "author")).rejects.toThrow("People is not available");
  });
});
