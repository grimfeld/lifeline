import type { DateStr, Document } from "@lifeline/core";
import type { WorkTypeId } from "./workTypes";

/** Whether and how I have access to a copy. Independent of the Shelf. */
export const ACQUISITION = ["WANTED", "OWNED", "BORROWED", "GONE"] as const;
export type Acquisition = (typeof ACQUISITION)[number];

/** The Shelf (CONTEXT.md): how far I have got through it. */
export const ENGAGEMENT = ["UNSTARTED", "IN_PROGRESS", "DONE", "ABANDONED"] as const;
export type Engagement = (typeof ENGAGEMENT)[number];

/**
 * A work of the reading family (ADR 0024): a book or comic (not an edition),
 * owned by the Library App. Keeps both axes — the Shelf and Acquisition
 * (books are owned, unlike streamed media) — plus the Nightstand slot.
 * Days are "YYYY-MM-DD" text; "" means "not yet"; `slot` 0 = not slotted.
 */
export interface Work extends Document {
  /** The Document type IS the medium. */
  type: WorkTypeId;
  creator: string;
  /** External work identity for dedupe, e.g. "openlibrary:/works/OL27448W". "" = none. */
  externalKey: string;
  coverUrl: string;
  size: number;
  year: number;
  acquisition: Acquisition;
  engagement: Engagement;
  /** Who recommended it / what made me want it. Optional, captured at add time. */
  reason: string;
  /** 1..cap when on the Nightstand of its type; 0 = not slotted. */
  slot: number;
  addedOn: DateStr;
  acquiredOn: DateStr;
  slottedOn: DateStr;
  startedOn: DateStr;
  finishedOn: DateStr;
}

export { WORK_TYPE_IDS } from "./workTypes";

/** Lookup provider keys (ADR 0024): the Library's own synced record, id "default". */
export interface LookupSettings extends Document {
  comicvineKey: string;
  googleBooksKey: string;
}

export const SETTINGS_TYPE = "library_settings";
