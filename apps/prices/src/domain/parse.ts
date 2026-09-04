import type { DateStr } from "@lifeline/core";
import { normalizeLabel } from "./derive";

/**
 * The reader's output (ADR 0045): a draft Receipt, always reviewed before
 * anything is saved. Whatever reads the photo — Tesseract today, a vision
 * model tomorrow — hands over this shape and nothing else.
 */
export interface DraftLine {
  label: string;
  amount: number;
  /** Cents, after any discount the reader folded in. */
  price: number;
  promo: boolean;
  /** Filled by label memory when a Product resolves; "" = unmatched. */
  productId: string;
}

export interface ReceiptDraft {
  shopId: string;
  date: DateStr;
  total: number;
  branch: string;
  lines: DraftLine[];
  /** What the reader saw, for the review dialog's "raw text" fold. */
  text: string;
}

export interface ShopRef {
  id: string;
  title: string;
}

/** Price at the end of a line: "1,29", "1.29 €", "1,29 B", "-0,50". */
const PRICE_AT_END = /(-?)\s*(\d{1,4})\s?[.,]\s?(\d{2})\s*(?:€|EUR)?\s*(?:[A-Z]{1,2})?\s*$/i;
/** A quantity clause: "2 x 1,29", "0,420 kg x 12,90", "3X0.99". */
const QTY = /(\d+(?:[.,]\d+)?)\s*(kg|g|l|cl|ml)?\s*[x×]\s*(\d+[.,]\d{2})/i;
const SKIP = /\b(SOUS[- ]?TOTAL|SUB[- ]?TOTAL|TVA|TAX|CARTE|CB|VISA|MASTERCARD|ESPECES|CASH|RENDU|CHANGE|MONTANT|PAYE|PAID|TICKET|ARTICLES?|ITEMS?|REGLEMENT|SOLDE|FIDELITE|POINTS|CAISSE|TEL|SIRET|MERCI|THANK|BONJOUR|EUR|HT|TTC)\b/i;
const TOTAL = /\b(TOTAL|NET A PAYER|A PAYER|A REGLER|MONTANT DU)\b/i;
const NOT_TOTAL = /\b(SOUS[- ]?TOTAL|SUB[- ]?TOTAL|ARTICLES?|ITEMS?)\b/i;
const DISCOUNT = /\b(REMISE|REDUC\w*|PROMO\w*|RABAIS|DISCOUNT|AVANTAGE|OFFERT|ECO\w*|CARTE\s+FID\w*)\b/i;
const DATE = /(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/;

function cents(whole: string, frac: string, neg: string): number {
  const v = Number(whole) * 100 + Number(frac);
  return neg ? -v : v;
}

function toAmount(qty: string, unit: string | undefined): number {
  const n = Number(qty.replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return 1;
  switch ((unit ?? "").toLowerCase()) {
    case "g":
    case "ml":
      return n / 1000;
    case "cl":
      return n / 100;
    default:
      return n;
  }
}

/** The first plausible dd/mm/yyyy in the text, as "YYYY-MM-DD"; "" when none. */
export function findDate(text: string): DateStr {
  for (const m of text.matchAll(new RegExp(DATE, "g"))) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    let y = Number(m[3]);
    if (m[3].length === 2) y += 2000;
    if (d < 1 || d > 31 || mo < 1 || mo > 12 || y < 2000 || y > 2100) continue;
    return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  return "";
}

/** The first Shop whose name appears in the text (accent- and case-blind); "" when none. */
export function findShop(text: string, shops: readonly ShopRef[]): string {
  const hay = normalizeLabel(text);
  for (const s of shops) {
    const needle = normalizeLabel(s.title);
    if (needle && hay.includes(needle)) return s.id;
  }
  return "";
}

/**
 * Text → draft. Heuristics, deliberately few: a line ending in a price is
 * a Line; a negative or discount-worded price lowers the previous Line and
 * flags it promo; a "2 x 1,29" clause on the same or the next line is the
 * amount; the last TOTAL line is the printed total; bookkeeping words are
 * skipped. Matching to Products is the caller's, through label memory.
 */
export function parseReceiptText(text: string, shops: readonly ShopRef[] = []): ReceiptDraft {
  const lines: DraftLine[] = [];
  let total = 0;
  /** A row with no price of its own — the label of the priced row that follows ("BANANES" / "0,842 kg x 1,79 1,51"). */
  let pending = "";
  const rows = text
    .split(/\r?\n/)
    .map((r) => r.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  for (const row of rows) {
    const priceMatch = PRICE_AT_END.exec(row);
    const head = priceMatch ? row.slice(0, priceMatch.index).trim() : row;
    const qty = QTY.exec(row);

    if (priceMatch && TOTAL.test(head) && !NOT_TOTAL.test(head)) {
      total = Math.abs(cents(priceMatch[2], priceMatch[3], ""));
      pending = "";
      continue;
    }
    if (!priceMatch) {
      if (qty) {
        // A bare quantity row ("2 x 1,29") describes the Line just above.
        const last = lines[lines.length - 1];
        if (last && last.amount === 1) last.amount = toAmount(qty[1], qty[2]);
        pending = "";
      } else if (SKIP.test(row) || DATE.test(row) || /^[\d\s:.,/-]+$/.test(row)) {
        pending = "";
      } else {
        pending = row;
      }
      continue;
    }
    const price = cents(priceMatch[2], priceMatch[3], priceMatch[1]);
    if (price < 0 || DISCOUNT.test(head)) {
      const last = lines[lines.length - 1];
      if (last) {
        last.price = Math.max(0, last.price - Math.abs(price));
        last.promo = true;
      }
      pending = "";
      continue;
    }
    if (SKIP.test(head)) {
      pending = "";
      continue;
    }
    let label = head;
    let amount = 1;
    if (qty && qty.index < (priceMatch.index ?? row.length)) {
      amount = toAmount(qty[1], qty[2]);
      label = row.slice(0, qty.index).trim();
    }
    label = label.replace(/^[\W_]+|[\W_]+$/g, "").trim();
    if (!label || /^\d+$/.test(label)) label = pending;
    pending = "";
    if (!label) continue;
    lines.push({ label, amount, price, promo: false, productId: "" });
  }

  // A row that merely repeats the total is not a Line.
  const kept = total > 0 ? lines.filter((l) => !(l.price === total && lines.length > 1)) : lines;

  return { shopId: findShop(text, shops), date: findDate(text), total, branch: "", lines: kept, text };
}
