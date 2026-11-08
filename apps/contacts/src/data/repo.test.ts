import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { createDocument, documentType, documentsTable, getDocument, initApps, saveDocumentType } from "@lifeline/core";
import { personTypeDef } from "../types";
import { addOccasion, addPerson, editOccasion, patchPerson, removeOccasion } from "./repo";

initApps([{ id: "contacts", title: "Contacts", module: "people", types: [personTypeDef], screens: [], cards: [], commands: [] }]);

beforeEach(async () => {
  await documentsTable().clear();
});

describe("adding a Person (ADR 0113)", () => {
  it("takes a name only, and lands in People with no aliases and no Relationship", async () => {
    const p = await addPerson({ name: "  Anne Dupont " });
    expect(p).toMatchObject({ type: "contacts_person", title: "Anne Dupont", folder: "People", aliases: [], relationship: "", tags: [] });
  });

  it("keeps aliases, a Relationship and Tags when given", async () => {
    const p = await addPerson({ name: "Anne Dupont", aliases: ["Mum", " ", "Maman "], relationship: " my mother ", tags: ["Family"] });
    expect(p).toMatchObject({ aliases: ["Mum", "Maman"], relationship: "my mother", tags: ["family"] });
  });

  it("refuses a Person with no name", async () => {
    await expect(addPerson({ name: "  " })).rejects.toThrow("A Person needs a name");
  });
});

describe("changing a Person", () => {
  it("writes their aliases, Relationship and Tags", async () => {
    const p = await addPerson({ name: "Anne Dupont" });
    await patchPerson(p.id, { aliases: ["Mum"], relationship: "my mother", tags: ["family"] });
    expect(await getDocument(p.id)).toMatchObject({ aliases: ["Mum"], relationship: "my mother", tags: ["family"] });
  });

  it("writes their Contact details, and leaves everything else as it was", async () => {
    const p = await addPerson({ name: "Anne Dupont", relationship: "my mother" });
    const contactDetails = [{ id: "c1", label: "Mobile", kind: "phone" as const, value: "+33 6 12 34 56 78", former: false }];
    await patchPerson(p.id, { contactDetails });
    expect(await getDocument(p.id)).toMatchObject({ contactDetails, relationship: "my mother" });
    await patchPerson(p.id, { contactDetails: [] });
    expect(await getDocument(p.id)).toMatchObject({ contactDetails: [] });
  });

  it("refuses an empty name", async () => {
    const p = await addPerson({ name: "Anne Dupont" });
    await expect(patchPerson(p.id, { title: " " })).rejects.toThrow("A Person needs a name");
  });
});

describe("an existing user-defined type for people (ADR 0113)", () => {
  it("keeps its own type and Documents beside the built-in Person", async () => {
    await saveDocumentType({ typeId: "person", label: "People", icon: "user", folder: "People", fields: [{ key: "aliases", label: "Aliases", kind: "list" }], body: "optional", linkable: true, module: "journal", order: 0 });
    for (let i = 0; i < 100 && !documentType("person"); i++) await new Promise((r) => setTimeout(r, 10));
    expect(documentType("person")).toMatchObject({ builtIn: false, homeModule: "journal" });
    const theirs = await createDocument({ type: "person", title: "Ursula", fields: { aliases: ["Ursula K."] } });
    const mine = await addPerson({ name: "Ursula" });
    expect((await getDocument(theirs.id))?.type).toBe("person");
    expect(mine.type).not.toBe("person");
  });
});

describe("a Person's Occasions", () => {
  it("are added, edited and removed", async () => {
    const p = await addPerson({ name: "Anne Dupont" });
    const o = await addOccasion(p.id, { label: " Birthday ", day: "1961-03-04", yearly: true });
    await addOccasion(p.id, { label: "Surgery", day: "2026-05-12", yearly: false });
    expect(((await getDocument(p.id)) as never as { occasions: unknown[] }).occasions).toMatchObject([{ label: "Birthday", day: "1961-03-04", yearly: true }, { label: "Surgery", yearly: false }]);
    await editOccasion(p.id, o.id, { label: "Birthday", day: "03-04", yearly: true });
    expect(((await getDocument(p.id)) as never as { occasions: { day: string }[] }).occasions[0]?.day).toBe("03-04");
    await removeOccasion(p.id, o.id);
    expect(((await getDocument(p.id)) as never as { occasions: unknown[] }).occasions).toHaveLength(1);
  });

  it("refuse what is not an Occasion, writing nothing", async () => {
    const p = await addPerson({ name: "Anne Dupont" });
    await expect(addOccasion(p.id, { label: "Surgery", day: "05-12", yearly: false })).rejects.toThrow("A once Occasion needs its year");
    await expect(addOccasion(p.id, { label: "", day: "05-12", yearly: true })).rejects.toThrow("An Occasion needs a label");
    expect(((await getDocument(p.id)) as never as { occasions?: unknown[] }).occasions ?? []).toEqual([]);
  });
});
