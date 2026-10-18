import { createPartsKit } from "@lifeline/parts";
import { normalize, patchWork } from "./data/repo";
import { finish, start } from "./domain/rules";
import type { Work } from "./domain/types";
import { workType } from "./domain/workTypes";
import { APP_HREF, APP_ID } from "./constants";

/**
 * The Cinema's Parts (ADR 0074): a series' Episodes and Seasons — its own two types.
 * Numbering restarts in each Group. The first one heard or watched starts the
 * work exactly as Start does; the last known one offers Done.
 */
export const cinemaParts = createPartsKit<Work>({
  appId: APP_ID,
  appTitle: "Cinema",
  partType: "cinema_part",
  groupType: "cinema_group",
  mediumOf: (w) => workType(w.type)?.parts ?? null,
  normalize,
  patchWork: (w, patch) => patchWork(w, patch),
  start: (w) => patchWork(w, start()),
  finish: (w) => patchWork(w, finish()),
  href: () => APP_HREF,
  order: 48,
});
