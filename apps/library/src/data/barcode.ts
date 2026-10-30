import { isbnOf } from "./isbn";

/**
 * What a scanned barcode says to a lookup box (ADR 0108): a book's EAN-13 —
 * 978 or 979 (not 979-0, sheet music's ISMN), valid check digit — is its
 * ISBN; anything else (a product code, a price add-on, a QR code, a misread)
 * is reported and never searched.
 */
export function readBarcode(raw: string): { isbn: string } | { notIsbn: string } {
  const value = raw.trim();
  const isbn = /^97(8|9[1-9])\d+$/.test(value) && value.length === 13 ? isbnOf(value) : null;
  return isbn ? { isbn } : { notIsbn: value };
}
