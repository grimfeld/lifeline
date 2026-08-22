/**
 * The Discotheque's registry (ADR 0024): albums. One entry — no medium knob
 * anywhere in the UI; the registry shape stays so divergence is one edit away.
 */
export type WorkTypeId = "music";

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

export const WORK_TYPES: WorkTypeDef[] = [
  { id: "music", label: "Album", plural: "Albums", creatorLabel: "Artist", sizeUnit: "tracks", cover: "square", engagement: { UNSTARTED: "Unheard", IN_PROGRESS: "Listening", DONE: "Listened", ABANDONED: "Abandoned" }, startVerb: "Start", finishVerb: "Finish", wantLabel: "To listen" },
];

export const WORK_TYPE_IDS: WorkTypeId[] = WORK_TYPES.map((t) => t.id);

export function workType(id: WorkTypeId): WorkTypeDef {
  const def = WORK_TYPES.find((t) => t.id === id);
  if (!def) throw new Error(`Unknown work type: ${id}`);
  return def;
}
