import { describe, expect, it } from "vitest";
import type { Document, SurfacePin } from "@lifeline/core";
import { worldPins } from "./worldMap";

const pin = (appId: string, type: string, itemId: string, key = `${type}/${itemId}`): SurfacePin => ({ appId, type, itemId, key, name: itemId, lat: 1, lon: 2 });
const place = (id: string, kind: string, toTry = false) => ({ id, type: "atlas_place", title: id, kind, toTry }) as unknown as Document;

const event = (id: string, at: string) => ({ id, type: "event", title: id, at }) as unknown as Document;

const janou = pin("atlas", "atlas_place", "janou");
const flore = pin("atlas", "atlas_place", "flore");
const marcHome = pin("contacts", "contacts_person", "marc", "contacts_person/marc#home");
const lebrun = pin("atlas", "atlas_place", "lebrun");
const places = [place("janou", "restaurant", true), place("flore", "cafe"), place("lebrun", "cafe", true)];

describe("the World map's Pins (ADR 0128)", () => {
  it("shows every Place and every Address together", () => {
    expect(worldPins([janou, marcHome, flore], places, {}).map((p) => p.key)).toEqual(["atlas_place/janou", "contacts_person/marc#home", "atlas_place/flore"]);
  });

  it("narrows the Places to one Kind and leaves the Addresses", () => {
    expect(worldPins([janou, marcHome, flore], places, { kind: "cafe" }).map((p) => p.itemId)).toEqual(["marc", "flore"]);
  });

  it("hides one App's Pins", () => {
    expect(worldPins([janou, marcHome, flore], places, { hidden: ["contacts"] }).map((p) => p.itemId)).toEqual(["janou", "flore"]);
    expect(worldPins([janou, marcHome, flore], places, { hidden: ["atlas"], kind: "cafe" }).map((p) => p.itemId)).toEqual(["marc"]);
  });

  it("narrows the Places to those To try, with a Kind too, and leaves the Addresses", () => {
    expect(worldPins([janou, marcHome, flore, lebrun], places, { toTry: true }).map((p) => p.itemId)).toEqual(["janou", "marc", "lebrun"]);
    expect(worldPins([janou, marcHome, flore, lebrun], places, { toTry: true, kind: "cafe" }).map((p) => p.itemId)).toEqual(["marc", "lebrun"]);
  });

  it("filters an Event At a Place (#505) by its Place's Kind and To try, and hides it with the Events chip", () => {
    const dinner = pin("calendar", "event", "dinner");
    const coffee = pin("calendar", "event", "coffee");
    const events = [event("dinner", "janou"), event("coffee", "flore")];
    expect(worldPins([janou, dinner, flore, coffee], [...places, ...events], { kind: "cafe" }).map((p) => p.itemId)).toEqual(["flore", "coffee"]);
    expect(worldPins([janou, dinner, flore, coffee], [...places, ...events], { toTry: true }).map((p) => p.itemId)).toEqual(["janou", "dinner"]);
    expect(worldPins([janou, dinner, flore, coffee], [...places, ...events], { kind: "cafe", toTry: true }).map((p) => p.itemId)).toEqual([]);
    expect(worldPins([janou, dinner], [...places, ...events], { hidden: ["calendar"] }).map((p) => p.itemId)).toEqual(["janou"]);
  });

  it("keeps an Event At a Person through Kind and To try: only the Events chip hides it", () => {
    const tea = pin("calendar", "event", "tea");
    const docs = [...places, event("tea", "marc"), { id: "marc", type: "contacts_person", title: "Marc" } as unknown as Document];
    expect(worldPins([janou, tea, marcHome], docs, { kind: "cafe", toTry: true }).map((p) => p.itemId)).toEqual(["tea", "marc"]);
    expect(worldPins([tea, marcHome], docs, { hidden: ["calendar"] }).map((p) => p.itemId)).toEqual(["marc"]);
  });
});
