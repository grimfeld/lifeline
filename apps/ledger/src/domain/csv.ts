import type { DateStr } from "@lifeline/core";
import type { ImportMapping, Transaction } from "./types";
import { parseAmount } from "./money";

/**
 * CSV import (ADR 0033): parse the file the user hands over, apply the
 * Account's saved mapping, flag probable duplicates in preview — bank row
 * id when the CSV has one, else an account+date+amount fingerprint — never
 * silently drop, never silently double.
 */

/** Minimal RFC-4180-ish parser: quotes, escaped quotes, commas/semicolons/tabs auto-detected. */
export function parseCsv(text: string): string[][] {
  // A leading byte-order mark would otherwise glue itself to the first header ("\ufeffDate").
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const firstLine = text.slice(0, text.indexOf("\n") + 1 || text.length);
  const delimiter = [";", "\t", ","].reduce((best, d) => (countOutsideQuotes(firstLine, d) > countOutsideQuotes(firstLine, best) ? d : best), ",");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

function countOutsideQuotes(line: string, ch: string): number {
  let n = 0;
  let q = false;
  for (const c of line) {
    if (c === '"') q = !q;
    else if (c === ch && !q) n++;
  }
  return n;
}

/** "31-01-2026", "31/01/2026", "2026-01-31", "01/31/2026" → "YYYY-MM-DD" per the mapping's format; null when unreadable. */
export function parseDate(text: string, format: ImportMapping["dateFormat"]): DateStr | null {
  const nums = text.trim().split(/[^\d]+/).filter(Boolean).map(Number);
  if (nums.length !== 3) return null;
  const [a = 0, b = 0, c = 0] = nums;
  const [y, m, d] = format === "YMD" ? [a, b, c] : format === "DMY" ? [c, b, a] : [c, a, b];
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** One CSV row read through a mapping: what would be posted. */
export interface ImportRow {
  /** Row index in the file, for error reporting. */
  index: number;
  date: DateStr | null;
  /** Signed cents: negative = expense, positive = income. */
  amount: number | null;
  payee: string;
  note: string;
  importId: string;
  /** Unreadable date or amount, or dated after today — never posted, shown as a problem. */
  invalid: boolean;
  /** Dated after today: the ledger accepts only witnessed events (ADR 0042), so the row is invalid. */
  future?: boolean;
  /** Probable duplicate of an existing Transaction — unticked by default, the user decides. */
  duplicateOf: string | null;
}

export function applyMapping(rows: string[][], mapping: ImportMapping): ImportRow[] {
  const body = mapping.skipHeader ? rows.slice(1) : rows;
  const offset = mapping.skipHeader ? 1 : 0;
  return body.map((cells, i) => {
    const raw = (col: number | null) => (col === null ? "" : (cells[col] ?? "").trim());
    const date = parseDate(raw(mapping.dateCol), mapping.dateFormat);
    let amount = parseAmount(raw(mapping.amountCol));
    if (amount !== null && mapping.invert) amount = -amount;
    return {
      index: i + offset,
      date,
      amount,
      payee: raw(mapping.payeeCol),
      note: raw(mapping.noteCol),
      importId: raw(mapping.idCol),
      invalid: date === null || amount === null || amount === 0,
      duplicateOf: null,
    };
  });
}

/**
 * Mark rows dated after today invalid: the ledger refuses them on post
 * (ADR 0042), so the preview says so up front instead of the import
 * stopping halfway.
 */
export function flagFuture(rows: ImportRow[], today: DateStr): ImportRow[] {
  return rows.map((r) => (!r.invalid && r.date !== null && r.date > today ? { ...r, invalid: true, future: true } : r));
}

/**
 * Flag probable duplicates against the ledger: an importId match is certain;
 * otherwise same account + date + amount + kind is probable (a hand-entered
 * copy of the same bank row).
 */
export function flagDuplicates(rows: ImportRow[], existing: Transaction[], accountId: string): ImportRow[] {
  const byImportId = new Map<string, string>();
  const byFingerprint = new Map<string, string>();
  for (const t of existing) {
    if (t.importId) byImportId.set(t.importId, t.id);
    if ((t.kind === "expense" || t.kind === "income") && t.accountId === accountId) {
      byFingerprint.set(`${t.date}/${t.kind}/${t.amount}`, t.id);
    }
  }
  return rows.map((r) => {
    if (r.invalid || r.date === null || r.amount === null) return r;
    const byId = r.importId ? byImportId.get(r.importId) : undefined;
    const kind = r.amount < 0 ? "expense" : "income";
    const byPrint = byFingerprint.get(`${r.date}/${kind}/${Math.abs(r.amount)}`);
    return { ...r, duplicateOf: byId ?? byPrint ?? null };
  });
}
