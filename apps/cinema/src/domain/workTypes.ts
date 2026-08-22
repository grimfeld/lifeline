/**
 * The Cinema's registry (ADR 0024): movies and series — the watching family.
 * The Document `type` IS the medium; the registry supplies what differs.
 */
export type WorkTypeId = "movie" | "series";

export interface WorkTypeDef {
  id: WorkTypeId;
  label: string;
  plural: string;
  creatorLabel: string;
  sizeUnit: string;
  cover: "portrait" | "square";
  engagement: Record<"UNSTARTED" | "IN_PROGRESS" | "DONE" | "ABANDONED", string>;
  startVerb: string;
  finishVerb: string;
  wantLabel: string;
}

const WATCH = { UNSTARTED: "Unwatched", IN_PROGRESS: "Watching", DONE: "Watched", ABANDONED: "Abandoned" };

export const WORK_TYPES: WorkTypeDef[] = [
  { id: "movie", label: "Movie", plural: "Movies", creatorLabel: "Director", sizeUnit: "min", cover: "portrait", engagement: WATCH, startVerb: "Start", finishVerb: "Finish", wantLabel: "To watch" },
  { id: "series", label: "Series", plural: "Series", creatorLabel: "Creator", sizeUnit: "episodes", cover: "portrait", engagement: WATCH, startVerb: "Start", finishVerb: "Finish", wantLabel: "To watch" },
];

export const WORK_TYPE_IDS: WorkTypeId[] = WORK_TYPES.map((t) => t.id);

export function workType(id: WorkTypeId): WorkTypeDef {
  const def = WORK_TYPES.find((t) => t.id === id);
  if (!def) throw new Error(`Unknown work type: ${id}`);
  return def;
}
