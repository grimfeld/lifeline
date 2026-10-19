import { describe, expect, it } from "vitest";
import { parseCoords } from "./GeoField";

describe("parseCoords", () => {
  it("reads lat, lon split by a comma or by spaces", () => {
    expect(parseCoords(" 52.37, 4.89 ")).toEqual({ lat: 52.37, lon: 4.89 });
    expect(parseCoords("-33.9 \t 18.4")).toEqual({ lat: -33.9, lon: 18.4 });
    expect(parseCoords("1 ,  2")).toEqual({ lat: 1, lon: 2 });
    expect(parseCoords("91, 0")).toBeNull();
    expect(parseCoords("1,,2")).toBeNull();
  });

  it("rejects a long run of spaces in linear time", () => {
    const started = performance.now();
    expect(parseCoords(`0 ${" ".repeat(50_000)}x`)).toBeNull();
    expect(performance.now() - started).toBeLessThan(1000);
  });
});
