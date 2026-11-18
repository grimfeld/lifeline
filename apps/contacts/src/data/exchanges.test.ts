import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { EXCHANGE_TYPE, allDocuments, allDocumentTypes, buildLinkIndex, documentsTable, getDocument, initApps, patchDocument, removeDocument, todayStr } from "@lifeline/core";
import { exchangeTypeDef, householdTypeDef, personTypeDef, tieTypeDef } from "../types";
import { addPerson } from "./repo";
import { addExchange, editExchange } from "./exchanges";
import type { Exchange } from "../domain/types";

initApps([{ id: "contacts", title: "Contacts", module: "people", types: [personTypeDef, tieTypeDef, householdTypeDef, exchangeTypeDef], screens: [], cards: [], commands: [] }]);

beforeEach(async () => {
  await documentsTable().clear();
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
