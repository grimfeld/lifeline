import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { documentsTable, getDocument, initApps } from "@lifeline/core";
import { personTypeDef } from "../types";
import type { Address } from "../domain/types";
import { addPerson } from "./repo";
import { locate, relocateAddress, saveAddress, type Lookup } from "./addresses";

initApps([{ id: "contacts", title: "Contacts", module: "people", types: [personTypeDef], screens: [], cards: [], commands: [] }]);

beforeEach(async () => {
  await documentsTable().clear();
});

const PARIS = { lat: 48.86, lon: 2.35 };
/** A lookup that finds `at` (or nothing), and remembers what it was asked. */
function lookupFinding(at: { lat: number; lon: number } | null) {
  const asked: string[] = [];
  const lookup: Lookup = async (text) => {
    asked.push(text);
    return at;
  };
  return { lookup, asked };
}
const addressesOf = async (id: string) => ((await getDocument(id)) as { addresses?: Address[] }).addresses ?? [];

describe("looking a place up", () => {
  it("takes the first hit's coordinates", async () => {
    const asked: [string, number][] = [];
    const find = async (q: string, limit: number) => {
      asked.push([q, limit]);
      return [{ ...PARIS, label: "Paris" }, { lat: 1, lon: 2, label: "Elsewhere" }];
    };
    expect(await locate("Paris", find)).toEqual(PARIS);
    expect(asked).toEqual([["Paris", 1]]);
  });
  it("finds nothing when there is no hit, or when the lookup fails", async () => {
    expect(await locate("Nowhere", async () => [])).toBeNull();
    expect(
      await locate("Paris", async () => {
        throw new Error("offline");
      }),
    ).toBeNull();
  });
});

describe("saving an Address", () => {
  it("adds one with the place found for its text", async () => {
    const p = await addPerson({ name: "Anne" });
    const { lookup, asked } = lookupFinding(PARIS);
    expect(await saveAddress(p.id, undefined, { label: "Home", text: " 1 Rue X, Paris " }, lookup)).toBe(true);
    expect(asked).toEqual([" 1 Rue X, Paris "]);
    expect(await addressesOf(p.id)).toMatchObject([{ label: "Home", text: "1 Rue X, Paris", former: false, ...PARIS }]);
  });

  it("adds one with no place when none is found, and says so", async () => {
    const p = await addPerson({ name: "Anne" });
    expect(await saveAddress(p.id, undefined, { label: "", text: "Somewhere" }, lookupFinding(null).lookup)).toBe(false);
    const [a] = await addressesOf(p.id);
    expect(a).toMatchObject({ label: "Address", text: "Somewhere" });
    expect(a?.lat).toBeUndefined();
  });

  it("refuses an Address with no text before looking anything up", async () => {
    const p = await addPerson({ name: "Anne" });
    const { lookup, asked } = lookupFinding(PARIS);
    await expect(saveAddress(p.id, undefined, { label: "Home", text: "  " }, lookup)).rejects.toThrow("An Address needs its text.");
    expect(asked).toEqual([]);
    expect(await addressesOf(p.id)).toEqual([]);
  });

  it("keeps the place of an Address whose text did not change, without a lookup", async () => {
    const p = await addPerson({ name: "Anne" });
    await saveAddress(p.id, undefined, { label: "Home", text: "1 Rue X" }, lookupFinding(PARIS).lookup);
    const [home] = await addressesOf(p.id);
    const { lookup, asked } = lookupFinding(null);
    expect(await saveAddress(p.id, home, { label: "Old home", text: " 1 Rue X " }, lookup)).toBe(true);
    expect(asked).toEqual([]);
    expect(await addressesOf(p.id)).toMatchObject([{ id: home!.id, label: "Old home", text: "1 Rue X", ...PARIS }]);
  });

  it("keeps an unchanged Address with no place placeless, without a lookup", async () => {
    const p = await addPerson({ name: "Anne" });
    await saveAddress(p.id, undefined, { label: "Home", text: "1 Rue X" }, lookupFinding(null).lookup);
    const [home] = await addressesOf(p.id);
    const { lookup, asked } = lookupFinding(PARIS);
    expect(await saveAddress(p.id, home, { label: "Home", text: "1 Rue X" }, lookup)).toBe(false);
    expect(asked).toEqual([]);
  });

  it("looks new text up again, and drops the old place when nothing is found", async () => {
    const p = await addPerson({ name: "Anne" });
    await saveAddress(p.id, undefined, { label: "Home", text: "1 Rue X" }, lookupFinding(PARIS).lookup);
    const [home] = await addressesOf(p.id);
    const { lookup, asked } = lookupFinding(null);
    expect(await saveAddress(p.id, home, { label: "Home", text: "2 Rue Y" }, lookup)).toBe(false);
    expect(asked).toEqual(["2 Rue Y"]);
    const [moved] = await addressesOf(p.id);
    expect(moved).toMatchObject({ id: home!.id, text: "2 Rue Y" });
    expect(moved?.lat).toBeUndefined();
    expect(moved?.lon).toBeUndefined();
  });

  it("puts new text at the place found for it", async () => {
    const p = await addPerson({ name: "Anne" });
    await saveAddress(p.id, undefined, { label: "Home", text: "1 Rue X" }, lookupFinding(null).lookup);
    const [home] = await addressesOf(p.id);
    expect(await saveAddress(p.id, home, { label: "Home", text: "Paris" }, lookupFinding(PARIS).lookup)).toBe(true);
    expect(await addressesOf(p.id)).toMatchObject([{ text: "Paris", ...PARIS }]);
  });
});

describe("looking an Address up again", () => {
  it("writes the place when one is found now", async () => {
    const p = await addPerson({ name: "Anne" });
    await saveAddress(p.id, undefined, { label: "Home", text: "Paris" }, lookupFinding(null).lookup);
    const [home] = await addressesOf(p.id);
    const { lookup, asked } = lookupFinding(PARIS);
    expect(await relocateAddress(p.id, home!, lookup)).toBe(true);
    expect(asked).toEqual(["Paris"]);
    expect(await addressesOf(p.id)).toMatchObject([{ id: home!.id, text: "Paris", ...PARIS }]);
  });

  it("writes nothing when there is still no place", async () => {
    const p = await addPerson({ name: "Anne" });
    await saveAddress(p.id, undefined, { label: "Home", text: "Paris" }, lookupFinding(null).lookup);
    const before = await addressesOf(p.id);
    expect(await relocateAddress(p.id, before[0]!, lookupFinding(null).lookup)).toBe(false);
    expect(await addressesOf(p.id)).toEqual(before);
  });
});
