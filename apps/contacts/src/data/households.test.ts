import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildLinkIndex, db, documentsOf, documentsTable, getDocument, initApps, moveDocumentsToWorkspace, removeDocument } from "@lifeline/core";
import { householdTypeDef, personTypeDef, tieTypeDef } from "../types";
import { addPerson } from "./repo";
import { addHousehold, addMember, joinNewHousehold, removeMember, restoreMember, setMembershipDays } from "./households";
import type { Household } from "../domain/types";

initApps([{ id: "contacts", title: "Contacts", module: "people", types: [personTypeDef, tieTypeDef, householdTypeDef], screens: [], cards: [], commands: [] }]);

beforeEach(async () => {
  await documentsTable().clear();
});

// Read past the Workspace gate: a moved Household is out of the current scope.
const membersIn = async (id: string) => (((await documentsTable().get(id)) as Household | undefined)?.members ?? []).map((m) => m.personId);

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

  it("lets a Person who moves to another Workspace leave the Households of the old one", async () => {
    const paul = await addPerson({ name: "Paul" });
    const tom = await addPerson({ name: "Tom" });
    const smiths = await addHousehold({ name: "the Smiths" });
    await addMember(smiths.id, paul.id);
    await addMember(smiths.id, tom.id);
    await moveDocumentsToWorkspace([paul.id], "ws2");
    expect(await membersIn(smiths.id)).toEqual([tom.id]);
  });

  it("keeps, of a Household that moves, only the members in its new Workspace", async () => {
    const paul = await addPerson({ name: "Paul" });
    const tom = await addPerson({ name: "Tom" });
    const smiths = await addHousehold({ name: "the Smiths" });
    await addMember(smiths.id, paul.id);
    await addMember(smiths.id, tom.id);
    await moveDocumentsToWorkspace([smiths.id, tom.id], "ws2");
    expect(await membersIn(smiths.id)).toEqual([tom.id]);
  });

  it("touches no Person when it is deleted", async () => {
    const paul = await addPerson({ name: "Paul" });
    const smiths = await addHousehold({ name: "the Smiths" });
    await addMember(smiths.id, paul.id);
    const before = await getDocument(paul.id);
    await removeDocument(smiths.id);
    expect(await documentsOf("contacts_household")).toEqual([]);
    expect(await getDocument(paul.id)).toEqual(before);
  });
});

describe("joining a new Household (ADR 0117)", () => {
  it("leaves no empty Household when the join fails, and the name stays free", async () => {
    await expect(joinNewHousehold("no-such-person", "the Smiths")).rejects.toThrow();
    expect(await documentsOf("contacts_household")).toEqual([]);
    const paul = await addPerson({ name: "Paul" });
    const h = await joinNewHousehold(paul.id, "the Smiths");
    expect(await membersIn(h.id)).toEqual([paul.id]);
  });

  it("reports why the join failed even when taking the Household back fails too", async () => {
    const add = vi.spyOn(db()._outbox, "bulkAdd").mockRejectedValue(new Error("disk full"));
    try {
      await expect(joinNewHousehold("no-such-person", "the Smiths")).rejects.toThrow("Only a Person of this Workspace");
    } finally {
      add.mockRestore();
    }
  });
});

describe("a membership's days (ADR 0117)", () => {
  it("are set and cleared per membership, the other keys and members left alone", async () => {
    const paul = await addPerson({ name: "Paul" });
    const tom = await addPerson({ name: "Tom" });
    const h = await addHousehold({ name: "the Smiths" });
    await addMember(h.id, paul.id);
    await addMember(h.id, tom.id);
    await setMembershipDays(h.id, tom.id, { since: "2001-04-02", until: "2024-09-01" });
    expect((await getDocument<Household>(h.id))?.members).toEqual([{ personId: paul.id }, { personId: tom.id, since: "2001-04-02", until: "2024-09-01" }]);
    await setMembershipDays(h.id, tom.id, { since: "" });
    expect((await getDocument<Household>(h.id))?.members[1]).toEqual({ personId: tom.id, until: "2024-09-01" });
  });

  it("refuse an until before the since, and a Person who is not a member", async () => {
    const paul = await addPerson({ name: "Paul" });
    const h = await addHousehold({ name: "the Smiths" });
    await addMember(h.id, paul.id);
    await setMembershipDays(h.id, paul.id, { since: "2020-05-01" });
    await expect(setMembershipDays(h.id, paul.id, { until: "2020-04-30" })).rejects.toThrow("before");
    await expect(setMembershipDays(h.id, "nobody", { until: "2020-04-30" })).rejects.toThrow("not in it");
  });

  it("stay with a former member removed and put back by Undo", async () => {
    const paul = await addPerson({ name: "Paul" });
    const h = await addHousehold({ name: "the Smiths" });
    await addMember(h.id, paul.id);
    await setMembershipDays(h.id, paul.id, { until: "2024-09-01" });
    const removed = await removeMember(h.id, paul.id);
    await restoreMember(h.id, removed);
    expect((await getDocument<Household>(h.id))?.members).toEqual([{ personId: paul.id, until: "2024-09-01" }]);
  });
});
