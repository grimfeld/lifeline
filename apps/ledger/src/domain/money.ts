/**
 * Money is integer cents everywhere — floats never touch amounts (ADR 0033).
 * One app-wide currency; changing CURRENCY here is the whole job of moving.
 */
export const CURRENCY = "EUR";

const fmt = new Intl.NumberFormat(undefined, { style: "currency", currency: CURRENCY });

/** Cents → "€1,234.56" (locale decides separators). */
export function formatCents(cents: number): string {
  return fmt.format(cents / 100);
}

/** Cents → signed display with an explicit "+" for credits. */
export function formatSigned(cents: number): string {
  return cents > 0 ? `+${formatCents(cents)}` : formatCents(cents);
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
    // Both present: the later one is the decimal separator, the other thousands.
    const dec = Math.max(lastDot, lastComma);
    const decCh = s[dec];
    s = s.replaceAll(decCh === "." ? "," : ".", "");
    s = s.replace(decCh, ".");
  } else if (lastComma >= 0) {
    // Comma only: decimal when followed by 1–2 digits, thousands otherwise.
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

/** Cents → "12.50" for editing (dot decimal, no symbol, no thousands). */
export function editAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}
