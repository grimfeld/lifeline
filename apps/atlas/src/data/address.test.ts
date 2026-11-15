import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { DOCUMENT_TYPES, EMPTY_TAG_FILTER, PLACE_TYPE, db, documentType, documentsTable, getDocument, initApps, pinsOf, type Document, type Located, type Lookup } from "@lifeline/core";
import { placeTypeDef } from "../types";
import { addPlace, setPlaceAddress } from "./repo";

initApps([{ id: "atlas", title: "Atlas", module: "people", color: "var(--chart-magenta)", types: [placeTypeDef], screens: [], cards: [], commands: [] }]);

beforeEach(async () => {
  await documentsTable().clear();
  await db().table(DOCUMENT_TYPES).clear();
});

const JANOU = { lat: 48.8556, lon: 2.3655 };
const PRADO = { lat: 43.2722, lon: 5.3889 };

/** A lookup that finds `at` (or nothing, or fails), and remembers what it was asked. */
function lookupFinding(at: { lat: number; lon: number } | null | "failed") {
  const asked: string[] = [];
  const answer: Located = at === "failed" ? { kind: "failed", reason: "Geocoding failed (503)" } : at ? { kind: "found", at } : { kind: "none" };
  const lookup: Lookup = async (text) => {
    asked.push(text);
    return answer;
  };
  return { lookup, asked };
}

const stored = async (id: string) => (await getDocument(id)) as Document & { address?: string; geo?: unknown };
const pinsOfPlaces = (docs: Document[]) => pinsOf(docs, [documentType(PLACE_TYPE)!], undefined, EMPTY_TAG_FILTER);

describe("a Place's address (ADR 0119)", () => {
  it("is kept with its coordinates when a typeahead hit was picked, and nothing is looked up", async () => {
    const { lookup, asked } = lookupFinding(null);
    const p = await addPlace({ name: "Chez Janou", address: "2 Rue Roger Verlomme, 75003 Paris, France", at: JANOU }, lookup);
    expect(await stored(p.id)).toMatchObject({ address: "2 Rue Roger Verlomme, 75003 Paris, France", geo: [48.8556, 2.3655] });
    expect(asked).toEqual([]);
  });

  it("typed by hand, is looked up once on save", async () => {
    const { lookup, asked } = lookupFinding(PRADO);
    const p = await addPlace({ name: "Lidl Prado", address: " 150 Avenue du Prado, Marseille " }, lookup);
    expect(await stored(p.id)).toMatchObject({ address: "150 Avenue du Prado, Marseille", geo: [43.2722, 5.3889] });
    expect(asked).toEqual(["150 Avenue du Prado, Marseille"]);
  });

  it("is kept with no coordinates when the lookup finds nothing or fails", async () => {
    const none = await addPlace({ name: "The stall", address: "Marché du Prado" }, lookupFinding(null).lookup);
    const failed = await addPlace({ name: "The kiosk", address: "Cours Julien" }, lookupFinding("failed").lookup);
    expect(await stored(none.id)).toMatchObject({ address: "Marché du Prado", geo: null });
    expect(await stored(failed.id)).toMatchObject({ address: "Cours Julien", geo: null });
  });

  it("is not needed: a Place added by name alone has none and looks nothing up", async () => {
    const { lookup, asked } = lookupFinding(JANOU);
    const p = await addPlace({ name: "Chez Janou" }, lookup);
    expect(await stored(p.id)).toMatchObject({ address: "", geo: null });
    expect(asked).toEqual([]);
  });

  it("edited, finds its coordinates again", async () => {
    const p = await addPlace({ name: "Chez Janou", address: "Rue Roger Verlomme", at: JANOU });
    const { lookup, asked } = lookupFinding(PRADO);
    expect(await setPlaceAddress(p.id, { text: "Avenue du Prado" }, lookup)).toBe("found");
    expect(await stored(p.id)).toMatchObject({ address: "Avenue du Prado", geo: [43.2722, 5.3889] });
    expect(asked).toEqual(["Avenue du Prado"]);
  });

  it("edited to a new text the lookup cannot find, leaves the map rather than keep the old spot", async () => {
    const p = await addPlace({ name: "Chez Janou", address: "Rue Roger Verlomme", at: JANOU });
    expect(await setPlaceAddress(p.id, { text: "Somewhere new" }, lookupFinding(null).lookup)).toBe("none");
    expect(await stored(p.id)).toMatchObject({ address: "Somewhere new", geo: null });
  });

  it("saved unchanged, keeps its coordinates and looks nothing up", async () => {
    const p = await addPlace({ name: "Chez Janou", address: "Rue Roger Verlomme", at: JANOU });
    const { lookup, asked } = lookupFinding(PRADO);
    expect(await setPlaceAddress(p.id, { text: " Rue Roger Verlomme " }, lookup)).toBe("found");
    expect(await stored(p.id)).toMatchObject({ geo: [48.8556, 2.3655] });
    expect(asked).toEqual([]);
  });

  it("picked again, takes the hit's coordinates", async () => {
    const p = await addPlace({ name: "Chez Janou", address: "Rue Roger Verlomme" }, lookupFinding(null).lookup);
    expect(await setPlaceAddress(p.id, { text: "Rue Roger Verlomme", at: JANOU }, lookupFinding(null).lookup)).toBe("found");
    expect(await stored(p.id)).toMatchObject({ geo: [48.8556, 2.3655] });
  });

  it("cleared, takes the coordinates with it", async () => {
    const p = await addPlace({ name: "Chez Janou", address: "Rue Roger Verlomme", at: JANOU });
    await setPlaceAddress(p.id, { text: " " });
    expect(await stored(p.id)).toMatchObject({ address: "", geo: null });
  });
});

describe("a Place on the map", () => {
  it("stands as a Pin in Atlas's colour once it has coordinates, and is none before", async () => {
    const janou = await addPlace({ name: "Chez Janou", kind: "restaurant", address: "Rue Roger Verlomme", at: JANOU });
    const stall = await addPlace({ name: "The stall", address: "Marché du Prado" }, lookupFinding(null).lookup);
    const docs = [(await getDocument(janou.id))!, (await getDocument(stall.id))!];
    expect(pinsOfPlaces(docs)).toEqual([
      expect.objectContaining({ appId: "atlas", type: PLACE_TYPE, itemId: janou.id, name: "Chez Janou", lat: 48.8556, lon: 2.3655, color: "var(--chart-magenta)", href: `/app/places/place/${janou.id}` }),
    ]);
  });
});
