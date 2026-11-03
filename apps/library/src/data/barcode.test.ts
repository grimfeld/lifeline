import { describe, expect, it } from "vitest";
import { readBarcode } from "./barcode";

describe("readBarcode", () => {
  it("reads a book's EAN-13 (978 or 979) as its ISBN", () => {
    expect(readBarcode("9780441172719")).toEqual({ isbn: "9780441172719" });
    expect(readBarcode("9791032102497")).toEqual({ isbn: "9791032102497" });
  });

  it("reports a product barcode as not an ISBN", () => {
    expect(readBarcode("5012345678900")).toEqual({ notIsbn: "5012345678900" });
  });

  it("reports a sheet-music number (979-0, an ISMN) as not an ISBN", () => {
    expect(readBarcode("9790060115618")).toEqual({ notIsbn: "9790060115618" });
  });

  it("reports a misread book code (bad check digit) as not an ISBN", () => {
    expect(readBarcode("9780441172718")).toEqual({ notIsbn: "9780441172718" });
  });

  it("reports a price add-on or a QR code as not an ISBN", () => {
    expect(readBarcode("51699")).toEqual({ notIsbn: "51699" });
    expect(readBarcode("https://example.com")).toEqual({ notIsbn: "https://example.com" });
  });
});
