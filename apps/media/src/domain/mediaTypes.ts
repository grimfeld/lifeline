import type { Engagement } from "./types";

export type MediaTypeId = "book" | "comic" | "movie" | "series" | "music" | "game";

export interface MediaTypeDef {
  id: MediaTypeId;
  label: string;
  plural: string;
  /** "Author", "Director", … */
  creatorLabel: string;
  /** Unit of `size`; "" = no size. */
  sizeUnit: string;
  /** Per-type Nightstand cap. Fixed in code on purpose (ADR 0006). */
  slotCount: number;
  /** Cover art shape. */
  cover: "portrait" | "square";
  /** Display verbs for the four Engagement states. */
  engagement: Record<Engagement, string>;
  /** Verb for the "start" action. */
  startVerb: string;
  finishVerb: string;
  /** Shelf label for not-yet-started items: "To read", "To watch"… (ADR 0006 amendment). */
  wantLabel: string;
}

const READ = { UNSTARTED: "Unread", IN_PROGRESS: "Reading", DONE: "Read", ABANDONED: "Abandoned" };
const WATCH = { UNSTARTED: "Unwatched", IN_PROGRESS: "Watching", DONE: "Watched", ABANDONED: "Abandoned" };

/**
 * The media type registry: adding a medium is adding an entry here (plus, if
 * it needs one, a lookup provider in data/lookup.ts). Everything else —
 * shelves, dates, screens — is shared. Only books and comics have Nightstand slots (ADR 0006 amendment).
 */
export const MEDIA_TYPES: MediaTypeDef[] = [
  { id: "book", label: "Book", plural: "Books", creatorLabel: "Author", sizeUnit: "pages", slotCount: 5, cover: "portrait", engagement: READ, startVerb: "Start", finishVerb: "Finish", wantLabel: "To read" },
  { id: "comic", label: "Comic", plural: "Comics", creatorLabel: "Author / artist", sizeUnit: "issues", slotCount: 3, cover: "portrait", engagement: READ, startVerb: "Start", finishVerb: "Finish", wantLabel: "To read" },
  { id: "movie", label: "Movie", plural: "Movies", creatorLabel: "Director", sizeUnit: "min", slotCount: 0, cover: "portrait", engagement: WATCH, startVerb: "Start", finishVerb: "Finish", wantLabel: "To watch" },
  { id: "series", label: "Series", plural: "Series", creatorLabel: "Creator", sizeUnit: "episodes", slotCount: 0, cover: "portrait", engagement: WATCH, startVerb: "Start", finishVerb: "Finish", wantLabel: "To watch" },
  { id: "music", label: "Album", plural: "Music", creatorLabel: "Artist", sizeUnit: "tracks", slotCount: 0, cover: "square", engagement: { UNSTARTED: "Unheard", IN_PROGRESS: "Listening", DONE: "Listened", ABANDONED: "Abandoned" }, startVerb: "Start", finishVerb: "Finish", wantLabel: "To listen" },
  { id: "game", label: "Game", plural: "Games", creatorLabel: "Developer", sizeUnit: "hours", slotCount: 0, cover: "portrait", engagement: { UNSTARTED: "Unplayed", IN_PROGRESS: "Playing", DONE: "Played", ABANDONED: "Abandoned" }, startVerb: "Start", finishVerb: "Finish", wantLabel: "To play" },
];

export function mediaType(id: MediaTypeId): MediaTypeDef {
  return MEDIA_TYPES.find((t) => t.id === id) ?? MEDIA_TYPES[0];
}

/** Types that have a Nightstand (slotCount > 0). */
export const SLOTTED_TYPES: MediaTypeId[] = MEDIA_TYPES.filter((t) => t.slotCount > 0).map((t) => t.id);
export const hasSlots = (id: MediaTypeId) => mediaType(id).slotCount > 0;
