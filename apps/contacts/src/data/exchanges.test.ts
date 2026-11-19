import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { EXCHANGE_TYPE, PERSON_TYPE, allDocuments, allDocumentTypes, buildLinkIndex, db, documentsTable, getDocument, initApps, patchDocument, removeDocument, todayStr, type Document } from "@lifeline/core";
import { exchangeTypeDef, householdTypeDef, personTypeDef, tieTypeDef } from "../types";
import { addPerson } from "./repo";
import { addExchange, editExchange } from "./exchanges";
import type { Exchange } from "../domain/types";

initApps([{ id: "contacts", title: "Contacts", module: "people", types: [personTypeDef, tieTypeDef, householdTypeDef, exchangeTypeDef], screens: [], cards: [], commands: [] }]);

beforeEach(async () => {
  await documentsTable().clear();
  await db()._meta.clear();
});

const read = async (id: string) => (await documentsTable().get(id)) as Exchange;

describe("an Exchange (ADR 0131)", () => {
  it("is made with its People, kind, day and body, titled from them", async () => {
    const grandma = await addPerson({ name: "Grandma" });
    const x = await addExchange({ with: [grandma.id], kind: "call", date: "2026-11-01", body: "The hip surgery went well." });
    expect(await getDocument(x.id)).toMatchObject({ type: EXCHANGE_TYPE, title: "Call · Grandma", with: [grandma.id], kind: "call", date: "2026-11-01", body: "The hip surgery went well." });
  });

  it("is a call today unless told otherwise", async () => {
    const marc = await addPerson({ name: "Marc" });
    const lea = await addPerson({ name: "Léa" });
    const x = await addExchange({ with: [marc.id, lea.id] });
    expect(await read(x.id)).toMatchObject({ kind: "call", date: todayStr(), title: "Call · Marc, Léa" });
  });

  it("refuses a day to come, nobody, or what is no Person, writing nothing", async () => {
    const marc = await addPerson({ name: "Marc" });
    await expect(addExchange({ with: [marc.id], date: "2999-01-01" })).rejects.toThrow("An exchange is something that happened. Plan a call as a Task or an Event.");
    await expect(addExchange({ with: [] })).rejects.toThrow("at least one Person");
    await expect(addExchange({ with: ["nope"] })).rejects.toThrow("Only People");
    expect((await allDocuments()).filter((d) => d.type === EXCHANGE_TYPE)).toEqual([]);
  });

  it("is no link target: [[Call · Marc]] names nothing", async () => {
    const marc = await addPerson({ name: "Marc" });
    await addExchange({ with: [marc.id] });
    const index = buildLinkIndex(await allDocuments(), allDocumentTypes());
    expect(index.resolve("Call · Marc")).toMatchObject({ kind: "unresolved" });
  });

  it("is titled again when it is edited, or one of its People is renamed", async () => {
    const marc = await addPerson({ name: "Marc" });
    const lea = await addPerson({ name: "Léa" });
    const x = await addExchange({ with: [marc.id] });
    await editExchange(x.id, { kind: "message", with: [marc.id, lea.id] });
    expect((await read(x.id)).title).toBe("Message · Marc, Léa");
    await patchDocument(lea.id, { title: "Léa Martin" });
    expect((await read(x.id)).title).toBe("Message · Marc, Léa Martin");
  });

  it("refuses an edit to a day to come or to nobody", async () => {
    const marc = await addPerson({ name: "Marc" });
    const x = await addExchange({ with: [marc.id], date: "2026-11-01" });
    await expect(editExchange(x.id, { date: "2999-01-01" })).rejects.toThrow("something that happened");
    await expect(editExchange(x.id, { with: [] })).rejects.toThrow("at least one Person");
    expect(await read(x.id)).toMatchObject({ date: "2026-11-01", with: [marc.id] });
  });

  it("loses a deleted Person from its With and stays, shown as with nobody once all are gone", async () => {
    const marc = await addPerson({ name: "Marc" });
    const lea = await addPerson({ name: "Léa" });
    const x = await addExchange({ with: [marc.id, lea.id], body: "Lunch plans" });
    await removeDocument(marc.id);
    expect(await read(x.id)).toMatchObject({ with: [lea.id], title: "Call · Léa", deleted: 0 });
    await removeDocument(lea.id);
    expect(await read(x.id)).toMatchObject({ with: [], title: "Call · nobody", body: "Lunch plans", deleted: 0 });
  });
});

describe("an Exchange's title names no one the views hide (ADR 0038, 0048)", () => {
  const row = (id: string, fields: Record<string, unknown>) =>
    ({ id, title: "", folder: "People", tags: [], createdAt: "2026-11-01", updatedAt: "2026-11-01", deleted: 0, workspace: "", ...fields }) as unknown as Document;
  const seed = (...rows: Document[]) => documentsTable().bulkPut(rows);
  // Pulled once, no password set: the Private folder is open, as on the device that logs the call.
  const openPrivate = () => db()._meta.put({ key: "cursor:documents", value: "1" });

  it("calls a Person in the Private folder someone, however it is logged or edited", async () => {
    await openPrivate();
    const marc = await addPerson({ name: "Marc" });
    await seed(row("secret", { type: PERSON_TYPE, title: "Secret", folder: "Private/People" }), row("hidden", { type: PERSON_TYPE, title: "Hidden", folder: "Private" }));
    const x = await addExchange({ with: [marc.id, "secret"] });
    expect((await read(x.id)).title).toBe("Call · Marc, someone");
    await editExchange(x.id, { with: ["secret"] });
    expect((await read(x.id)).title).toBe("Call · someone");
    await editExchange(x.id, { with: ["secret", marc.id, "hidden"] });
    expect((await read(x.id)).title).toBe("Call · Marc, 2 people");
    await patchDocument("secret", { title: "Secret Again" });
    expect(JSON.stringify(await read(x.id))).not.toContain("Secret");
  });

  it("names only the People of its own Workspace", async () => {
    const marc = await addPerson({ name: "Marc" });
    await seed(row("far", { type: PERSON_TYPE, title: "Faraway", workspace: "ws2" }));
    const x = await addExchange({ with: [marc.id] });
    await documentsTable().update(x.id, { with: [marc.id, "far"] });
    await editExchange(x.id, { kind: "letter" });
    expect((await read(x.id)).title).toBe("Letter · Marc");
  });

  it("follows a rename or a delete in another Workspace too", async () => {
    await seed(row("lea", { type: PERSON_TYPE, title: "Léa", workspace: "ws2" }), row("x2", { type: EXCHANGE_TYPE, title: "Call · Léa", kind: "call", date: "2026-11-01", with: ["lea"], folder: "People/Exchanges", workspace: "ws2" }));
    await patchDocument("lea", { title: "Léa Martin" });
    expect(await read("x2")).toMatchObject({ title: "Call · Léa Martin", workspace: "ws2" });
    await removeDocument("lea");
    expect(await read("x2")).toMatchObject({ title: "Call · nobody", with: [], workspace: "ws2" });
  });
});
