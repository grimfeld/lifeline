import type { DateStr, SyncedRecord } from "@lifeline/core";
import type { MediaTypeId } from "./mediaTypes";

/** Whether and how I have access to a copy. Independent of Engagement. */
export const ACQUISITION = ["WANTED", "OWNED", "BORROWED", "GONE"] as const;
export type Acquisition = (typeof ACQUISITION)[number];

/**
 * How far I have got through it. Independent of Acquisition. Medium-neutral
 * states; each media type supplies its own verbs (read/watched/played…).
 */
export const ENGAGEMENT = ["UNSTARTED", "IN_PROGRESS", "DONE", "ABANDONED"] as const;
export type Engagement = (typeof ENGAGEMENT)[number];

/**
 * A work (not an edition) of any medium: book, comic, movie, series, album,
 * game… Ported from Nightstand/readlist and generalised: the two axes,
 * Studied, Reason, Slot and the auto-stamped days are medium-neutral; the
 * medium decides labels, creator wording, size unit and slot cap.
 *
 * Days are "YYYY-MM-DD" text; "" (or null) means "not yet". `slot` 0 = not on
 * the Nightstand (PocketBase coerces empty numbers to 0).
 */
export interface MediaItem extends SyncedRecord {
  type: MediaTypeId;
  title: string;
  /** Author / director / artist / developer — one free-text credit line. */
  creator: string;
  /** External work identity for dedupe, e.g. "openlibrary:/works/OL27448W". "" = none. */
  externalKey: string;
  coverUrl: string;
  /** Size in the type's unit (pages, minutes, episodes, tracks, hours). 0 = unknown. */
  size: number;
  year: number;
  acquisition: Acquisition;
  engagement: Engagement;
  studied: boolean;
  /** Who recommended it / what made me want it. Captured once, at add time. */
  reason: string;
  /** 1..cap when on the Nightstand of its type; 0 = Backlog. */
  slot: number;
  addedOn: DateStr;
  acquiredOn: DateStr;
  slottedOn: DateStr;
  startedOn: DateStr;
  finishedOn: DateStr;
  /** Normalised Tags (ADR 0014). May be undefined on old records — read with `?? []`. */
  tags?: string[];
}

export const MEDIA = "media";

/**
 * A Quote (CONTEXT.md): a passage kept from a Media item. Owned by the Media
 * App; tombstoned with its item. `locator` is free text (page, chapter, time).
 */
export interface Quote extends SyncedRecord {
  mediaId: string;
  text: string;
  locator: string;
  comment: string;
  capturedOn: DateStr;
  tags?: string[];
}

export const QUOTES = "media_quotes";
