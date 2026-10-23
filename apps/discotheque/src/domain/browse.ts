import { matchesWorkSearch } from "@lifeline/parts";
import type { Work } from "./types";

export { onShelf, SHELVES, sortGallery, type GallerySort, type Shelf } from "@lifeline/parts";
export { shelfLabel } from "./cardQueries";

/** Free-text search over title, creator, reason and tags (packages/parts). */
export const matchesSearch = (m: Work, q: string): boolean => matchesWorkSearch(m, q, [m.creator]);

export { GALLERY_SORTS, isLiked } from "@lifeline/parts";
