import { describe, expect, it } from "vitest";
import { pinsOf } from "./locatable";
import type { Document, DocumentTypeDef } from "../documents/types";

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
});
