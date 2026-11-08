import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { PERSON_TYPE, createDocument, documentType, documentsTable, getDocument, initApps, putDocument, removeDocument, saveDocumentType, type DocumentTypeDef, type FieldDef } from "@lifeline/core";
import { personTypeDef } from "../types";
import { addOccasion, addOccasionByName, addPerson, editOccasion, patchPerson, removePart, restorePart, updateContactDetails } from "./repo";

// Stand-ins for the other Apps' People fields (Contacts imports none of them): an Event's With, a Task's
// and a Transaction's For, a work's Recommended by.
const peopleField = (key: string): FieldDef => ({ key, label: key, kind: "links", linkType: PERSON_TYPE });
const standIn = (id: string, key: string): DocumentTypeDef => ({ id, label: id, titleRule: "name", body: "none", builtIn: true, fields: [peopleField(key)] });
initApps([
  { id: "contacts", title: "Contacts", module: "people", types: [personTypeDef], screens: [], cards: [], commands: [] },
  { id: "others", title: "Others", types: [standIn("event", "with"), standIn("task", "for"), standIn("ledger_transaction", "for"), standIn("book", "recommendedBy")], screens: [], cards: [], commands: [] },
]);

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

  it("writes their Contact details onto the stored list, and leaves everything else as it was", async () => {
    const p = await addPerson({ name: "Anne Dupont", relationship: "my mother" });
    const mobile = { id: "c1", label: "Mobile", kind: "phone" as const, value: "+33 6 12 34 56 78", former: false };
    const work = { id: "c2", label: "Work", kind: "email" as const, value: "anne@example.org", former: false };
    await updateContactDetails(p.id, () => [mobile]);
    expect(await getDocument(p.id)).toMatchObject({ contactDetails: [mobile], relationship: "my mother" });
    // Each change starts from what is stored, not from a copy the screen held.
    await updateContactDetails(p.id, (l) => [...l, work]);
    await updateContactDetails(p.id, (l) => l.map((c) => (c.id === "c1" ? { ...c, former: true } : c)));
    expect(await getDocument(p.id)).toMatchObject({ contactDetails: [{ ...mobile, former: true }, work] });
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
    const removed = await removePart(p.id, "occasions", o.id);
    expect(((await getDocument(p.id)) as never as { occasions: unknown[] }).occasions).toHaveLength(1);
    // Undo puts back that one, where it stood, keeping one added since.
    await addOccasion(p.id, { label: "Met", day: "1990-06-01", yearly: true });
    await restorePart(p.id, "occasions", removed);
    expect(((await getDocument(p.id)) as never as { occasions: { label: string }[] }).occasions.map((x) => x.label)).toEqual(["Birthday", "Surgery", "Met"]);
  });

  it("refuse what is not an Occasion, writing nothing", async () => {
    const p = await addPerson({ name: "Anne Dupont" });
    await expect(addOccasion(p.id, { label: "Surgery", day: "05-12", yearly: false })).rejects.toThrow("A once Occasion needs its year");
    await expect(addOccasion(p.id, { label: "", day: "05-12", yearly: true })).rejects.toThrow("An Occasion needs a label");
    expect(((await getDocument(p.id)) as never as { occasions?: unknown[] }).occasions ?? []).toEqual([]);
  });
});

describe("adding an Occasion by name", () => {
  it("finds the Person by an alias", async () => {
    const p = await addPerson({ name: "Anne Dupont", aliases: ["Mum"] });
    const { occasion } = await addOccasionByName("mum", { label: "Birthday", day: "1961-11-12", yearly: true });
    expect(((await getDocument(p.id)) as unknown as { occasions: unknown[] }).occasions).toEqual([occasion]);
  });
  it("refuses an unknown name and an ambiguous one", async () => {
    await addPerson({ name: "Anne", aliases: ["Mum"] });
    await addPerson({ name: "Anna", aliases: ["Mum"] });
    await expect(addOccasionByName("Bob", { label: "Birthday", day: "01-01", yearly: true })).rejects.toThrow(/No Person called/);
    await expect(addOccasionByName("Mum", { label: "Birthday", day: "01-01", yearly: true })).rejects.toThrow(/ambiguous/);
  });
});

describe("deleting a Person", () => {
  it("unlinks them from every People field, and keeps what linked them", async () => {
    const marc = await addPerson({ name: "Marc" });
    const jo = await addPerson({ name: "Jo" });
    const linking = [
      { id: "e1", type: "event", key: "with" },
      { id: "t1", type: "task", key: "for" },
      { id: "x1", type: "ledger_transaction", key: "for" },
      { id: "b1", type: "book", key: "recommendedBy" },
    ];
    for (const l of linking) await putDocument({ id: l.id, type: l.type, title: l.id, [l.key]: [marc.id, jo.id] });
    await removeDocument(marc.id);
    for (const l of linking) expect((await getDocument(l.id))?.[l.key]).toEqual([jo.id]);
  });
});
