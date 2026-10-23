/**
 * How lookup results touch a work (ADR 0006 amendment, metadata lookups),
 * shared by every media App: a lookup fills *empty* fields only and never
 * overwrites what the user typed; a refresh re-pulls the fields the source
 * owns for a work that already has an external identity; "Enrich all"
 * auto-applies only an exact title(+year) match. Each App names its fields.
 */

/** What the App's lookup hit and its work share: the fields named, and the external identity. */
type Enrichable<K extends string> = { [P in K | "externalKey"]: string | number };

/** Fill only the empty fields ("" / 0) among `keys` from the hit; externalKey is set whenever the work has none. */
export function applyHit<T extends Enrichable<K>, K extends keyof T & string>(item: T, hit: Pick<T, K | "externalKey">, keys: readonly K[]): Partial<T> {
  const patch: Partial<T> = {};
  for (const k of keys) if (!item[k] && hit[k]) patch[k] = hit[k];
  if (!item.externalKey && hit.externalKey) patch.externalKey = hit.externalKey;
  return patch;
}

/** Overwrite `keys` from the source when they differ; empty hit values leave the field alone. externalKey is set whenever the work has none. */
export function refreshFromHit<T extends Enrichable<K>, K extends keyof T & string>(item: T, hit: Pick<T, K | "externalKey">, keys: readonly K[]): Partial<T> {
  const patch: Partial<T> = {};
  for (const k of keys) if (hit[k] && hit[k] !== item[k]) patch[k] = hit[k];
  if (!item.externalKey && hit.externalKey) patch.externalKey = hit.externalKey;
  return patch;
}

/** Case/punctuation/diacritic-insensitive title key ("The Hobbit: or There…" ≈ "the hobbit or there"). */
export function normalizeTitle(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * The one hit that matches the title exactly (normalized) and the year (when
 * the work has one; 0 = match on title alone) — null if none or if several qualify.
 */
export function confidentMatch<H extends { title: string; year?: string | number }>(title: string, year: number, hits: H[]): H | null {
  const key = normalizeTitle(title);
  if (!key) return null;
  const matching = hits.filter((h) => normalizeTitle(h.title) === key && (!year || h.year === year));
  return matching.length === 1 ? (matching[0] ?? null) : null;
}
