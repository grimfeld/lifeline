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
