import { describe, expect, it, vi } from "vitest";
import { initApps } from "../registry";
import { openPin, pinsOf } from "./locatable";
import { closePeek, peekStack } from "../documents/peek";
import type { Document, DocumentTypeDef } from "../documents/types";

vi.mock("../documents/registry", async (orig) => ({
  ...(await orig<typeof import("../documents/registry")>()),
  documentTypeSync: (id: string) => (id === "event" ? { id: "event", locatableVia: "at" } : undefined),
}));

const T = (id: string, extra: Partial<DocumentTypeDef> = {}): DocumentTypeDef => ({
  id, label: id + "s", titleRule: "name", body: "optional", fields: [], builtIn: true, ...extra,
});
const doc = (id: string, type: string, extra: Record<string, unknown> = {}): Document =>
  ({ id, type, title: id, body: "", folder: "", tags: [], createdAt: "", updatedAt: "1", deleted: 0, ...extra }) as Document;

describe("pins of Locatable Documents", () => {
  it("is one Pin for a type that reads one place, keyed type/id", () => {
    const types = [T("shop", { locatable: (d) => (d.lat ? { lat: 1, lon: 2 } : null) })];
    const pins = pinsOf([doc("a", "shop", { lat: 1 }), doc("b", "shop")], types, undefined, null as never);
    expect(pins.map((p) => [p.key, p.name, p.lat, p.lon])).toEqual([["shop/a", "a", 1, 2]]);
  });

  it("is a Pin per place for a type that reads several, each its own and named by the reader", () => {
    const types = [
      T("who", {
        locatablePins: (d) => (d.places as { id: string; name: string; lat: number; lon: number }[]) ?? [],
      }),
    ];
    const places = [
      { id: "h", name: "Marc · Home", lat: 48.8, lon: 2.3 },
      { id: "w", name: "Marc · Work", lat: 48.9, lon: 2.4 },
      { id: "bad", name: "Marc · Nowhere", lat: 99, lon: 0 },
    ];
    const pins = pinsOf([doc("m", "who", { places })], types, undefined, null as never);
    expect(pins.map((p) => [p.key, p.name])).toEqual([["who/m#h", "Marc · Home"], ["who/m#w", "Marc · Work"]]);
    expect(pins.every((p) => p.itemId === "m")).toBe(true);
  });

  it("leaves out internal types and types that are not Locatable", () => {
    const types = [T("x"), T("y", { internal: true, locatablePins: () => [{ id: "1", name: "n", lat: 1, lon: 1 }] })];
    expect(pinsOf([doc("a", "x"), doc("b", "y")], types, undefined, null as never)).toEqual([]);
  });

  describe("narrowed to some Apps, some tags", () => {
    initApps([{ id: "shops", title: "Shops", color: "red", types: [], screens: [], cards: [], commands: [] }]);
    const here = (d: Document) => (d.at ? { lat: 1, lon: 2 } : null);
    const types = [T("shop", { appId: "shops", locatable: here }), T("spot", { locatable: here }), T("ghost", { appId: "gone", locatable: here })];
    const docs = [doc("s", "shop", { at: 1, tags: ["food"] }), doc("p", "spot", { at: 1 }), doc("g", "ghost", { at: 1, tags: ["food"] })];
    const keys = (apps: string[] | undefined, filter: string[][] = []) => pinsOf(docs, types, apps, filter).map((p) => p.key);

    it("is every App's when none is named", () => {
      expect([keys(undefined), keys([])]).toEqual([["shop/s", "spot/p", "ghost/g"], ["shop/s", "spot/p", "ghost/g"]]);
    });
    it("keeps the named Apps' Pins, or the named types', the Vault's types under 'vault'", () => {
      expect([keys(["shops"]), keys(["spot"]), keys(["vault"])]).toEqual([["shop/s"], ["spot/p"], ["spot/p"]]);
    });
    it("keeps only the Pins whose Document carries the filter's tags", () => {
      expect(keys(undefined, [["food"]])).toEqual(["shop/s", "ghost/g"]);
    });
    it("colours a Pin as its App, and leaves a Vault type's or a missing App's uncoloured", () => {
      expect(pinsOf(docs, types, undefined, []).map((p) => [p.appId, p.color])).toEqual([["shops", "red"], ["vault", undefined], ["gone", undefined]]);
    });
  });
});

describe("pins of Documents that stand at another (locatableVia, #505)", () => {
  const types = [
    T("place", { locatable: (d) => (d.closed ? null : (d.spot as { lat: number; lon: number }) ?? null) }),
    T("who", { locatablePins: (d) => (d.places as { id: string; name: string; lat: number; lon: number; main?: boolean }[]) ?? [] }),
    T("event", { label: "Events", locatableVia: "at", linkable: { subtitle: (d) => `on ${d.date as string}` } }),
  ];
  const janou = doc("janou", "place", { title: "Chez Janou", spot: { lat: 43.3, lon: 5.4 } });
  const shut = doc("shut", "place", { title: "Shut", spot: { lat: 1, lon: 1 }, closed: true });
  const nowhere = doc("nowhere", "place", { title: "Nowhere" });
  const marc = doc("marc", "who", {
    places: [
      { id: "w", name: "Marc · Work", lat: 48.9, lon: 2.4 },
      { id: "h", name: "Marc · Home", lat: 48.8, lon: 2.3, main: true },
    ],
  });
  const anne = doc("anne", "who", { places: [{ id: "w", name: "Anne · Work", lat: 45, lon: 4 }] });
  const event = (id: string, at: string) => doc(id, "event", { title: `Dinner ${id}`, date: "2026-11-10", at });
  const eventPins = (...events: Document[]) => pinsOf([janou, shut, nowhere, marc, anne, ...events], types, ["event"], []);

  it("stands an Event at the located Place it is At, under its own title and day", () => {
    const [p, ...rest] = eventPins(event("e1", "janou"));
    expect(rest).toEqual([]);
    expect([p!.key, p!.itemId, p!.type, p!.name, p!.subtitle, p!.lat, p!.lon]).toEqual(["event/e1", "e1", "event", "Dinner e1", "Event · on 2026-11-10", 43.3, 5.4]);
  });

  it("leaves off an Event At a closed or unlocated Place, at nothing, or at a Document that is gone", () => {
    expect(eventPins(event("e1", "shut"), event("e2", "nowhere"), event("e3", ""), event("e4", "deleted-id"))).toEqual([]);
  });

  it("stands an Event At a Document of several places at its main one, and leaves it off when none is main", () => {
    expect(eventPins(event("e1", "marc"), event("e2", "anne")).map((p) => [p.key, p.lat, p.lon])).toEqual([["event/e1", 48.8, 2.3]]);
  });

  it("finds the place it stands at even when the map shows only Events", () => {
    expect(pinsOf([janou, event("e1", "janou")], types, ["event"], []).map((p) => p.key)).toEqual(["event/e1"]);
    expect(pinsOf([janou, event("e1", "janou")], types, undefined, []).map((p) => p.key)).toEqual(["place/janou", "event/e1"]);
  });
});

describe("opening a Pin (openPin)", () => {
  const types = [T("place", { locatable: (d) => (d.spot as { lat: number; lon: number }) ?? null }), T("event", { locatableVia: "at" })];
  const janou = doc("janou", "place", { title: "Janou", spot: { lat: 1, lon: 2 } });

  it("peeks an Event whose id contains a slash or a hash", () => {
    for (const id of ["a/b", "x#y"]) {
      closePeek();
      const [pin] = pinsOf([janou, doc(id, "event", { at: "janou" })], types, ["event"], []);
      const navigate = vi.fn();
      openPin(pin!, navigate);
      expect(peekStack()).toEqual([id]);
      expect(navigate).not.toHaveBeenCalled();
    }
  });

  it("navigates to the href of a Pin that is no Event", () => {
    closePeek();
    const navigate = vi.fn();
    openPin({ type: "place", itemId: "janou", href: "/places/janou" }, navigate);
    expect(navigate).toHaveBeenCalledWith("/places/janou");
    expect(peekStack()).toEqual([]);
  });
});
