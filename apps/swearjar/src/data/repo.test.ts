import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { documentsOf, documentsTable, initApps, removeDocument } from "@lifeline/core";
import { swearjarApp } from "../index";
import { FINE, OFFENCE, type Fine, type Offence } from "../domain/types";
import { addOffence, allOffences, editFine, logFine, setOffenceArchived, updateOffence } from "./repo";

initApps([swearjarApp]);

const offence = async (id: string) => (await allOffences()).find((o) => o.id === id)!;
const fines = async () => documentsOf<Fine>(FINE);

beforeEach(async () => {
  await documentsTable().clear();
});

describe("an Offence", () => {
  it("needs a name and a price above zero", async () => {
    await expect(addOffence({ name: "  ", price: 100 })).rejects.toThrow("name");
    await expect(addOffence({ name: "Swore", price: 0 })).rejects.toThrow("Price");
  });

  it("keeps one grapheme as its face and drops a colour that is no slot", async () => {
    const id = await addOffence({ name: " Swore ", price: 150.4, emoji: "🤬🤬", color: "hotpink" });
    expect(await offence(id)).toMatchObject({ name: "Swore", title: "Swore", price: 150, emoji: "🤬", color: "", archived: false });
  });

  it("is not deleted while it has Fines (ADR 0083)", async () => {
    const id = await addOffence({ name: "Swore", price: 100 });
    await logFine(await offence(id));
    await expect(removeDocument(id)).rejects.toThrow("archive it instead");
    const unused = await addOffence({ name: "Snoozed", price: 100 });
    await removeDocument(unused);
    expect((await documentsOf<Offence>(OFFENCE)).map((o) => o.id)).toEqual([id]);
  });
});

describe("a Fine", () => {
  it("costs the Offence's price when logged, and keeps it through a reprice", async () => {
    const id = await addOffence({ name: "Swore", price: 200 });
    await logFine(await offence(id), { occurredAt: "2026-10-01T10:00:00.000Z", note: " at work " });
    await updateOffence(await offence(id), { name: "Swore", price: 500 });
    const [f] = await fines();
    expect(f).toMatchObject({ offenceId: id, amount: 200, note: "at work", occurredAt: "2026-10-01T10:00:00.000Z" });
  });

  it("is refused against an archived Offence", async () => {
    const id = await addOffence({ name: "Swore", price: 200 });
    await setOffenceArchived(id, true);
    await expect(logFine(await offence(id))).rejects.toThrow("archived");
  });

  it("keeps both edits made one after the other from its Peek", async () => {
    const id = await addOffence({ name: "Swore", price: 200 });
    const fid = await logFine(await offence(id), { occurredAt: "2026-10-01T10:00:00.000Z" });
    await Promise.all([editFine(fid, { note: "again" }), editFine(fid, { occurredAt: "2026-10-02T10:00:00.000Z" })]);
    expect((await fines())[0]).toMatchObject({ amount: 200, note: "again", occurredAt: "2026-10-02T10:00:00.000Z" });
  });
});
