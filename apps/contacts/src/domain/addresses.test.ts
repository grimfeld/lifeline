import { describe, expect, it } from "vitest";
import type { Document } from "@lifeline/core";
import { addAddress, addressDraft, addressPinsOf, coordsOf, editAddress, isUnplaced, normalizeAddresses, sortedAddresses } from "./addresses";
import type { Address } from "./types";

const A = (id: string, extra: Partial<Address> = {}): Address => ({ id, label: id, text: `${id} street`, former: false, ...extra });
const person = (addresses: unknown, title = "Marc") => ({ id: "p", type: "contacts_person", title, addresses }) as unknown as Document;

describe("a Person's Addresses on the map", () => {
  it("is a Pin for each current Address with coordinates, titled Person · label", () => {
    const pins = addressPinsOf(person([A("Home", { lat: 1, lon: 2 }), A("Work", { lat: 3, lon: 4 })]));
    expect(pins).toEqual([
      { id: "Home", name: "Marc · Home", lat: 1, lon: 2 },
      { id: "Work", name: "Marc · Work", lat: 3, lon: 4 },
    ]);
  });

  it("leaves out a former Address, and one the lookup did not find", () => {
    const pins = addressPinsOf(person([A("Old", { lat: 1, lon: 2, former: true }), A("Lost"), A("Half", { lat: 1 }), A("Here", { lat: 5, lon: 6 })]));
    expect(pins.map((p) => p.id)).toEqual(["Here"]);
  });

  it("is none for a Person with no Addresses, or a row that holds something else", () => {
    expect(addressPinsOf(person(undefined))).toEqual([]);
    expect(addressPinsOf(person("nope"))).toEqual([]);
  });
});

describe("the Address dialog", () => {
  it("opens blank, or on the Address's label and text", () => {
    expect(addressDraft(undefined)).toEqual({ label: "", text: "" });
    expect(addressDraft(A("Home"))).toEqual({ label: "Home", text: "Home street" });
  });
});

describe("an Address's place", () => {
  it("is its coordinates when it has both, and none otherwise", () => {
    expect(coordsOf(A("Home", { lat: 0, lon: 0 }))).toEqual({ lat: 0, lon: 0 });
    expect(coordsOf(A("Lost"))).toBeNull();
    expect(coordsOf(A("Half", { lat: 1 }))).toBeNull();
    expect(coordsOf(A("Half", { lon: 1 }))).toBeNull();
  });
  it("is offered again only for a current Address with none", () => {
    expect(isUnplaced(A("Lost"))).toBe(true);
    expect(isUnplaced(A("Old", { former: true }))).toBe(false);
    expect(isUnplaced(A("Home", { lat: 1, lon: 2 }))).toBe(false);
  });
});

describe("keeping a Person's Addresses", () => {
  it("reads only well-formed entries", () => {
    expect(normalizeAddresses([A("a"), { id: 1 }, null, { id: "b", label: "B", text: "t" }])).toEqual([A("a"), { id: "b", label: "B", text: "t", former: false }]);
  });

  it("adds, edits and removes one, leaving the others", () => {
    const one = addAddress([], { label: " Home ", text: " 1 Rue X ", lat: 1, lon: 2 }, () => "n1");
    expect(one).toEqual([{ id: "n1", label: "Home", text: "1 Rue X", lat: 1, lon: 2, former: false }]);
    const two = addAddress(one, { label: "Work", text: "2 Rue Y" }, () => "n2");
    expect(two[1]).toEqual({ id: "n2", label: "Work", text: "2 Rue Y", former: false });
    expect(editAddress(two, "n2", { former: true })[1]!.former).toBe(true);
    expect(editAddress(two, "n1", { label: "Home 2" })[0]!.label).toBe("Home 2");
  });

  it("refuses an Address with no text, and gives a blank label a name", () => {
    expect(() => addAddress([], { label: "Home", text: "  " }, () => "x")).toThrow(/needs/);
    expect(addAddress([], { label: " ", text: "1 Rue X" }, () => "x")[0]!.label).toBe("Address");
  });

  it("drops coordinates when the text changes without new ones", () => {
    const [a] = addAddress([], { label: "Home", text: "1 Rue X", lat: 1, lon: 2 }, () => "n");
    const moved = editAddress([a!], "n", { text: "9 Rue Z" })[0];
    expect(moved!.lat).toBeUndefined();
    expect(moved!.lon).toBeUndefined();
    expect(editAddress([a!], "n", { text: "1 Rue X" })[0]!.lat).toBe(1);
  });

  it("lists current Addresses before former ones, each in the order they were added", () => {
    expect(sortedAddresses([A("a", { former: true }), A("b"), A("c")]).map((a) => a.id)).toEqual(["b", "c", "a"]);
  });
});
