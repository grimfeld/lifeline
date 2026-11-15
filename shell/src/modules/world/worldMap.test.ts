import { describe, expect, it } from "vitest";
import type { Document, SurfacePin } from "@lifeline/core";
import { worldPins } from "./worldMap";

const pin = (appId: string, type: string, itemId: string, key = `${type}/${itemId}`): SurfacePin => ({ appId, type, itemId, key, name: itemId, lat: 1, lon: 2 });
const place = (id: string, kind: string, toTry = false) => ({ id, type: "atlas_place", title: id, kind, toTry }) as unknown as Document;

const janou = pin("atlas", "atlas_place", "janou");
const flore = pin("atlas", "atlas_place", "flore");
const marcHome = pin("contacts", "contacts_person", "marc", "contacts_person/marc#home");
const lebrun = pin("atlas", "atlas_place", "lebrun");
const places = [place("janou", "restaurant", true), place("flore", "cafe"), place("lebrun", "cafe", true)];

describe("the World map's Pins (ADR 0119)", () => {
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
});
