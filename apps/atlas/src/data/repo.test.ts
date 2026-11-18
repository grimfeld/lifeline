import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DOCUMENT_TYPES, EVENT_TYPE, PLACE_TYPE, TitleTaken, allDocumentTypes, allDocuments, buildLinkIndex, createDocument, db, documentType, documentsOf, documentsTable, getDocument, initApps, patchDocument, putDocument, type DocumentTypeDef } from "@lifeline/core";
import { placeTypeDef } from "../types";
import { kindOptions, lastVisitOf, placeCoordsOf, placesList } from "../domain/place";
import { addPlace, livePlace, patchPlace, saveKindOptions, settleToTry } from "./repo";

// A stand-in for Calendar's Event (Atlas never imports it, ADR 0100): an At, and notes whose wikilinks count.
const eventType: DocumentTypeDef = {
  id: EVENT_TYPE,
  label: "Events",
  titleRule: "name",
  body: "none",
  linkingText: ["notes"],
  builtIn: true,
  fields: [
    { key: "date", label: "Date", kind: "date" },
    { key: "endDate", label: "End date", kind: "date" },
    { key: "notes", label: "Notes", kind: "longtext" },
    { key: "at", label: "At", kind: "link", linkType: PLACE_TYPE },
  ],
};

initApps([
  { id: "atlas", title: "Atlas", module: "people", types: [placeTypeDef], screens: [], cards: [], commands: [] },
  { id: "others", title: "Others", types: [{ id: "note", label: "Notes", titleRule: "name", body: "optional", builtIn: true, fields: [] } satisfies DocumentTypeDef, eventType], screens: [], cards: [], commands: [] },
]);

beforeEach(async () => {
  await documentsTable().clear();
  await db().table(DOCUMENT_TYPES).clear();
});

/** The registry follows the store through a live query: wait for it to catch up. */
async function settled(check: () => boolean) {
  for (let i = 0; i < 100 && !check(); i++) await new Promise((r) => setTimeout(r, 10));
}

describe("adding a Place (ADR 0128)", () => {
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
    expect(refusal).toBeInstanceOf(TitleTaken);
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

describe("a Place made from a name elsewhere (an Event's At, ADR 0128)", () => {
  it("is added by name through the type, as Atlas adds one", async () => {
    const made = await placeTypeDef.createNamed!("Chez Janou");
    expect(made).toMatchObject({ type: PLACE_TYPE, title: "Chez Janou", folder: "Places" });
  });

  it("answers the Place that has the name already, making no second one", async () => {
    const first = await addPlace({ name: "Chez Janou" });
    expect((await placeTypeDef.createNamed!("chez janou")).id).toBe(first.id);
  });
});

// The spec's worked example: today is Sunday 15 November 2026.
const TODAY = new Date(2026, 10, 15, 12);
const event = (title: string, fields: Record<string, unknown>) => putDocument({ type: EVENT_TYPE, title, notes: "", at: "", endDate: null, ...fields });
const toTry = async (id: string) => livePlace(await getDocument(id))?.toTry;

/** Mark at noon on `day`, then come back to TODAY: the mark is older than the Events below. */
async function markedOn<T>(day: string, mark: () => Promise<T>): Promise<T> {
  vi.setSystemTime(new Date(`${day}T12:00:00`));
  const out = await mark();
  vi.setSystemTime(TODAY);
  return out;
}

describe("To try (ADR 0128)", () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ["Date"], now: TODAY }));
  afterEach(() => vi.useRealTimers());

  it("is marked when a Place is added or changed, and lists it under To try", async () => {
    const janou = await addPlace({ name: "Chez Janou", toTry: true });
    const flore = await addPlace({ name: "Café de Flore" });
    await patchPlace(flore.id, { toTry: true });
    const orsay = await addPlace({ name: "Musée d'Orsay" });
    const places = [janou, flore, orsay].map((p) => p.id);
    const all = (await Promise.all(places.map(getDocument))).map((d) => livePlace(d)!);
    expect(placesList(all, { show: "toTry" }).map((p) => p.title)).toEqual(["Café de Flore", "Chez Janou"]);
    await patchPlace(flore.id, { toTry: false });
    expect(await toTry(flore.id)).toBe(false);
  });

  it("remembers the day it was marked, by any writer, and forgets it when unmarked", async () => {
    const janou = await markedOn("2026-11-02", () => addPlace({ name: "Chez Janou", toTry: true }));
    expect((await getDocument(janou.id))?.toTrySince).toBe("2026-11-02");
    const flore = await addPlace({ name: "Café de Flore" });
    expect((await getDocument(flore.id))?.toTrySince).toBeFalsy();
    await markedOn("2026-11-03", () => patchPlace(flore.id, { toTry: true }));
    expect((await getDocument(flore.id))?.toTrySince).toBe("2026-11-03");
    await patchPlace(flore.id, { toTry: false });
    expect((await getDocument(flore.id))?.toTrySince).toBeFalsy();
  });

  it("clears once an Event At the Place has happened since it was marked", async () => {
    const janou = await markedOn("2026-11-02", () => addPlace({ name: "Chez Janou", toTry: true }));
    await event("Dinner", { date: "2026-11-10", at: janou.id });
    expect(await toTry(janou.id)).toBe(false);
  });

  it("clears for an Event on the very day it was marked, once that day has passed", async () => {
    const janou = await markedOn("2026-11-10", () => addPlace({ name: "Chez Janou", toTry: true }));
    await event("Dinner", { date: "2026-11-10", at: janou.id });
    expect(await toTry(janou.id)).toBe(false);
  });

  it("is kept by an Event from before it was marked: a Place gone to can be marked To try again", async () => {
    const janou = await addPlace({ name: "Chez Janou" });
    await event("Dinner", { date: "2026-10-03", at: janou.id });
    await markedOn("2026-11-02", () => patchPlace(janou.id, { toTry: true }));
    await settleToTry(janou.id);
    expect(await toTry(janou.id)).toBe(true);
    await event("Lunch", { date: "2026-11-12", at: janou.id });
    expect(await toTry(janou.id)).toBe(false);
  });

  it("is kept by an Event that ends on the day it was marked but began before", async () => {
    const janou = await markedOn("2026-11-08", () => addPlace({ name: "Chez Janou", toTry: true }));
    await event("Trip", { date: "2026-11-06", endDate: "2026-11-07", at: janou.id });
    expect(await toTry(janou.id)).toBe(true);
    await event("Weekend", { date: "2026-11-07", endDate: "2026-11-08", at: janou.id });
    expect(await toTry(janou.id)).toBe(false);
  });

  it("marked before the day was kept, clears for any Event that has happened", async () => {
    // A Place marked by an older build carries no day: any past Event clears it, as before.
    const janou = await addPlace({ name: "Chez Janou" });
    await patchDocument(janou.id, { toTry: true });
    await event("Dinner", { date: "2026-01-10", at: janou.id });
    expect(await toTry(janou.id)).toBe(false);
  });

  it("stays while the Event At it is still to come, today's included", async () => {
    const janou = await markedOn("2026-11-02", () => addPlace({ name: "Chez Janou", toTry: true }));
    await event("Dinner", { date: "2026-11-20", at: janou.id });
    await event("Lunch", { date: "2026-11-15", at: janou.id });
    // A weekend that ends today has not happened yet.
    await event("Weekend", { date: "2026-11-14", endDate: "2026-11-15", at: janou.id });
    expect(await toTry(janou.id)).toBe(true);
  });

  it("clears for an Event that links to it from its notes", async () => {
    const janou = await markedOn("2026-10-30", () => addPlace({ name: "Chez Janou", aliases: ["Janou"], toTry: true }));
    await event("Anne's birthday", { date: "2026-11-01", notes: "Then dessert at [[Janou]]." });
    expect(await toTry(janou.id)).toBe(false);
  });

  it("clears when an Event At it is moved into the past", async () => {
    const janou = await markedOn("2026-11-02", () => addPlace({ name: "Chez Janou", toTry: true }));
    const dinner = await event("Dinner", { date: "2026-11-20", at: janou.id });
    await patchDocument(dinner.id, { date: "2026-11-12" });
    expect(await toTry(janou.id)).toBe(false);
  });

  it("is not cleared by a Day that only mentions the Place", async () => {
    const janou = await markedOn("2026-11-02", () => addPlace({ name: "Chez Janou", toTry: true }));
    await createDocument({ type: "note", title: "Saturday", body: "Anne says [[Chez Janou]] is good." });
    expect(await toTry(janou.id)).toBe(true);
  });

  it("is cleared when the Place is opened, for an Event that happened since it was saved, and twice changes nothing", async () => {
    vi.setSystemTime(new Date(2026, 10, 1, 12));
    const janou = await addPlace({ name: "Chez Janou", toTry: true });
    await event("Dinner", { date: "2026-11-10", at: janou.id });
    expect(await toTry(janou.id)).toBe(true);
    vi.setSystemTime(TODAY);
    await settleToTry(janou.id);
    expect(await toTry(janou.id)).toBe(false);
    const after = await getDocument(janou.id);
    await settleToTry(janou.id);
    expect(await getDocument(janou.id)).toEqual(after);
  });
});

describe("closed (ADR 0128)", () => {
  it("takes the Place off the map and out of the default and To try lists, and the closed list shows it", async () => {
    const janou = await addPlace({ name: "Chez Janou", toTry: true, address: "2 Rue Roger Verlomme, Paris", at: { lat: 48.85, lon: 2.36 } });
    const flore = await addPlace({ name: "Café de Flore" });
    await patchPlace(janou.id, { closed: true });
    const all = [livePlace(await getDocument(janou.id))!, livePlace(await getDocument(flore.id))!];
    expect(placeCoordsOf(all[0]!)).toBeNull();
    expect(placesList(all).map((p) => p.title)).toEqual(["Café de Flore"]);
    expect(placesList(all, { show: "toTry" })).toEqual([]);
    expect(placesList(all, { show: "closed" }).map((p) => p.title)).toEqual(["Chez Janou"]);
  });

  it("keeps the Place's address, body and links, and reopening puts it back on the map", async () => {
    const janou = await addPlace({ name: "Chez Janou", address: "2 Rue Roger Verlomme, Paris", at: { lat: 48.85, lon: 2.36 } });
    const day = await createDocument({ type: "note", title: "Saturday", body: "Lunch at [[Chez Janou]]." });
    await patchPlace(janou.id, { closed: true });
    expect(await getDocument(janou.id)).toMatchObject({ closed: true, address: "2 Rue Roger Verlomme, Paris", geo: [48.85, 2.36] });
    expect((await getDocument(day.id))?.body).toBe("Lunch at [[Chez Janou]].");
    await patchPlace(janou.id, { closed: false });
    expect(placeCoordsOf((await getDocument(janou.id))!)).toEqual({ lat: 48.85, lon: 2.36 });
  });
});

describe("the Places list's order (#487 story 58)", () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ["Date"], now: TODAY }));
  afterEach(() => vi.useRealTimers());

  async function listed(sort: "name" | "lastVisit") {
    const index = buildLinkIndex(await allDocuments(), allDocumentTypes());
    const places = (await documentsOf(PLACE_TYPE)).map((d) => livePlace(d)!);
    return placesList(places, { sort, lastVisit: (id) => lastVisitOf(index, id, "2026-11-15") }).map((p) => p.title);
  }

  it("is A to Z by name, or by last visit, newest first, the Places never visited last", async () => {
    const janou = await addPlace({ name: "Chez Janou" });
    const flore = await addPlace({ name: "Café de Flore" });
    await addPlace({ name: "Musée d'Orsay" });
    await addPlace({ name: "Bistrot Paul Bert" });
    await event("Coffee", { date: "2026-11-01", at: flore.id });
    await event("Dinner", { date: "2026-11-10", at: janou.id });
    // Still to come: no visit yet.
    await event("Lunch", { date: "2026-11-20", at: flore.id });
    expect(await listed("name")).toEqual(["Bistrot Paul Bert", "Café de Flore", "Chez Janou", "Musée d'Orsay"]);
    expect(await listed("lastVisit")).toEqual(["Chez Janou", "Café de Flore", "Bistrot Paul Bert", "Musée d'Orsay"]);
  });

  it("puts two Places last visited on one day A to Z", async () => {
    const janou = await addPlace({ name: "Chez Janou" });
    const flore = await addPlace({ name: "Café de Flore" });
    await event("Dinner", { date: "2026-11-10", at: janou.id });
    await event("Coffee", { date: "2026-11-10", notes: "At [[Café de Flore]] first.", at: "" });
    expect(flore.title).toBe("Café de Flore");
    expect(await listed("lastVisit")).toEqual(["Café de Flore", "Chez Janou"]);
  });
});
