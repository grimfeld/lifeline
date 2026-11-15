import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { DOCUMENT_TYPES, PLACE_TYPE, createDocument, db, documentType, documentsTable, getDocument, initApps, type DocumentTypeDef } from "@lifeline/core";
import { placeTypeDef } from "../types";
import { PlaceTaken, addPlace, kindOptions, patchPlace, saveKindOptions } from "./repo";

initApps([
  { id: "atlas", title: "Atlas", module: "people", types: [placeTypeDef], screens: [], cards: [], commands: [] },
  { id: "others", title: "Others", types: [{ id: "note", label: "Notes", titleRule: "name", body: "optional", builtIn: true, fields: [] } satisfies DocumentTypeDef], screens: [], cards: [], commands: [] },
]);

beforeEach(async () => {
  await documentsTable().clear();
  await db().table(DOCUMENT_TYPES).clear();
});

/** The registry follows the store through a live query: wait for it to catch up. */
async function settled(check: () => boolean) {
  for (let i = 0; i < 100 && !check(); i++) await new Promise((r) => setTimeout(r, 10));
}

describe("adding a Place (ADR 0119)", () => {
  it("takes a name only, and lands in Places with no Kind, aliases or Tags", async () => {
    const p = await addPlace({ name: "  Chez Janou " });
    expect(p).toMatchObject({ type: PLACE_TYPE, title: "Chez Janou", folder: "Places", kind: "", aliases: [], tags: [] });
  });

  it("keeps a Kind, aliases and Tags when given", async () => {
    const p = await addPlace({ name: "Musée d'Orsay", kind: "museum", aliases: [" the Orsay ", " "], tags: ["Art"] });
    expect(p).toMatchObject({ kind: "museum", aliases: ["the Orsay"], tags: ["art"] });
  });

  it("takes a Kind by its label as well as its value", async () => {
    expect(await addPlace({ name: "Le Café", kind: "Café" })).toMatchObject({ kind: "cafe" });
  });

  it("refuses a Kind that is none, naming the ones there are", async () => {
    await expect(addPlace({ name: "Chez Janou", kind: "spaceport" })).rejects.toThrow(/No Kind “spaceport”: .*Restaurant.*Other/);
  });

  it("refuses a Place with no name", async () => {
    await expect(addPlace({ name: " " })).rejects.toThrow("A Place needs a name");
  });

  it("refuses a title another Place has, whatever its case or accents, and offers that Place", async () => {
    const janou = await addPlace({ name: "Chez Janou" });
    const refusal = await addPlace({ name: "chez janóu" }).catch((e: unknown) => e);
    expect(refusal).toBeInstanceOf(PlaceTaken);
    expect(refusal).toMatchObject({ message: "“chez janóu” is already a Place: Chez Janou", existing: { id: janou.id, title: "Chez Janou" } });
  });

  it("tells two branches of a chain apart by name", async () => {
    await addPlace({ name: "Lidl Jean Jaurès" });
    await expect(addPlace({ name: "Lidl Prado" })).resolves.toMatchObject({ title: "Lidl Prado" });
  });

  it("finds a Place it clashes with in another folder too", async () => {
    const janou = await createDocument({ type: PLACE_TYPE, title: "Chez Janou", folder: "Trips" });
    await expect(addPlace({ name: "Chez Janou" })).rejects.toMatchObject({ existing: { id: janou.id } });
  });
});

describe("changing a Place", () => {
  it("writes its Kind, aliases and Tags", async () => {
    const p = await addPlace({ name: "Chez Janou" });
    await patchPlace(p.id, { kind: "restaurant", aliases: ["Janou"], tags: ["Provençal"] });
    expect(await getDocument(p.id)).toMatchObject({ kind: "restaurant", aliases: ["Janou"], tags: ["provençal"] });
  });

  it("renames it, rewriting the links to the old name", async () => {
    const p = await addPlace({ name: "Chez Janou" });
    const day = await createDocument({ type: "note", title: "Saturday", body: "Lunch at [[Chez Janou]]." });
    await patchPlace(p.id, { title: "Chez Janou (Marais)" });
    expect(await getDocument(p.id)).toMatchObject({ title: "Chez Janou (Marais)" });
    expect((await getDocument(day.id))?.body).toContain("[[Chez Janou (Marais)]]");
  });

  it("refuses a rename to another Place's title, offering it, and keeps its own name", async () => {
    const orsay = await addPlace({ name: "Musée d'Orsay" });
    const p = await addPlace({ name: "Orsay" });
    await expect(patchPlace(p.id, { title: "musée d'orsay" })).rejects.toMatchObject({ existing: { id: orsay.id } });
    expect(await getDocument(p.id)).toMatchObject({ title: "Orsay" });
  });

  it("keeps its own title in another case", async () => {
    const p = await addPlace({ name: "chez janou" });
    await patchPlace(p.id, { title: "Chez Janou" });
    expect(await getDocument(p.id)).toMatchObject({ title: "Chez Janou" });
  });

  it("refuses an empty name and a Kind that is none", async () => {
    const p = await addPlace({ name: "Chez Janou" });
    await expect(patchPlace(p.id, { title: " " })).rejects.toThrow("A Place needs a name");
    await expect(patchPlace(p.id, { kind: "spaceport" })).rejects.toThrow(/No Kind/);
  });

  it("clears its Kind", async () => {
    const p = await addPlace({ name: "Chez Janou", kind: "restaurant" });
    await patchPlace(p.id, { kind: "" });
    expect(await getDocument(p.id)).toMatchObject({ kind: "" });
  });
});

describe("Kind options", () => {
  it("start as the ten the spec names", () => {
    expect(kindOptions().map((o) => o.label)).toEqual(["Restaurant", "Café", "Bar", "Museum", "Gallery", "Shop", "Mall", "Park", "Venue", "Other"]);
  });

  it("can be renamed and added to, and a Place takes the new one", async () => {
    await saveKindOptions([...kindOptions().map((o) => (o.value === "shop" ? { ...o, label: "Store" } : o)), { label: "Climbing gym" }]);
    await settled(() => kindOptions().length === 11);
    const labels = kindOptions().map((o) => o.label);
    expect(labels).toContain("Store");
    expect(labels).not.toContain("Shop");
    expect(labels.at(-1)).toBe("Climbing gym");
    // A rename keeps the stored value, so a Place that was a Shop is a Store.
    expect(await addPlace({ name: "Lidl Prado", kind: "Store" })).toMatchObject({ kind: "shop" });
    expect(await addPlace({ name: "Block'Out", kind: "climbing gym" })).toMatchObject({ kind: "climbing_gym" });
    // The type's Field is what Bases and the Peek read.
    expect(documentType(PLACE_TYPE)?.fields.find((f) => f.key === "kind")?.options?.at(-1)).toEqual({ value: "climbing_gym", label: "Climbing gym" });
  });

  it("never lose one: an option left out keeps its place and its label", async () => {
    await saveKindOptions([{ value: "restaurant", label: "Eating out" }]);
    await settled(() => kindOptions()[0]?.label === "Eating out");
    expect(kindOptions()).toHaveLength(10);
    expect(kindOptions().find((o) => o.value === "park")?.label).toBe("Park");
  });

  it("refuse an empty label and two options with one name", async () => {
    await expect(saveKindOptions([...kindOptions(), { label: " " }])).rejects.toThrow(/needs a name/);
    await expect(saveKindOptions([...kindOptions(), { label: "museum" }])).rejects.toThrow(/“museum” is already a Kind/);
  });
});

describe("a Place made from a name elsewhere (an Event's At, ADR 0119)", () => {
  it("is added by name through the type, as Atlas adds one", async () => {
    const made = await placeTypeDef.createNamed!("Chez Janou");
    expect(made).toMatchObject({ type: PLACE_TYPE, title: "Chez Janou", folder: "Places" });
  });

  it("answers the Place that has the name already, making no second one", async () => {
    const first = await addPlace({ name: "Chez Janou" });
    expect((await placeTypeDef.createNamed!("chez janou")).id).toBe(first.id);
  });
});
