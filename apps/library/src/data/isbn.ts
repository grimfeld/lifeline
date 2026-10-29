/**
 * An ISBN typed into a lookup box (ADR: an ISBN finds a work and is never stored).
 * Returns the normalised ISBN (digits, a trailing X upper-cased) when the text is
 * nothing but 10 or 13 digits — hyphens and spaces ignored — with a valid
 * checksum; null otherwise, so the text is searched as text.
 */
export function isbnOf(text: string): string | null {
  const s = text.replace(/[\s-]/g, "").toUpperCase();
  if (/^\d{13}$/.test(s)) {
    const sum = [...s].reduce((n, c, i) => n + Number(c) * (i % 2 ? 3 : 1), 0);
    return sum % 10 === 0 ? s : null;
  }
  if (/^\d{9}[\dX]$/.test(s)) {
    const sum = [...s].reduce((n, c, i) => n + (c === "X" ? 10 : Number(c)) * (10 - i), 0);
    return sum % 11 === 0 ? s : null;
  }
  return null;
}
