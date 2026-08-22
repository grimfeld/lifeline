import type { DateStr, Document } from "@lifeline/core";
import type { WorkTypeId } from "./workTypes";

/** The Shelf (CONTEXT.md): how far I have got through it. */
export const ENGAGEMENT = ["UNSTARTED", "IN_PROGRESS", "DONE", "ABANDONED"] as const;
export type Engagement = (typeof ENGAGEMENT)[number];

/**
 * A film or series (ADR 0024), owned by the Cinema App. Streamed media have
 * **no Acquisition** — you never own them, so there is no shopping list and
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
}

export { WORK_TYPE_IDS } from "./workTypes";

/** Lookup provider key (ADR 0024): the Cinema's own synced record, id "default". */
export interface LookupSettings extends Document {
  tmdbKey: string;
}

export const SETTINGS_TYPE = "cinema_settings";
export const SETTINGS_ID = "default";
