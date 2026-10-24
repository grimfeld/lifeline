/**
 * Money is integer cents everywhere — floats never touch amounts. One
 * app-wide currency, the Ledger's (ADR 0033); a deliberate copy of its
 * helpers rather than an import — Apps interoperate only through Core
 * Contracts, and Prices knows nothing of the Ledger (ADR 0082).
 */
export const CURRENCY = "EUR";

const fmt = new Intl.NumberFormat(undefined, { style: "currency", currency: CURRENCY });

/** Cents → "€1,234.56" (locale decides separators). */
export function formatCents(cents: number): string {
  return fmt.format(cents / 100);
}

/**
 * Parse a typed amount ("12", "12.50", "12,50", "1.234,56", "€ 12,50") into
 * cents, or null when it isn't a number. Sign is preserved; callers that
 * need magnitude take Math.abs.
 */
export function parseAmount(text: string): number | null {
  let s = text.trim().replace(/[^\d.,\-+]/g, "");
  if (!s || s === "-" || s === "+") return null;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    const decCh = lastDot > lastComma ? "." : ",";
    s = s.replaceAll(decCh === "." ? "," : ".", "");
    s = s.replace(decCh, ".");
  } else if (lastComma >= 0) {
    const after = s.length - lastComma - 1;
    s = after <= 2 ? s.replace(",", ".") : s.replaceAll(",", "");
  } else if (lastDot >= 0) {
    const after = s.length - lastDot - 1;
    if (after > 2) s = s.replaceAll(".", "");
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/**
 * Parse a typed amount of something — 420 g, 0,42 kg, 6 — with a dot or a
 * comma for the decimal; null when empty or not a number. Not money: no
 * cents, no thousands separators (see parseAmount).
 */
export function parseNumber(text: string): number | null {
  const s = text.trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Cents → "12.50" for editing (dot decimal, no symbol, no thousands). */
export function editAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}
