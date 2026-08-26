import type { Engagement, Work } from "./types";
import { workType, type WorkTypeId } from "./workTypes";

/**
 * Free-text search over title, creator, reason and tags. Empty needle matches
 * all. A leading `#` restricts the needle to tags (`#garden`); a bare word also
 * matches items tagged with it (`garden`).
 */
export function matchesSearch(m: Work, q: string): boolean {
  const raw = q.trim().toLowerCase();
  if (!raw) return true;
  const tags = m.tags ?? [];
  if (raw.startsWith("#")) {
    const needle = raw.slice(1);
    return !needle || tags.some((t) => t.includes(needle));
  }
  return [m.title, m.creator, m.reason].some((s) => s.toLowerCase().includes(raw)) || tags.some((t) => t.includes(raw));
}

/** Gallery orderings. */
export type GallerySort = "TITLE" | "ADDED" | "FINISHED" | "YEAR" | "RATING";
export const GALLERY_SORTS: { value: GallerySort; label: string }[] = [
  { value: "TITLE", label: "Title" },
  { value: "ADDED", label: "Recently added" },
  { value: "FINISHED", label: "Recently finished" },
  { value: "YEAR", label: "Year" },
  { value: "RATING", label: "Rating" },
];

const byTitle = (a: Work, b: Work) => a.title.localeCompare(b.title);

/**
 * Sort for the Gallery. Date sorts are newest first; items without the date
 * (never finished, no year) sink to the end, in title order. Year sorts newest
 * release first.
 */
export function sortGallery(items: Work[], sort: GallerySort): Work[] {
  const out = [...items];
  switch (sort) {
    case "TITLE":
      return out.sort(byTitle);
    case "ADDED":
      return out.sort((a, b) => b.addedOn.localeCompare(a.addedOn) || byTitle(a, b));
    case "FINISHED":
      return out.sort((a, b) => Number(!!b.finishedOn) - Number(!!a.finishedOn) || b.finishedOn.localeCompare(a.finishedOn) || byTitle(a, b));
    case "YEAR":
      return out.sort((a, b) => Number(!!b.year) - Number(!!a.year) || b.year - a.year || byTitle(a, b));
    case "RATING":
      // Highest first; unrated sink to the end, in title order.
      return out.sort((a, b) => b.rating - a.rating || byTitle(a, b));
  }
}

/** The ♥ chip (ADR 0035): only what I liked, composing with shelf and search. */
export const isLiked = (m: Work) => m.liked;

/** The Shelf filter (ADR 0006 amendment): one Engagement value or ALL. */
export type Shelf = Engagement | "ALL";
export const SHELVES: Shelf[] = ["UNSTARTED", "IN_PROGRESS", "DONE", "ABANDONED", "ALL"];

/** Shelf label in the medium's verbs; for "all" media, a neutral wording. */
export function shelfLabel(shelf: Shelf, type: WorkTypeId | "all"): string {
  if (shelf === "ALL") return "All";
  if (shelf === "UNSTARTED") {
    if (type === "all") return "To do";
    return workType(type).wantLabel;
  }
  if (shelf === "IN_PROGRESS") return "In progress";
  if (shelf === "DONE") return "Done";
  return "Dropped";
}

export const onShelf = (m: Work, shelf: Shelf) => shelf === "ALL" || m.engagement === shelf;
