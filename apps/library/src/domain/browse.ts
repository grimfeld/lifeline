import { GALLERY_SORTS as ALL_SORTS, matchesWorkSearch } from "@lifeline/parts";
import type { Work } from "./types";

export { onShelf, SHELVES, sortGallery, type GallerySort, type Shelf } from "@lifeline/parts";
export { shelfLabel } from "./cardQueries";

/**
 * Free-text search over title, Author names, series, reason and tags (packages/parts).
 * `authorNames` resolves a Work's Author ids to names (ADR 0052) — the caller
 * has the index.
 */
export const matchesSearch = (m: Work, q: string, authorNames: (m: Work) => string[] = () => []): boolean => matchesWorkSearch(m, q, [...authorNames(m), m.series]);

/** Gallery orderings, Rating aside. */
export const GALLERY_SORTS = ALL_SORTS.filter((s) => s.value !== "RATING");

/** A series name as matched (CONTEXT.md, Series): case and punctuation set aside, any script kept. */
const seriesKey = (s: string) =>
  s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/**
 * The works of `work`'s series on the shelf, itself included, in series order
 * (1, 1.5, 2…; unnumbered last, then by title). Series is plain text, so "the
 * same series" is the same text whatever its case and punctuation. Empty for a
 * work outside any series.
 */
export function sameSeries(work: Work, all: Work[]): Work[] {
  const key = seriesKey(work.series);
  if (!key) return [];
  const rank = (w: Work) => (w.seriesNumber > 0 ? w.seriesNumber : Infinity);
  return all.filter((w) => seriesKey(w.series) === key).sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title));
}
