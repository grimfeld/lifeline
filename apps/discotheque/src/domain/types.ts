import type { DateStr, Document } from "@lifeline/core";
import type { WorkTypeId } from "./workTypes";

/** The Shelf (CONTEXT.md): how far I have got through it. */
export const ENGAGEMENT = ["UNSTARTED", "IN_PROGRESS", "DONE", "ABANDONED"] as const;
export type Engagement = (typeof ENGAGEMENT)[number];

/**
 * An album (ADR 0024), owned by the Discotheque App. Streamed media have
 * **no Acquisition**; MusicBrainz is keyless, so there is no settings record
 * either. Days are "YYYY-MM-DD" text; "" means "not yet".
 */
export interface Work extends Document {
  type: WorkTypeId;
  creator: string;
  /** External work identity for dedupe, e.g. "musicbrainz:rg/…". "" = none. */
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
  /** Parts (ADR 0067): tracked at all, and the catch-up position. */
  partsTracked: boolean;
  caughtUpGroup: number;
  caughtUpPart: number;
}

export const RATING_MAX = 5;

/**
 * A Playlist (CONTEXT.md, ADR 0035): a named, ordered selection of albums I
 * curate by hand. Membership is the Playlist's — the ordered ids live here,
 * never on the album. The body is its blurb.
 */
export interface Playlist extends Document {
  type: typeof PLAYLIST;
  workIds: string[];
  /** Show the order as numbers. */
  ranked: boolean;
}

export const PLAYLIST = "discotheque_playlist";

export { WORK_TYPE_IDS } from "./workTypes";
