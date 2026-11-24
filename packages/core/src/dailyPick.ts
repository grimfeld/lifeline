import type { DateStr } from "./dates";

/** Deterministic per-day pick: the same item all day on every device (sorted by id, indexed by a hash of the date), different tomorrow. */
export function pickForDay<T extends { id: string }>(list: T[], date: DateStr): T | undefined {
  if (list.length === 0) return undefined;
  const sorted = [...list].sort((a, b) => a.id.localeCompare(b.id));
  let h = 0;
  for (const ch of date) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return sorted[h % sorted.length];
}
