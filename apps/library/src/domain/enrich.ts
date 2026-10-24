import type { WorkHit } from "../data/openlibrary";
import type { Patch } from "./rules";
import type { Work } from "./types";

/**
 * How lookup results touch an item (ADR 0006 amendment, metadata lookups):
 * a lookup fills *empty* fields only and never overwrites what the user typed;
 * a refresh re-pulls cover/size/year for an item that already has an external
 * identity; "Enrich all" auto-applies only an exact title(+year) match.
 */

type Fillable = Pick<Work, "year" | "size" | "coverUrl" | "externalKey">;

/**
 * Fill only the empty fields ("" / 0) from the hit; externalKey is set
 * whenever the item has none. Authors are filled by the caller (they are
 * Documents to find-or-create, ADR 0052) — only when the item has none.
 */
export function applyHit(item: Fillable, hit: WorkHit): Patch {
  const patch: Patch = {};
  if (!item.year && hit.year) patch.year = hit.year;
  if (!item.size && hit.size) patch.size = hit.size;
  if (!item.coverUrl && hit.coverUrl) patch.coverUrl = hit.coverUrl;
  if (!item.externalKey && hit.externalKey) patch.externalKey = hit.externalKey;
  return patch;
}

/** Overwrite cover/size/year from the source (never title or Authors). Empty hit values leave the field alone. */
export function refreshFromHit(item: Fillable, hit: WorkHit): Patch {
  const patch: Patch = {};
  if (hit.coverUrl && hit.coverUrl !== item.coverUrl) patch.coverUrl = hit.coverUrl;
  if (hit.size && hit.size !== item.size) patch.size = hit.size;
  if (hit.year && hit.year !== item.year) patch.year = hit.year;
  if (!item.externalKey && hit.externalKey) patch.externalKey = hit.externalKey;
  return patch;
}

/** Case/punctuation/diacritic-insensitive title key ("The Hobbit: or There…" ≈ "the hobbit or there"). */
export function normalizeTitle(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * The one hit that matches the title exactly (normalized) and the year (when
 * the item has one) — null if none or if several qualify.
 */
export function confidentMatch(title: string, year: number, hits: WorkHit[]): WorkHit | null {
  const key = normalizeTitle(title);
  if (!key) return null;
  const matching = hits.filter((h) => normalizeTitle(h.title) === key && (!year || h.year === year));
  return matching.length === 1 ? matching[0]! : null;
}
