import type { MediaItem } from "./types";

/** Status filters shared by the Backlog list and the Gallery. */
export type StatusFilter = "ALL" | "WANTED" | "OWNED_UNSTARTED" | "IN_PROGRESS" | "DONE" | "STUDIED" | "ABANDONED" | "GONE";
export const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "Everything" },
  { value: "WANTED", label: "Wanted" },
  { value: "OWNED_UNSTARTED", label: "Owned but unstarted" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "DONE", label: "Done" },
  { value: "STUDIED", label: "Studied" },
  { value: "ABANDONED", label: "Abandoned" },
  { value: "GONE", label: "Gone" },
];

export function matchesStatus(m: MediaItem, f: StatusFilter): boolean {
  switch (f) {
    case "ALL":
      return true;
    case "WANTED":
      return m.acquisition === "WANTED";
    case "OWNED_UNSTARTED":
      return m.acquisition === "OWNED" && m.engagement === "UNSTARTED";
    case "IN_PROGRESS":
      return m.engagement === "IN_PROGRESS";
    case "DONE":
      return m.engagement === "DONE";
    case "STUDIED":
      return m.studied;
    case "ABANDONED":
      return m.engagement === "ABANDONED";
    case "GONE":
      return m.acquisition === "GONE";
  }
}

/**
 * Free-text search over title, creator, reason and tags. Empty needle matches
 * all. A leading `#` restricts the needle to tags (`#garden`); a bare word also
 * matches items tagged with it (`garden`).
 */
export function matchesSearch(m: MediaItem, q: string): boolean {
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
export type GallerySort = "TITLE" | "ADDED" | "FINISHED" | "YEAR";
export const GALLERY_SORTS: { value: GallerySort; label: string }[] = [
  { value: "TITLE", label: "Title" },
  { value: "ADDED", label: "Recently added" },
  { value: "FINISHED", label: "Recently finished" },
  { value: "YEAR", label: "Year" },
];

const byTitle = (a: MediaItem, b: MediaItem) => a.title.localeCompare(b.title);

/**
 * Sort for the Gallery. Date sorts are newest first; items without the date
 * (never finished, no year) sink to the end, in title order. Year sorts newest
 * release first.
 */
export function sortGallery(items: MediaItem[], sort: GallerySort): MediaItem[] {
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
  }
}
