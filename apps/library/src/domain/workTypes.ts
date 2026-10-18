import type { PartsMedium } from "@lifeline/parts";

/**
 * The Library's registry (ADR 0024, 0067): books, comics and manga — the reading family.
 * The Document `type` IS the medium (ADR 0019 amendment); the registry
 * supplies the labels that differ between the two.
 */
export type WorkTypeId = "book" | "comic" | "manga";

export interface WorkTypeDef {
  id: WorkTypeId;
  label: string;
  plural: string;
  creatorLabel: string;
  sizeUnit: string;
  /** Nightstand slot cap (ADR 0006): the attention budget for this medium. */
  slotCount: number;
  cover: "portrait" | "square";
  engagement: Record<"UNSTARTED" | "IN_PROGRESS" | "DONE" | "ABANDONED", string>;
  startVerb: string;
  finishVerb: string;
  wantLabel: string;
  /** How its Parts and Groups are spoken of (ADR 0067). Every reading medium runs on across its Groups. */
  parts: PartsMedium;
}

const READ = { UNSTARTED: "Unread", IN_PROGRESS: "Reading", DONE: "Read", ABANDONED: "Abandoned" };

const parts = (part: string, group: string, sizeKey: PartsMedium["sizeKey"] = "size"): PartsMedium => ({ numbering: "runOn", part, parts: `${part.toLowerCase()}s`, group, groups: `${group.toLowerCase()}s`, verb: "Read", sizeKey });

export const WORK_TYPES: WorkTypeDef[] = [
  { id: "book", label: "Book", plural: "Books", creatorLabel: "Authors", sizeUnit: "pages", slotCount: 5, cover: "portrait", engagement: READ, startVerb: "Start", finishVerb: "Finish", wantLabel: "To read", parts: parts("Chapter", "Section", "partCount") },
  { id: "comic", label: "Comic", plural: "Comics", creatorLabel: "Authors", sizeUnit: "issues", slotCount: 3, cover: "portrait", engagement: READ, startVerb: "Start", finishVerb: "Finish", wantLabel: "To read", parts: parts("Issue", "Volume") },
  { id: "manga", label: "Manga", plural: "Manga", creatorLabel: "Authors", sizeUnit: "chapters", slotCount: 3, cover: "portrait", engagement: READ, startVerb: "Start", finishVerb: "Finish", wantLabel: "To read", parts: parts("Chapter", "Volume") },
];

export const WORK_TYPE_IDS: WorkTypeId[] = WORK_TYPES.map((t) => t.id);
export const SLOTTED_TYPES: WorkTypeId[] = WORK_TYPES.filter((t) => t.slotCount > 0).map((t) => t.id);

export function workType(id: WorkTypeId): WorkTypeDef {
  const def = WORK_TYPES.find((t) => t.id === id);
  if (!def) throw new Error(`Unknown work type: ${id}`);
  return def;
}

export const hasSlots = (id: WorkTypeId) => workType(id).slotCount > 0;
