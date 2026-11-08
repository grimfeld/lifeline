import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
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

  it("leaves a Person alone", async () => {
    const u = await putDocument({ type: "author", title: "A" });
    await turnIntoPerson(u.id, "author");
    expect(canTurnIntoPerson((await getDocument(u.id))!, "author")).toBe(false);
  });
});
