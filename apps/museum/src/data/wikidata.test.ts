import { describe, expect, it } from "vitest";
import { commonsUrl, coordsOf, dimensionsOf, formatYear, parseClaims } from "./wikidata";

const item = (id: string) => ({ mainsnak: { datavalue: { value: { id } } } });
const str = (v: string) => ({ mainsnak: { datavalue: { value: v } } });
const qty = (amount: string, unit: string) => ({ mainsnak: { datavalue: { value: { amount, unit: `http://www.wikidata.org/entity/${unit}` } } } });

describe("formatYear", () => {
  it("renders year, decade, century and BC", () => {
    expect(formatYear("+1503-00-00T00:00:00Z", 9)).toBe("1503");
    expect(formatYear("+1650-00-00T00:00:00Z", 8)).toBe("1650s");
    expect(formatYear("+1150-00-00T00:00:00Z", 7)).toBe("12th century");
    expect(formatYear("+2100-00-00T00:00:00Z", 7)).toBe("21st century");
    expect(formatYear("-0450-00-00T00:00:00Z", 9)).toBe("450 BC");
    expect(formatYear(undefined, 9)).toBe("");
  });
});

describe("claims parsing", () => {
  const claims = {
    P170: [item("Q762")],
    P571: [{ mainsnak: { datavalue: { value: { time: "+1503-00-00T00:00:00Z", precision: 9 } } } }],
    P18: [str("Mona Lisa.jpg")],
    P186: [item("Q296955"), item("Q287")],
    P2048: [qty("+77", "Q174728")],
    P2049: [qty("+53", "Q174728")],
    P276: [item("Q19675")],
  };
  const labels = { Q762: "Leonardo da Vinci", Q296955: "oil paint", Q287: "wood", Q19675: "Louvre" };

  it("maps a painting's claims to hit fields", () => {
    expect(parseClaims(claims, labels, "painting")).toEqual({
      artistName: "Leonardo da Vinci",
      artistKey: "wikidata:Q762",
      year: "1503",
      imageUrl: commonsUrl("Mona Lisa.jpg"),
      materials: "oil paint, wood",
      dimensions: "77 × 53 cm",
      location: "Louvre",
    });
  });

  it("credits the architect and reads coordinates for architecture", () => {
    const arch = { P84: [item("Q41508")], P625: [{ mainsnak: { datavalue: { value: { latitude: 41.4, longitude: 2.17 } } } }] };
    expect(parseClaims(arch, { Q41508: "Antoni Gaudí" }, "architecture")).toEqual({
      artistName: "Antoni Gaudí",
      artistKey: "wikidata:Q41508",
      year: "",
      imageUrl: "",
      materials: "",
      dimensions: "",
      location: "",
      lat: 41.4,
      lon: 2.17,
    });
    expect(coordsOf(arch)).toEqual({ lat: 41.4, lon: 2.17 });
  });

  it("formats height alone and mixed units defensively", () => {
    expect(dimensionsOf({ P2048: [qty("+5.5", "Q11573")] })).toBe("5.5 m");
    expect(dimensionsOf({ P2048: [qty("+77", "Q174728")], P2049: [qty("+2", "Q11573")] })).toBe("77 cm");
    expect(dimensionsOf({})).toBe("");
  });
});

describe("commonsUrl", () => {
  it("builds a Special:FilePath URL with underscores", () => {
    expect(commonsUrl("Mona Lisa.jpg")).toBe("https://commons.wikimedia.org/wiki/Special:FilePath/Mona_Lisa.jpg?width=1200");
  });
});
