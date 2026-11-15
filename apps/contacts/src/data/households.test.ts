import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { buildLinkIndex, documentsOf, documentsTable, getDocument, initApps, moveDocumentsToWorkspace, removeDocument } from "@lifeline/core";
import { householdTypeDef, personTypeDef, tieTypeDef } from "../types";
import { addPerson } from "./repo";
import { addHousehold, addMember, allHouseholds, joinNewHousehold, removeMember, restoreMember } from "./households";
import type { Household } from "../domain/types";

initApps([{ id: "contacts", title: "Contacts", module: "people", types: [personTypeDef, tieTypeDef, householdTypeDef], screens: [], cards: [], commands: [] }]);

beforeEach(async () => {
  await documentsTable().clear();
});

const membersIn = async (id: string) => ((await getDocument<Household>(id))?.members ?? []).map((m) => m.personId);

describe("Households (ADR 0117)", () => {
  it("is made from a name, with aliases, in its own folder, and no members yet", async () => {
    const h = await addHousehold({ name: " the Smiths ", aliases: ["Smiths", " "] });
    expect(await getDocument(h.id)).toMatchObject({ type: "contacts_household", title: "the Smiths", aliases: ["Smiths"], members: [], folder: "People/Households" });
    await expect(addHousehold({ name: "  " })).rejects.toThrow("needs a name");
  });

  it("is a link target by its name and aliases, shown as a Household", async () => {
    const h = await addHousehold({ name: "the Smiths", aliases: ["Smiths"] });
    const index = buildLinkIndex(await documentsOf("contacts_household"), [householdTypeDef]);
    expect(index.resolve("Smiths")).toMatchObject({ kind: "doc", id: h.id });
    expect(index.names().find((n) => n.name === "the Smiths")?.subtitle).toBe("Household");
  });

  it("takes People as members, each once, and a Person may belong to several", async () => {
    const paul = await addPerson({ name: "Paul" });
    const tom = await addPerson({ name: "Tom" });
    const smiths = await addHousehold({ name: "the Smiths" });
    const flat = await addHousehold({ name: "Student flat" });
    await addMember(smiths.id, paul.id);
    await addMember(smiths.id, tom.id);
    await addMember(smiths.id, tom.id);
    await addMember(flat.id, tom.id);
    expect(await membersIn(smiths.id)).toEqual([paul.id, tom.id]);
    expect(await membersIn(flat.id)).toEqual([tom.id]);
  });

  it("refuses as a member what is no Person, or a Person of another Workspace", async () => {
    const smiths = await addHousehold({ name: "the Smiths" });
    const other = await addHousehold({ name: "the Joneses" });
    await expect(addMember(smiths.id, other.id)).rejects.toThrow("Only a Person");
    const away = await addPerson({ name: "Away" });
    await moveDocumentsToWorkspace([away.id], "ws2");
    await expect(addMember(smiths.id, away.id)).rejects.toThrow("Only a Person");
    expect(await membersIn(smiths.id)).toEqual([]);
  });

  it("lets a member go, and Undo puts them back with their days", async () => {
    const paul = await addPerson({ name: "Paul" });
    const tom = await addPerson({ name: "Tom" });
    const smiths = await addHousehold({ name: "the Smiths" });
    await addMember(smiths.id, paul.id);
    await addMember(smiths.id, tom.id);
    const removed = await removeMember(smiths.id, paul.id);
    expect(await membersIn(smiths.id)).toEqual([tom.id]);
    await restoreMember(smiths.id, removed);
    expect(await membersIn(smiths.id)).toEqual([paul.id, tom.id]);
  });

  it("joins a Person to a Household made there and then, from their page", async () => {
    const tom = await addPerson({ name: "Tom" });
    const h = await joinNewHousehold(tom.id, "Student flat");
    expect(await getDocument(h.id)).toMatchObject({ title: "Student flat", members: [{ personId: tom.id }] });
  });

  it("drops a deleted Person's memberships, and the Household stays", async () => {
    const paul = await addPerson({ name: "Paul" });
    const tom = await addPerson({ name: "Tom" });
    const smiths = await addHousehold({ name: "the Smiths" });
    await addMember(smiths.id, paul.id);
    await addMember(smiths.id, tom.id);
    await removeDocument(paul.id);
    expect(await membersIn(smiths.id)).toEqual([tom.id]);
  });

  it("touches no Person when it is deleted", async () => {
    const paul = await addPerson({ name: "Paul" });
    const smiths = await addHousehold({ name: "the Smiths" });
    await addMember(smiths.id, paul.id);
    const before = await getDocument(paul.id);
    await removeDocument(smiths.id);
    expect(await allHouseholds()).toEqual([]);
    expect(await getDocument(paul.id)).toEqual(before);
  });
});
