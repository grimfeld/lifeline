import { describe, expect, it } from "vitest";
import { extractValue, formatValue, readJsonPath } from "./value";

describe("readJsonPath", () => {
  const j = { main: { temp: 21.5 }, data: [{ price: "1,234.5" }, { price: 2 }], "": 0 };
  it("dots and brackets", () => {
    expect(readJsonPath(j, "main.temp")).toBe(21.5);
    expect(readJsonPath(j, "data[0].price")).toBe("1,234.5");
    expect(readJsonPath(j, "data[1].price")).toBe(2);
    expect(readJsonPath(j, "nope.x")).toBeUndefined();
  });
});

describe("extractValue", () => {
  it("json path → number", () => {
    expect(extractValue('{"main":{"temp":21.5}}', "json", "main.temp")).toEqual({ raw: "21.5", number: 21.5 });
    expect(extractValue('{"data":[{"price":"1,234.5"}]}', "json", "data[0].price").number).toBe(1234.5);
    expect(extractValue('{"s":"hello"}', "json", "s")).toEqual({ raw: "hello", number: null });
  });
  it("regex capture", () => {
    expect(extractValue("<b>Temp: 18.2°C</b>", "regex", "Temp: ([\\d.]+)")).toEqual({ raw: "18.2", number: 18.2 });
    expect(() => extractValue("x", "regex", "y(\\d)")).toThrow(/did not match/);
    expect(() => extractValue("x", "json", "a")).toThrow(/not JSON/);
  });
  it("formatValue", () => {
    expect(formatValue({ raw: "21.456", number: 21.456 }, { decimals: 1, unit: "°C" })).toBe("21.5 °C");
    expect(formatValue({ raw: "1234.5", number: 1234.5 }, { prefix: "€", decimals: null })).toBe("€1234.5");
    expect(formatValue({ raw: "hello", number: null }, { decimals: 2 })).toBe("hello");
  });
});
