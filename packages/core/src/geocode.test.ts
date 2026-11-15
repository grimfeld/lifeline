import { afterEach, describe, expect, it, vi } from "vitest";
import { locateAddress, suggestAddresses } from "./geocode";

/** Photon's answer, as komoot's service gives it: GeoJSON features, [lon, lat]. */
const photon = (features: { osm_key?: string; name?: string; housenumber?: string; street?: string; postcode?: string; city?: string; country?: string; at: [number, number] }[]) => ({
  features: features.map(({ at, ...properties }) => ({ geometry: { coordinates: [at[1], at[0]] }, properties })),
});

afterEach(() => vi.unstubAllGlobals());

describe("the address typeahead (Photon)", () => {
  it("keeps a point of interest's name beside its postal address", async () => {
    vi.stubGlobal("fetch", async () => Response.json(photon([{ osm_key: "amenity", name: "Chez Janou", housenumber: "2", street: "Rue Roger Verlomme", postcode: "75003", city: "Paris", country: "France", at: [48.8556, 2.3655] }])));
    expect(await suggestAddresses("Chez Janou poi")).toEqual([{ lat: 48.8556, lon: 2.3655, label: "2 Rue Roger Verlomme, 75003 Paris, France", name: "Chez Janou" }]);
  });

  it("gives a plain address no name of its own", async () => {
    vi.stubGlobal("fetch", async () => Response.json(photon([{ housenumber: "12", street: "Rue Example", postcode: "75011", city: "Paris", country: "France", at: [48.85, 2.35] }])));
    expect(await suggestAddresses("12 Rue Example plain")).toEqual([{ lat: 48.85, lon: 2.35, label: "12 Rue Example, 75011 Paris, France" }]);
  });

  it("gives a street no name: the street is its address", async () => {
    vi.stubGlobal("fetch", async () => Response.json(photon([{ osm_key: "highway", name: "Rue Example", postcode: "75011", city: "Paris", country: "France", at: [48.85, 2.35] }])));
    expect(await suggestAddresses("Rue Example street")).toEqual([{ lat: 48.85, lon: 2.35, label: "Rue Example, 75011 Paris, France" }]);
  });

  it("gives a town no name: the town is its address", async () => {
    vi.stubGlobal("fetch", async () => Response.json(photon([{ osm_key: "place", name: "Arles", city: "Arles", postcode: "13200", country: "France", at: [43.68, 4.63] }])));
    const [hit] = await suggestAddresses("Arles town");
    expect(hit?.name).toBeUndefined();
  });
});

const PARIS = { lat: 48.86, lon: 2.35 };

describe("looking an address up on save", () => {
  it("takes the first hit's coordinates", async () => {
    const asked: [string, number][] = [];
    const find = async (q: string, limit: number) => {
      asked.push([q, limit]);
      return [{ ...PARIS, label: "Paris" }, { lat: 1, lon: 2, label: "Elsewhere" }];
    };
    expect(await locateAddress("Paris", find)).toEqual({ kind: "found", at: PARIS });
    expect(asked).toEqual([["Paris", 1]]);
  });

  it("finds nothing when there is no hit", async () => {
    expect(await locateAddress("Nowhere", async () => [])).toEqual({ kind: "none" });
  });

  it("fails, apart from finding nothing, when the lookup fails, and logs the reason without the text", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(
        await locateAddress("12 Rue Secret, Paris", async () => {
          throw new Error("Geocoding failed (429)");
        }),
      ).toEqual({ kind: "failed", reason: "Geocoding failed (429)" });
      expect(warn).toHaveBeenCalledWith("[geocode] address lookup failed", { reason: "Geocoding failed (429)" });
      expect(JSON.stringify(warn.mock.calls)).not.toContain("Secret");
    } finally {
      warn.mockRestore();
    }
  });
});
