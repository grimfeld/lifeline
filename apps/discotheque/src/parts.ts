import { createPartsKit } from "@lifeline/parts";
import { normalize, patchWork } from "./data/repo";
import { finish, start } from "./domain/rules";
import type { Work } from "./domain/types";
import { workType } from "./domain/workTypes";
import { APP_HREF, APP_ID } from "./constants";

/**
 * The Discotheque's Parts (ADR 0067): an album's Tracks and Discs — its own two types.
 * Numbering restarts in each Group. The first one heard or watched starts the
 * work exactly as Start does; the last known one offers Done.
 */
export const discothequeParts = createPartsKit<Work>({
  appId: APP_ID,
  appTitle: "Discotheque",
  partType: "discotheque_part",
  groupType: "discotheque_group",
  mediumOf: (w) => workType(w.type)?.parts ?? null,
  normalize,
  patchWork: (w, patch) => patchWork(w, patch),
  start: (w) => patchWork(w, start()),
  finish: (w) => patchWork(w, finish()),
  href: () => APP_HREF,
  order: 49,
});
