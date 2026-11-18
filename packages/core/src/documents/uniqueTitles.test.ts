import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { initApps } from "../registry";
import { documentsTable, getDocument, patchDocument, putDocument } from "./store";
import { createDocument, moveDocument, renameDocument } from "./ops";
import { TitleTaken } from "./titles";
import type { DocumentTypeDef } from "./types";

const T = (id: string, extra: Partial<DocumentTypeDef> = {}): DocumentTypeDef => ({ id, label: id + "s", singular: id[0]!.toUpperCase() + id.slice(1), titleRule: "name", body: "optional", fields: [], builtIn: true, ...extra });
// A "spot" is titled once in the whole type, as a Place is (ADR 0128); a "note" once per folder.
initApps([{ id: "t", title: "T", types: [T("spot", { uniqueTitles: true }), T("note")], screens: [], cards: [], commands: [] }]);

beforeEach(async () => {
  await documentsTable().clear();
});

/** What a write refused with. */
const refusal = (p: Promise<unknown>) => p.then(() => undefined, (e: unknown) => e);

describe("a type whose titles are unique in every folder", () => {
  it("refuses a rename to a title another of its Documents has in another folder, naming and carrying that one", async () => {
    const janou = await createDocument({ type: "spot", title: "Chez Janou", folder: "Places" });
    const other = await createDocument({ type: "spot", title: "Le Fermé", folder: "Old" });
    const e = await refusal(renameDocument(other, "chez janou"));
    expect(e).toBeInstanceOf(TitleTaken);
    expect((e as TitleTaken).existing.id).toBe(janou.id);
    expect((e as TitleTaken).message).toBe("“chez janou” is already a Spot: Chez Janou");
    expect((await getDocument(other.id))?.title).toBe("Le Fermé");
  });

  it("refuses one made with the title in another folder, accents aside", async () => {
    await createDocument({ type: "spot", title: "Café de Flore", folder: "Places" });
    expect(await refusal(createDocument({ type: "spot", title: "Cafe de Flore", folder: "Elsewhere" }))).toBeInstanceOf(TitleTaken);
  });

  it("refuses a title written straight to the store, as a page's title field and a Base write it", async () => {
    await createDocument({ type: "spot", title: "Chez Janou", folder: "Places" });
    const other = await createDocument({ type: "spot", title: "Le Fermé", folder: "Old" });
    expect(await refusal(putDocument({ ...other, title: "Chez Janou" }))).toBeInstanceOf(TitleTaken);
    expect(await refusal(patchDocument(other.id, { title: "CHEZ JANOU" }))).toBeInstanceOf(TitleTaken);
    expect((await getDocument(other.id))?.title).toBe("Le Fermé");
  });

  it("lets a Document keep its title, in another case too, and move between folders", async () => {
    const janou = await createDocument({ type: "spot", title: "Chez Janou", folder: "Places" });
    await renameDocument(janou, "CHEZ JANOU");
    await moveDocument((await getDocument(janou.id))!, "Elsewhere");
    expect(await getDocument(janou.id)).toMatchObject({ title: "CHEZ JANOU", folder: "Elsewhere" });
  });

  it("still saves a Document that shares its title from before, while its title stays", async () => {
    const a = await putDocument({ type: "spot", title: "Twin", folder: "A" });
    await documentsTable().put({ ...a, id: "twin-b", folder: "B" });
    await patchDocument("twin-b", { body: "kept" });
    expect((await getDocument("twin-b"))?.body).toBe("kept");
  });
});

describe("a type whose titles are unique per folder", () => {
  it("takes the same title in another folder, and refuses it in the same one", async () => {
    await createDocument({ type: "note", title: "Ideas", folder: "A" });
    expect(await createDocument({ type: "note", title: "Ideas", folder: "B" })).toMatchObject({ folder: "B" });
    expect(await refusal(createDocument({ type: "note", title: "ideas", folder: "A" }))).toMatchObject({ message: "“ideas” already exists in A" });
  });
});
