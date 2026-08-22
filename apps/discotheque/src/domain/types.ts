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
}

export { WORK_TYPE_IDS } from "./workTypes";
