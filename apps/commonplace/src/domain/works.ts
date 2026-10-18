import type { Document } from "@lifeline/core";

/**
 * The Quotes App quotes works of *any* family (ADR 0024): it reads the
 * family Apps' Documents — reading is always allowed; every Quote operation
 * is a Quote operation, owned here. This registry only names what a quote
 * can come from and how to draw its cover.
 */
export const WORK_TYPE_IDS = ["book", "comic", "manga", "movie", "series", "music", "game"] as const;
export type WorkTypeId = (typeof WORK_TYPE_IDS)[number];

export const WORK_LABELS: Record<WorkTypeId, { label: string; plural: string; cover: "portrait" | "square" }> = {
  book: { label: "Book", plural: "Books", cover: "portrait" },
  comic: { label: "Comic", plural: "Comics", cover: "portrait" },
  manga: { label: "Manga", plural: "Manga", cover: "portrait" },
  movie: { label: "Movie", plural: "Movies", cover: "portrait" },
  series: { label: "Series", plural: "Series", cover: "portrait" },
  music: { label: "Album", plural: "Albums", cover: "square" },
  game: { label: "Game", plural: "Games", cover: "portrait" },
};

export const isWorkType = (t: string): t is WorkTypeId => (WORK_TYPE_IDS as readonly string[]).includes(t);

/** A quotable work, as this App reads it — the fields every family type shares. */
export interface QuotedWork extends Document {
  type: WorkTypeId;
  creator: string;
  coverUrl: string;
  engagement?: string;
  startedOn?: string;
  addedOn?: string;
}

/** "" = any family (the card knob). */
export type WorkFilter = WorkTypeId | "";

export const byType = (items: QuotedWork[], type: WorkFilter) => (type ? items.filter((m) => m.type === type) : items);

/** The work a capture should default to: latest-started in-progress, else the most recently added. */
export function defaultCaptureItem(items: QuotedWork[], type: WorkFilter = ""): QuotedWork | undefined {
  const ofType = byType(items, type);
  const going = ofType.filter((m) => m.engagement === "IN_PROGRESS").sort((a, b) => (b.startedOn ?? "").localeCompare(a.startedOn ?? ""));
  if (going[0]) return going[0];
  return [...ofType].sort((a, b) => (b.addedOn ?? "").localeCompare(a.addedOn ?? ""))[0];
}

/** A random index into `pool` different from `avoid` when the pool allows it. */
export function pickIndex(poolSize: number, avoid: number | null, rnd: () => number = Math.random): number {
  if (poolSize <= 0) return -1;
  if (poolSize === 1) return 0;
  let i = Math.floor(rnd() * poolSize);
  if (i === avoid) i = (i + 1 + Math.floor(rnd() * (poolSize - 1))) % poolSize;
  return i;
}
