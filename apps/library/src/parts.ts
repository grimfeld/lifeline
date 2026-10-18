import { createPartsKit } from "@lifeline/parts";
import { normalize, patchWork } from "./data/repo";
import { finish, start } from "./domain/rules";
import type { Work } from "./domain/types";
import { workType } from "./domain/workTypes";
import { APP_HREF, APP_ID } from "./constants";

/**
 * The Library's Parts (ADR 0067): a book's Chapters, a comic's Issues, a
 * manga's Chapters, and their Sections and Volumes — the Library's own two
 * types. The first one read starts the work exactly as Start does; the last
 * known one offers Done.
 */
export const libraryParts = createPartsKit<Work>({
  appId: APP_ID,
  appTitle: "Library",
  partType: "library_part",
  groupType: "library_group",
  mediumOf: (w) => workType(w.type)?.parts ?? null,
  normalize,
  patchWork: (w, patch) => patchWork(w, patch),
  start: (w) => patchWork(w, start()),
  finish: (w) => patchWork(w, finish()),
  href: () => APP_HREF,
  order: 44,
});
