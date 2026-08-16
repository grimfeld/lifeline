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
  /** Whether Open Library lookup applies (books/comics). */
  lookup: "openlibrary" | null;
}

const READ = { UNSTARTED: "Unread", IN_PROGRESS: "Reading", DONE: "Read", ABANDONED: "Abandoned" };
const WATCH = { UNSTARTED: "Unwatched", IN_PROGRESS: "Watching", DONE: "Watched", ABANDONED: "Abandoned" };

/**
 * The media type registry: adding a medium is adding an entry here (plus, if
 * it needs one, a lookup source). Everything else — slots, axes, backlog,
 * dates, screens — is shared.
 */
export const MEDIA_TYPES: MediaTypeDef[] = [
  { id: "book", label: "Book", plural: "Books", creatorLabel: "Author", sizeUnit: "pages", slotCount: 5, cover: "portrait", engagement: READ, startVerb: "Start", finishVerb: "Finish", lookup: "openlibrary" },
  { id: "comic", label: "Comic", plural: "Comics", creatorLabel: "Author / artist", sizeUnit: "issues", slotCount: 3, cover: "portrait", engagement: READ, startVerb: "Start", finishVerb: "Finish", lookup: "openlibrary" },
  { id: "movie", label: "Movie", plural: "Movies", creatorLabel: "Director", sizeUnit: "min", slotCount: 3, cover: "portrait", engagement: WATCH, startVerb: "Start", finishVerb: "Finish", lookup: null },
  { id: "series", label: "Series", plural: "Series", creatorLabel: "Creator", sizeUnit: "episodes", slotCount: 3, cover: "portrait", engagement: WATCH, startVerb: "Start", finishVerb: "Finish", lookup: null },
  { id: "music", label: "Album", plural: "Music", creatorLabel: "Artist", sizeUnit: "tracks", slotCount: 3, cover: "square", engagement: { UNSTARTED: "Unheard", IN_PROGRESS: "Listening", DONE: "Listened", ABANDONED: "Abandoned" }, startVerb: "Start", finishVerb: "Finish", lookup: null },
  { id: "game", label: "Game", plural: "Games", creatorLabel: "Developer", sizeUnit: "hours", slotCount: 2, cover: "portrait", engagement: { UNSTARTED: "Unplayed", IN_PROGRESS: "Playing", DONE: "Played", ABANDONED: "Abandoned" }, startVerb: "Start", finishVerb: "Finish", lookup: null },
];

export function mediaType(id: MediaTypeId): MediaTypeDef {
  return MEDIA_TYPES.find((t) => t.id === id) ?? MEDIA_TYPES[0];
}
