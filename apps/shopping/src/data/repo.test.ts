import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { documentsOf, documentsTable, initApps, removeDocument } from "@lifeline/core";
import { shoppingTypeDefs } from "../types";
import { addAisle, addNeed, allNeeds, markBought, normalizeAisle, saveNeed, shiftAisle } from "./repo";
import { AISLE, type Aisle } from "../domain/types";

initApps([{ id: "shopping", title: "Shopping", types: shoppingTypeDefs, screens: [], cards: [], commands: [] }]);

const need = async (id: string) => (await allNeeds()).find((n) => n.id === id)!;
const aisles = async () => (await documentsOf<Aisle>(AISLE)).map(normalizeAisle);

beforeEach(async () => {
  await documentsTable().clear();
});

describe("adding a Need (ADR 0055)", () => {
  it("makes one for a new title", async () => {
    const out = await addNeed({ title: " Milk ", note: "oat" });
    expect(out?.kind).toBe("new");
    expect(await need(out!.id)).toMatchObject({ title: "Milk", note: "oat", aisleId: "", boughtOn: "" });
  });

  it("adds a typed note to a Need already listed, and makes nothing", async () => {
    const first = await addNeed({ title: "Milk", note: "oat" });
    expect(await addNeed({ title: "milk", note: "2 cartons" })).toEqual({ kind: "listed", id: first!.id });
    expect((await allNeeds()).map((n) => n.note)).toEqual(["oat; 2 cartons"]);
  });

  it("brings a Bought Need back, keeping its Aisle unless another is typed", async () => {
    const dairy = await addAisle("Dairy");
    const first = await addNeed({ title: "Milk", aisleId: dairy });
    await markBought(first!.id);
    expect(await addNeed({ title: "MILK" })).toEqual({ kind: "revive", id: first!.id });
    expect(await need(first!.id)).toMatchObject({ boughtOn: "", aisleId: dairy });
  });

  it("makes nothing of an empty title", async () => {
    expect(await addNeed({ title: "  " })).toBeNull();
  });
});

describe("saving a Need", () => {
  it("refuses a rename onto another Need's title", async () => {
    await addNeed({ title: "Milk" });
    const bread = await addNeed({ title: "Bread" });
    expect(await saveNeed(bread!.id, { title: "milk", note: "", aisleId: "" })).toBe(false);
    expect(await saveNeed(bread!.id, { title: " Rye bread ", note: " sliced ", aisleId: "" })).toBe(true);
    expect(await need(bread!.id)).toMatchObject({ title: "Rye bread", note: "sliced" });
  });
});

describe("Aisles", () => {
  it("take the next rank, and move in the walk", async () => {
    const a = await addAisle("Bakery");
    const b = await addAisle("Dairy");
    expect((await aisles()).map((x) => [x.id, x.rank])).toEqual(expect.arrayContaining([[a, 0], [b, 1]]));
    await shiftAisle(await aisles(), b, -1);
    expect(Object.fromEntries((await aisles()).map((x) => [x.id, x.rank]))).toEqual({ [b]: 0, [a]: 1 });
  });

  it("leave their Needs buyable anywhere when deleted", async () => {
    const dairy = await addAisle("Dairy");
    const milk = await addNeed({ title: "Milk", aisleId: dairy });
    await removeDocument(dairy);
    expect((await need(milk!.id)).aisleId).toBe("");
  });
});
