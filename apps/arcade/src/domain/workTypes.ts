/**
 * The Arcade's registry (ADR 0024): games. One entry — the registry shape
 * stays so per-family divergence is one edit away, but there is no medium
 * knob anywhere in the UI.
 */
export type WorkTypeId = "game";

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
  { id: "game", label: "Game", plural: "Games", creatorLabel: "Developer", sizeUnit: "hours", cover: "portrait", engagement: { UNSTARTED: "Unplayed", IN_PROGRESS: "Playing", DONE: "Played", ABANDONED: "Abandoned" }, startVerb: "Start", finishVerb: "Finish", wantLabel: "To play" },
];

export const WORK_TYPE_IDS: WorkTypeId[] = WORK_TYPES.map((t) => t.id);

export function workType(id: WorkTypeId): WorkTypeDef {
  const def = WORK_TYPES.find((t) => t.id === id);
  if (!def) throw new Error(`Unknown work type: ${id}`);
  return def;
}
