import type { PartsMedium } from "@lifeline/parts";

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
  /** How its Parts and Groups are spoken of (ADR 0074); null = it never has Parts. */
  parts: PartsMedium | null;
}

/** An album's Tracks restart on each Disc (ADR 0074): "Disc 2 · Track 4". */
const TRACKS: PartsMedium = { numbering: "restart", part: "Track", parts: "tracks", group: "Disc", groups: "discs", verb: "Heard" };

export const WORK_TYPES: WorkTypeDef[] = [
  { id: "music", label: "Album", plural: "Albums", creatorLabel: "Artist", sizeUnit: "tracks", cover: "square", engagement: { UNSTARTED: "Unheard", IN_PROGRESS: "Listening", DONE: "Listened", ABANDONED: "Abandoned" }, startVerb: "Start", finishVerb: "Finish", wantLabel: "To listen", parts: TRACKS },
];

export const WORK_TYPE_IDS: WorkTypeId[] = WORK_TYPES.map((t) => t.id);

export function workType(id: WorkTypeId): WorkTypeDef {
  const def = WORK_TYPES.find((t) => t.id === id);
  if (!def) throw new Error(`Unknown work type: ${id}`);
  return def;
}
