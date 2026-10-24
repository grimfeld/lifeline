import { useMemo, useRef } from "react";

/**
 * The previous value while the new one is structurally the same (JSON-equal).
 * The read-side Contract hooks rebuild their rows on every render — each
 * provider maps its own live query afresh — so without this every `useMemo`
 * downstream of them misses. Rows are plain data; a few hundred at most.
 * The same value handed in again is not serialised again.
 */
export function useStructuralMemo<T>(value: T): T {
  const last = useRef<{ value: T; key: string; out: T } | null>(null);
  const prev = last.current;
  if (prev && prev.value === value) return prev.out;
  const key = JSON.stringify(value);
  const out = prev && prev.key === key ? prev.out : value;
  last.current = { value, key, out };
  return out;
}

/** A stored row as far as reuse goes: every write stamps a new `updatedAt`. */
type Stamped = { id: string; updatedAt: string };

/**
 * `next` with every row whose id and `updatedAt` match one in `prev` replaced
 * by that earlier object — and `prev` itself when nothing changed at all. A
 * live query reads fresh objects on every change, so without this a list
 * memoised per row redraws every row for one edit.
 */
export function reuseRows<T extends Stamped>(prev: readonly T[], next: T[]): T[] {
  if (prev.length === 0) return next;
  const old = new Map(prev.map((r) => [r.id, r]));
  let same = prev.length === next.length;
  const out = next.map((r, i) => {
    const o = old.get(r.id);
    const kept = o && o.updatedAt === r.updatedAt ? o : r;
    if (kept !== prev[i]) same = false;
    return kept;
  });
  return same ? (prev as T[]) : out;
}

/** `reuseRows` across renders: row objects keep their identity until the row itself is written. */
export function useStableRows<T extends Stamped>(rows: T[]): T[] {
  const last = useRef<T[]>([]);
  return useMemo(() => (last.current = reuseRows(last.current, rows)), [rows]);
}
