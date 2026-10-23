import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { documentsOf, documentsTable, initApps } from "@lifeline/core";
import { pantryTypeDefs } from "../types";
import { PROVISION, type Provision, type Storage } from "../domain/types";
import { addProvision, addStorage, normalizeProvision, normalizeStorage, quickAdd, removeStorageIfEmpty } from "./repo";

initApps([{ id: "pantry", title: "Pantry", types: pantryTypeDefs, screens: [], cards: [], commands: [] }]);

const provisions = async () => (await documentsOf<Provision>(PROVISION)).map(normalizeProvision);

beforeEach(async () => {
  await documentsTable().clear();
});

describe("reading a Provision back", () => {
  it("restores the defaults PocketBase drops, and keeps quantities whole and above zero", () => {
    const p = normalizeProvision({ id: "p", type: PROVISION, title: "Rice", tags: undefined, quantity: "2.6", minimum: -3 } as unknown as Provision);
    expect(p).toMatchObject({ storageId: "", quantity: 3, unit: "", minimum: 0, expires: "", frozenOn: "", tags: [] });
  });

  it("reads a Storage of no known kind as a shelf", () => {
    expect(normalizeStorage({ id: "s", kind: "cellar" } as unknown as Storage)).toMatchObject({ kind: "shelf", tags: [] });
    expect(normalizeStorage({ id: "s", kind: "freezer", tags: ["x"] } as unknown as Storage)).toMatchObject({ kind: "freezer", tags: ["x"] });
  });
});

describe("quick add (ADR 0043)", () => {
  it("restocks the same title in the same Storage instead of duplicating it", async () => {
    const fridge = await addStorage("Fridge", "fridge");
    const id = await addProvision({ title: "Milk", storageId: fridge, quantity: 1 });
    expect(await quickAdd("  milk ", fridge)).toEqual({ id, restocked: true });
    expect((await provisions()).map((p) => [p.title, p.quantity])).toEqual([["Milk", 2]]);
  });

  it("makes a new Provision of one in another Storage", async () => {
    const fridge = await addStorage("Fridge", "fridge");
    const shelf = await addStorage("Shelf", "shelf");
    await addProvision({ title: "Milk", storageId: fridge });
    const out = await quickAdd("Milk", shelf);
    expect(out?.restocked).toBe(false);
    expect((await provisions()).filter((p) => p.storageId === shelf).map((p) => p.quantity)).toEqual([1]);
  });

  it("does nothing with no title or no Storage", async () => {
    expect(await quickAdd("  ", "s")).toBeNull();
    expect(await quickAdd("Milk", "")).toBeNull();
    expect(await provisions()).toEqual([]);
  });
});

describe("removing a Storage", () => {
  it("is refused while it holds a Provision, and done once empty", async () => {
    const fridge = await addStorage("Fridge", "fridge");
    await addProvision({ title: "Milk", storageId: fridge });
    expect(await removeStorageIfEmpty(fridge)).toBe(false);
    const empty = await addStorage("Cellar", "shelf");
    expect(await removeStorageIfEmpty(empty)).toBe(true);
  });
});
