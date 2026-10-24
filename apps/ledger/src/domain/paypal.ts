import type { DateStr } from "@lifeline/core";
import { parseCsv, parseDate } from "./csv";
import { CURRENCY, parseAmount } from "./money";

/**
 * PayPal payee resolution (ADR 0033 spirit): the bank writes every PayPal
 * payment under one payee ("PAYPAL EUROPE S.A.R.L. ET CIE S.C.A"), so the
 * history-derived suggester in `suggest.ts` sees one merchant where there
 * were forty — categorize once and everything PayPal inherits it. The fix
 * is upstream of the payee string, not in the suggester: PayPal's own
 * Activity CSV (paypal.com → Activity → Download) carries the real merchant
 * name, and this module matches a bank row to its PayPal entry so the
 * payee can be replaced. Same file, two entry points: the import preview
 * and the later sweep over history.
 *
 * Nothing is fetched — the user exports the file and hands it over, exactly
 * as bank import already works. And nothing is guessed: a row matches on a
 * reference the bank itself wrote, or on a unique amount-and-date hit;
 * several possible merchants is an ambiguity the user resolves, never a
 * coin flip.
 */

/** One balance-affecting line of PayPal's Activity CSV. */
export interface PaypalEntry {
  /** PayPal's own transaction id — unique, stable, and our idempotency key. */
  id: string;
  date: DateStr;
  /** Signed cents, PayPal's own sign: negative = money out. */
  amount: number;
  /** The counterparty as PayPal knows it — the whole point of the file. */
  name: string;
  /** Item title / subject: the fallback when a row has no name. */
  subject: string;
  /** "Reference Txn ID": the payment a funding or fee row hangs off. */
  refId: string;
  /** PayPal's own row type ("Express Checkout Payment", "General Currency Conversion"…). */
  type: string;
  /** ISO code of the row's own currency ("EUR", "USD"); "" when the file has no such column. */
  currency: string;
}

// ---- Parsing -------------------------------------------------------------

/** "Numéro de transaction" → "numero de transaction": PayPal localizes its headers. */
function normalizeHeader(s: string): string {
  return s
    .replace(/n[°º]/gi, "numero")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Which header means what. PayPal writes the file in the account's own
 * language — and has renamed columns over the years ("Brut" became "Avant
 * commission", "Numéro de transaction de référence" grew a "la") — so each
 * column is found by any of its known names: English first, then the other
 * languages a European account is likely to produce. A column already
 * claimed by a more specific field is never reused, so a reference-id
 * header cannot be read as the id.
 */
const COLUMNS = {
  refId: [
    "reference txn id",
    "numero de transaction de reference",
    "numero de la transaction de reference",
    "referenztransaktionscode",
    "id de transaccion de referencia",
    "id transazione di riferimento",
  ],
  id: ["transaction id", "numero de transaction", "transaktionscode", "id de transaccion", "codice transazione"],
  date: ["date", "datum", "fecha", "data"],
  name: ["name", "nom", "nombre", "nome"],
  type: ["type", "typ", "tipo"],
  gross: ["gross", "brut", "avant commission", "brutto", "bruto", "lordo"],
  /** Read when the file has no gross column at all. */
  net: ["net", "netto", "neto"],
  currency: ["currency", "devise", "wahrung", "moneda", "valuta"],
  impact: ["balance impact", "impact sur le solde", "auswirkung auf saldo", "impacto en el saldo", "impatto sul saldo"],
  subject: ["subject", "item title", "objet", "titre de l objet", "artikelbezeichnung", "titulo del articulo", "oggetto"],
} satisfies Record<string, string[]>;

type ColumnKey = keyof typeof COLUMNS;

/** Column index per field, or -1. Claimed left to right in COLUMNS order — most specific first. */
function findColumns(header: string[]): Record<ColumnKey, number> {
  const normalized = header.map(normalizeHeader);
  const taken = new Set<number>();
  const out = {} as Record<ColumnKey, number>;
  for (const key of Object.keys(COLUMNS) as ColumnKey[]) {
    const aliases: string[] = COLUMNS[key];
    const at = normalized.findIndex((h, i) => !taken.has(i) && aliases.includes(h));
    out[key] = at;
    if (at >= 0) taken.add(at);
  }
  return out;
}

/**
 * PayPal writes dates in the account's locale ("10/03/2026" or "3/10/2026"),
 * so the format is read off the whole column: a day above 12 settles it,
 * a four-digit lead means ISO. Genuinely ambiguous columns are read
 * day-first, matching the bank import's own default.
 */
export function inferDateFormat(cells: string[]): "YMD" | "DMY" | "MDY" {
  let dmy = false;
  let mdy = false;
  for (const cell of cells) {
    const nums = cell.trim().split(/[^\d]+/).filter(Boolean).map(Number);
    const [first = 0, second = 0] = nums;
    if (nums.length !== 3) continue;
    if (first > 31) return "YMD";
    if (first > 12) dmy = true;
    if (second > 12) mdy = true;
  }
  if (dmy && !mdy) return "DMY";
  if (mdy && !dmy) return "MDY";
  return "DMY";
}

/** Thrown with the headers we did see, so the dialog can say what was wrong. */
export class PaypalFormatError extends Error {}

/**
 * Every balance-affecting row of a PayPal Activity CSV. Memo rows (PayPal's
 * own non-balance shadow entries) are dropped — they would double every
 * candidate. Rows without a readable date or amount are skipped rather than
 * reported: this file is a reference, not something being posted.
 */
export function parsePaypalCsv(text: string): PaypalEntry[] {
  const rows = parseCsv(text);
  const [header] = rows;
  if (!header || rows.length < 2) throw new PaypalFormatError("That file has no rows.");
  const col = findColumns(header);
  const amountCol = col.gross >= 0 ? col.gross : col.net;
  const missing = [col.date < 0 && "Date", amountCol < 0 && "Gross", col.name < 0 && col.subject < 0 && "Name"].filter(Boolean);
  if (missing.length > 0) {
    throw new PaypalFormatError(`Not a PayPal activity CSV — no ${missing.join(", ")} column. Found: ${header.filter(Boolean).slice(0, 12).join(", ")}`);
  }
  const body = rows.slice(1);
  const format = inferDateFormat(body.map((r) => (r[col.date] ?? "").trim()));
  const cell = (row: string[], at: number) => (at < 0 ? "" : (row[at] ?? "").trim());
  const out: PaypalEntry[] = [];
  for (const [i, row] of body.entries()) {
    const impact = normalizeHeader(cell(row, col.impact));
    if (impact === "memo" || impact === "note") continue;
    const date = parseDate(cell(row, col.date), format);
    const amount = parseAmount(cell(row, amountCol));
    if (date === null || amount === null || amount === 0) continue;
    out.push({
      id: cell(row, col.id) || `pp-${date}-${amount}-${i}`,
      date,
      amount,
      name: cell(row, col.name),
      subject: cell(row, col.subject),
      refId: cell(row, col.refId),
      type: cell(row, col.type),
      currency: cell(row, col.currency).toUpperCase(),
    });
  }
  return out;
}

// ---- The index -----------------------------------------------------------

/** A resolved merchant plus the entry it came from. */
export interface PaypalCandidate {
  entry: PaypalEntry;
  payee: string;
}

/**
 * Parsed entries, the by-id lookup that lets a funding row borrow its
 * payment's merchant, and every entry that ends up naming one. Resolved
 * once here rather than per bank row: a year of PayPal against a year of
 * bank rows would otherwise walk the file thousands of times over.
 */
export interface PaypalIndex {
  entries: PaypalEntry[];
  byId: Map<string, PaypalEntry>;
  named: PaypalCandidate[];
}

export function paypalIndex(entries: PaypalEntry[]): PaypalIndex {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const index: PaypalIndex = { entries, byId, named: [] };
  index.named = entries.map((entry) => ({ entry, payee: payeeOf(entry, index) })).filter((c) => c.payee !== "");
  return index;
}

/**
 * Does this payee string look like the bank's word for PayPal? The trigger
 * for both entry points — everything else is left alone.
 */
export function looksLikePaypal(payee: string): boolean {
  const s = payee.toLowerCase();
  return /pay\s*pal/.test(s) || /(^|[\s*])pp[\s*]/.test(s);
}

/**
 * The merchant a PayPal row is really about. A payment carries it directly;
 * a funding or currency-conversion row carries only PayPal's own name and a
 * reference to the payment that caused it, so it borrows that one's.
 */
export function payeeOf(entry: PaypalEntry, index: PaypalIndex, depth = 0): string {
  const own = entry.name.trim();
  if (own && !looksLikePaypal(own)) return own;
  const referenced = depth < 3 && entry.refId ? index.byId.get(entry.refId) : undefined;
  if (referenced && referenced.id !== entry.id) {
    const borrowed = payeeOf(referenced, index, depth + 1);
    if (borrowed) return borrowed;
  }
  return entry.subject.trim() || own;
}

// ---- Matching ------------------------------------------------------------

/** The bank posts a PayPal debit the same day or a few days later; a value date can also lead by one. */
const WINDOW_BEFORE = 1;
const WINDOW_AFTER = 5;
/** Shorter reference tokens ("PP", an invoice counter) would match anything. */
const MIN_REFERENCE = 10;

function dayDiff(a: DateStr, b: DateStr): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);
}

export interface PaypalMatch {
  /** exact: the bank row quotes a PayPal reference. confident: one merchant fits the amount and the days. ambiguous: several do. */
  status: "exact" | "confident" | "ambiguous" | "none";
  /** The answer for exact and confident; null otherwise — ambiguity is the user's to settle. */
  pick: PaypalCandidate | null;
  /** Every merchant that fits, nearest day first. */
  candidates: PaypalCandidate[];
}

const NONE: PaypalMatch = { status: "none", pick: null, candidates: [] };

/** One bank row, as much of it as matching needs. */
export interface PaypalQuery {
  date: DateStr;
  /** Signed or magnitude cents — only the magnitude is compared. */
  amount: number;
  /** Payee and note together: a bank that quotes the PayPal reference usually does it in the memo. */
  text: string;
}

/**
 * Is this row's amount in the ledger's own currency? A foreign-currency
 * purchase appears in the file twice — the payment in dollars and the
 * conversion in euros, referencing it — and only the euro line can equal
 * what the bank posted; the dollar figure matching a euro row would be pure
 * coincidence. A file without a currency column is trusted as-is.
 */
function inLedgerCurrency(entry: PaypalEntry): boolean {
  return entry.currency === "" || entry.currency === CURRENCY;
}

/**
 * Match one bank row against the PayPal file. A reference the bank itself
 * quoted wins outright; otherwise the amount must match to the cent, in the
 * ledger's currency, and the day must fall in the posting window, and only
 * a single merchant surviving that counts as an answer. Several merchants,
 * or none, and the payee is left exactly as the bank wrote it.
 */
export function matchPaypal(row: PaypalQuery, index: PaypalIndex): PaypalMatch {
  const named = index.named;
  if (named.length === 0) return NONE;

  const haystack = row.text.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const quoted = named.filter(({ entry }) => {
    const refs = [entry.id, entry.refId].filter((r) => r.length >= MIN_REFERENCE);
    return refs.some((r) => haystack.includes(r.toUpperCase().replace(/[^A-Z0-9]/g, "")));
  });
  const [firstQuoted] = quoted;
  if (firstQuoted) {
    // Several rows share a reference (a payment and its funding); the one whose amount matches is the payment.
    const byAmount = quoted.filter((c) => inLedgerCurrency(c.entry) && Math.abs(c.entry.amount) === Math.abs(row.amount));
    return { status: "exact", pick: byAmount[0] ?? firstQuoted, candidates: quoted };
  }

  const fits = named
    .filter((c) => inLedgerCurrency(c.entry) && Math.abs(c.entry.amount) === Math.abs(row.amount))
    .map((c) => ({ ...c, diff: dayDiff(row.date, c.entry.date) }))
    .filter((c) => c.diff >= -WINDOW_BEFORE && c.diff <= WINDOW_AFTER)
    .sort((a, b) => Math.abs(a.diff) - Math.abs(b.diff) || a.entry.date.localeCompare(b.entry.date));
  if (fits.length === 0) return NONE;

  // Two rows naming the same merchant are one answer, not an ambiguity.
  const distinct = new Map<string, PaypalCandidate>();
  for (const c of fits) if (!distinct.has(c.payee.toLowerCase())) distinct.set(c.payee.toLowerCase(), { entry: c.entry, payee: c.payee });
  const candidates = Array.from(distinct.values());
  if (candidates.length === 1 && candidates[0]) return { status: "confident", pick: candidates[0], candidates };
  return { status: "ambiguous", pick: null, candidates };
}
