import type { DateStr } from "@lifeline/core";

/**
 * The browsing and Card queries every shelved medium shares (Library, Cinema,
 * Discothèque, Arcade): search, Gallery sorts, the Shelf filter, and the
 * per-medium queries the Cards ask. Pure; each App supplies its registry and
 * what differs (who wrote it, what the Surprise pool holds).
 */

/** The Shelf (CONTEXT.md): how far I have got through it. */
export type Engagement = "UNSTARTED" | "IN_PROGRESS" | "DONE" | "ABANDONED";

/** What every shelved work carries. Acquisition belongs to the media that keep copies. */
export interface ShelvedWork<T extends string = string> {
  type: T;
  title: string;
  reason: string;
  tags?: string[];
  engagement: Engagement;
  year: number;
  addedOn: DateStr;
  startedOn: DateStr;
  finishedOn: DateStr;
  /** Media without Acquisition (streamed) have no acquired day. */
  acquiredOn?: DateStr;
  /** Marks (ADR 0035), where the medium keeps them. */
  rating?: number;
  liked?: boolean;
}

/** A medium as its App's registry names it. */
export interface ShelfMedium<T extends string> {
  id: T;
  label: string;
  plural: string;
  wantLabel: string;
  engagement: Record<Engagement, string>;
}

/**
 * Free-text search over title, reason, the App's `names` (creator, Author
 * names) and tags. Empty needle matches all. A leading `#` restricts the
 * needle to tags (`#garden`); a bare word also matches items tagged with it.
 */
export function matchesWorkSearch(m: ShelvedWork, q: string, names: string[] = []): boolean {
  const raw = q.trim().toLowerCase();
  if (!raw) return true;
  const tags = m.tags ?? [];
  if (raw.startsWith("#")) {
    const needle = raw.slice(1);
    return !needle || tags.some((t) => t.includes(needle));
  }
  return [m.title, m.reason, ...names].some((s) => s.toLowerCase().includes(raw)) || tags.some((t) => t.includes(raw));
}

/** Gallery orderings. RATING only for media that keep Marks. */
export type GallerySort = "TITLE" | "ADDED" | "FINISHED" | "YEAR" | "RATING";
export const GALLERY_SORTS: { value: GallerySort; label: string }[] = [
  { value: "TITLE", label: "Title" },
  { value: "ADDED", label: "Recently added" },
  { value: "FINISHED", label: "Recently finished" },
  { value: "YEAR", label: "Year" },
  { value: "RATING", label: "Rating" },
];

const byTitle = (a: ShelvedWork, b: ShelvedWork) => a.title.localeCompare(b.title);

/**
 * Sort for the Gallery. Date sorts are newest first; items without the date
 * (never finished, no year) sink to the end, in title order. Year sorts newest
 * release first.
 */
export function sortGallery<W extends ShelvedWork>(items: W[], sort: GallerySort): W[] {
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
      return out.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || byTitle(a, b));
  }
}

/** The ♥ chip (ADR 0035): only what I liked, composing with shelf and search. */
export const isLiked = (m: ShelvedWork) => !!m.liked;

/** The Shelf filter (ADR 0006 amendment): one Engagement value or ALL. */
export type Shelf = Engagement | "ALL";
export const SHELVES: Shelf[] = ["UNSTARTED", "IN_PROGRESS", "DONE", "ABANDONED", "ALL"];

/** Shelf label in the medium's verbs (`wantLabel`, "To read"); without one, a neutral wording. */
export function shelfName(shelf: Shelf, wantLabel = "To do"): string {
  if (shelf === "ALL") return "All";
  if (shelf === "UNSTARTED") return wantLabel;
  if (shelf === "IN_PROGRESS") return "In progress";
  if (shelf === "DONE") return "Done";
  return "Dropped";
}

export const onShelf = (m: ShelvedWork, shelf: Shelf) => shelf === "ALL" || m.engagement === shelf;

/** A random index into `pool` different from `avoid` when the pool allows it. */
export function pickIndex(poolSize: number, avoid: number | null, rnd: () => number = Math.random): number {
  if (poolSize <= 0) return -1;
  if (poolSize === 1) return 0;
  let i = Math.floor(rnd() * poolSize);
  if (i === avoid) i = (i + 1 + Math.floor(rnd() * (poolSize - 1))) % poolSize;
  return i;
}

/** One Daylog line for a media item on a day: what happened, in the medium's words. */
export interface WorkDayFact<W> {
  item: W;
  /** Verb-first: the medium's past-tense finish verb ("Read", "Watched"…), else "Started" / "Acquired" / "Added". */
  kind: string;
}

/**
 * The Card queries over one App's registry. `inPool` says what the
 * "Surprise me" pool holds beyond being unstarted (the copies I have, for
 * media with Acquisition).
 */
export function shelfQueries<T extends string, W extends ShelvedWork<T>>(types: readonly ShelfMedium<T>[], inPool: (m: W) => boolean = () => true) {
  const medium = (id: T): ShelfMedium<T> => {
    const def = types.find((t) => t.id === id);
    if (!def) throw new Error(`Unknown work type: ${id}`);
    return def;
  };

  /** "" = any medium (the shared `medium` card knob). */
  type MediumFilter = T | "";

  const byMedium = (items: W[], m: MediumFilter) => (m ? items.filter((w) => w.type === m) : items);

  /** Human label for the medium knob: "" → "", "book" → "Books". */
  const mediumLabel = (m: string): string => (m ? medium(m as T).plural : "");

  /** Everything being read/watched/played right now, most recently started first. */
  const inProgress = (items: W[], m: MediumFilter = ""): W[] =>
    byMedium(items, m)
      .filter((w) => w.engagement === "IN_PROGRESS")
      .sort((a, b) => b.startedOn.localeCompare(a.startedOn));

  return {
    byMedium,
    mediumLabel,
    /** "Base" or "Base · Books" — the instanceTitle convention shared by every media card. */
    titleWithMedium: (base: string, m: unknown) => (typeof m === "string" && m ? `${base} · ${mediumLabel(m)}` : base),
    inProgress,
    /** Done items finished in `year`, most recently finished first. */
    finishedIn: (items: W[], year: number, m: MediumFilter = ""): W[] => {
      const prefix = `${year}-`;
      return byMedium(items, m)
        .filter((w) => w.engagement === "DONE" && w.finishedOn.startsWith(prefix))
        .sort((a, b) => b.finishedOn.localeCompare(a.finishedOn));
    },
    /** The "Surprise me" pool: unstarted, and whatever else the App asks. */
    surprisePool: (items: W[], m: MediumFilter = ""): W[] => byMedium(items, m).filter((w) => w.engagement === "UNSTARTED" && inPool(w)),
    /** The item a quote capture should default to: first in-progress of the medium (latest started), else the most recently added. */
    defaultCaptureItem: (items: W[], m: MediumFilter = ""): W | undefined => {
      const ofMedium = byMedium(items, m);
      const going = inProgress(ofMedium);
      if (going[0]) return going[0];
      return [...ofMedium].sort((a, b) => b.addedOn.localeCompare(a.addedOn))[0];
    },
    /** Counts per medium, in registry order, omitting zeros. */
    countByMedium: (items: W[]): { medium: T; count: number }[] =>
      types.map((t) => ({ medium: t.id, count: items.filter((w) => w.type === t.id).length })).filter((c) => c.count > 0),
    /** "12 books · 5 movies". */
    mediumBreakdown: (items: W[]): string =>
      types
        .map((t) => ({ def: t, count: items.filter((w) => w.type === t.id).length }))
        .filter((c) => c.count > 0)
        .map(({ def, count }) => `${count} ${(count === 1 ? def.label : def.plural).toLowerCase()}`)
        .join(" · "),
    /** Shelf label in the medium's verbs; for "all" media, a neutral wording. */
    shelfLabel: (shelf: Shelf, type: T | "all"): string => shelfName(shelf, type === "all" ? undefined : medium(type).wantLabel),
    /**
     * The facts of one day, one line per item, most significant stamp wins:
     * finished > started > acquired > added. Finishing uses the medium's own
     * past-tense verb (registry `engagement.DONE`); the other verbs are neutral.
     */
    daylogFacts: (items: W[], day: DateStr): WorkDayFact<W>[] => {
      const out: WorkDayFact<W>[] = [];
      for (const item of items) {
        if (item.finishedOn === day) out.push({ item, kind: medium(item.type).engagement.DONE });
        else if (item.startedOn === day) out.push({ item, kind: "Started" });
        else if (item.acquiredOn === day) out.push({ item, kind: "Acquired" });
        else if (item.addedOn === day) out.push({ item, kind: "Added" });
      }
      return out;
    },
  };
}
