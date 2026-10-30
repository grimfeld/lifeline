import type { DateStr, Document } from "@lifeline/core";
import type { WorkTypeId } from "./workTypes";

/** Whether and how I have access to a copy. Independent of the Shelf — games are bought, unlike streamed media. */
export const ACQUISITION = ["WANTED", "OWNED", "BORROWED", "GONE"] as const;
export type Acquisition = (typeof ACQUISITION)[number];
export const ACQ_LABEL: Record<Acquisition, string> = { WANTED: "Wanted", OWNED: "Owned", BORROWED: "Borrowed", GONE: "Gone" };

/** The Shelf (CONTEXT.md): how far I have got through it. */
export const ENGAGEMENT = ["UNSTARTED", "IN_PROGRESS", "DONE", "ABANDONED"] as const;
export type Engagement = (typeof ENGAGEMENT)[number];

/**
 * A game (ADR 0024), owned by the Arcade App. Keeps Acquisition and the
 * Wanted list; has no Nightstand slots. Days are "YYYY-MM-DD" text; ""
 * means "not yet".
 */
export interface Work extends Document {
  type: WorkTypeId;
  creator: string;
  /** External work identity for dedupe, e.g. "rawg:3498". "" = none. */
  externalKey: string;
  coverUrl: string;
  size: number;
  year: number;
  acquisition: Acquisition;
  engagement: Engagement;
  /** Who recommended it / what made me want it. Optional, captured at add time. */
  reason: string;
  addedOn: DateStr;
  acquiredOn: DateStr;
  startedOn: DateStr;
  finishedOn: DateStr;
}

export { WORK_TYPE_IDS } from "./workTypes";

/** Lookup provider key (ADR 0024): the Arcade's own synced record, id "default". */
export interface LookupSettings extends Document {
  rawgKey: string;
}

export const SETTINGS_TYPE = "arcade_settings";
