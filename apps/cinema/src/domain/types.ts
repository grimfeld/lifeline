import type { DateStr, Document } from "@lifeline/core";
import type { WorkTypeId } from "./workTypes";

/** The Shelf (CONTEXT.md): how far I have got through it. */
export const ENGAGEMENT = ["UNSTARTED", "IN_PROGRESS", "DONE", "ABANDONED"] as const;
export type Engagement = (typeof ENGAGEMENT)[number];

/**
 * A film or series (ADR 0024), owned by the Cinema App. Streamed media have
 * **no Acquisition** — you never own them, so there is no Wanted list and
 * no acquired day. Days are "YYYY-MM-DD" text; "" means "not yet".
 */
export interface Work extends Document {
  /** The Document type IS the medium. */
  type: WorkTypeId;
  creator: string;
  /** External work identity for dedupe, e.g. "tmdb:movie/949". "" = none. */
  externalKey: string;
  coverUrl: string;
  size: number;
  year: number;
  engagement: Engagement;
  /** Who recommended it / what made me want it. Optional, captured at add time. */
  reason: string;
  addedOn: DateStr;
  startedOn: DateStr;
  finishedOn: DateStr;
  /** Marks (ADR 0035): the heart, on or off. */
  liked: boolean;
  /** Marks: whole stars 1–RATING_MAX; 0 = unrated (its own state). */
  rating: number;
  /** The Review (ADR 0035) is the Document body — my own words about it. */
  body?: string;
}

export const RATING_MAX = 5;

/**
 * A Playlist (CONTEXT.md, ADR 0035): a named, ordered selection of works I
 * curate by hand. Membership is the Playlist's — the ordered ids live here,
 * never on the work. The body is its blurb.
 */
export interface Playlist extends Document {
  type: typeof PLAYLIST;
  workIds: string[];
  /** Show the order as numbers. */
  ranked: boolean;
}

export const PLAYLIST = "cinema_playlist";

export { WORK_TYPE_IDS } from "./workTypes";

/** Lookup provider key (ADR 0024): the Cinema's own synced record, id "default". */
export interface LookupSettings extends Document {
  tmdbKey: string;
}

export const SETTINGS_TYPE = "cinema_settings";
