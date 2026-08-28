import type { SyncedRecord } from "./db";

/** Deep value equality, key order aside — enough for records that came out of JSON. */
export function sameRecord(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => sameRecord(v, b[i]));
  }
  const ka = Object.keys(a as Record<string, unknown>);
  const kb = Object.keys(b as Record<string, unknown>);
  if (ka.length !== kb.length) return false;
  return ka.every(
    (k) => Object.prototype.hasOwnProperty.call(b, k) && sameRecord((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
  );
}

/**
 * Whether a pulled record should replace the local one. Last-writer-wins on
 * the client clock (ADR 0002), with one addition: a record identical to the
 * one already stored is never written. Every push comes back on the same
 * cycle's pull, and rewriting the row for it woke every live query — handing
 * an open editor its own body back mid-keystroke.
 */
export function shouldApply(local: SyncedRecord | undefined, incoming: SyncedRecord): boolean {
  if (!local) return true;
  if (incoming.updatedAt < local.updatedAt) return false;
  return !sameRecord(local, incoming);
}
