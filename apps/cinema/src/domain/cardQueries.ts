import { shelfQueries } from "@lifeline/parts";
import { WORK_TYPES, type WorkTypeId } from "./workTypes";
import type { Work } from "./types";

/** "" = any medium (the shared `medium` card knob). */
export type MediumFilter = WorkTypeId | "";

export { pickIndex } from "@lifeline/parts";

/** The shared Card queries (packages/parts) over this App's registry. */
export const { byMedium, titleWithMedium, inProgress, finishedIn, surprisePool, defaultCaptureItem, countByMedium, mediumBreakdown, shelfLabel, daylogFacts } = shelfQueries<WorkTypeId, Work>(WORK_TYPES);
