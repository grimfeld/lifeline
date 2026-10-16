import type { Document } from "@lifeline/core";
import { SOURCE, SOURCE_KINDS, sourceKindLabel } from "./types";

/**
 * The works every family App owns (ADR 0024). They play the Source Role by
 * construction (ADR 0070): every book, film and album is somewhere to take
 * Notes and Quotes from, without putting anything on. Reading them is always
 * allowed; every Note and Quote operation is this App's.
 */
export const WORK_TYPE_IDS = ["book", "comic", "movie", "series", "music", "game"] as const;
export type WorkTypeId = (typeof WORK_TYPE_IDS)[number];

export const WORK_LABELS: Record<WorkTypeId, { label: string; plural: string; cover: "portrait" | "square" }> = {
  book: { label: "Book", plural: "Books", cover: "portrait" },
  comic: { label: "Comic", plural: "Comics", cover: "portrait" },
  movie: { label: "Movie", plural: "Movies", cover: "portrait" },
  series: { label: "Series", plural: "Series", cover: "portrait" },
  music: { label: "Album", plural: "Albums", cover: "square" },
  game: { label: "Game", plural: "Games", cover: "portrait" },
};

export const isWorkType = (t: string): t is WorkTypeId => (WORK_TYPE_IDS as readonly string[]).includes(t);

/**
 * A Source as this App reads it, whatever its type: a work, one of the App's
 * own Sources (an article, a podcast), or a Document wearing the Role (a
 * Person I heard speak). `family` is what the shelf groups it under.
 */
export interface SourceItem extends Document {
  creator: string;
  coverUrl: string;
  family: string;
  engagement?: string;
  startedOn?: string;
  addedOn?: string;
  url?: string;
  parent?: string;
}

/** The shelf's family for a Source: a work's type, an own Source's kind, else the wearer's own type id. */
export function familyOfDoc(doc: Pick<Document, "type"> & { kind?: unknown }): string {
  if (isWorkType(doc.type)) return doc.type;
  if (doc.type === SOURCE) return typeof doc.kind === "string" && doc.kind ? doc.kind : "other";
  return doc.type;
}

/** Every family the shelf knows in its order: works first, then the App's own kinds. Wearers' types follow, by name. */
export const KNOWN_FAMILIES: { value: string; label: string; plural: string }[] = [
  ...WORK_TYPE_IDS.map((t) => ({ value: t, label: WORK_LABELS[t].label, plural: WORK_LABELS[t].plural })),
  ...SOURCE_KINDS.map((k) => ({ value: k.value as string, label: k.label as string, plural: k.plural as string })),
];

export function familyLabel(family: string, plural = false, typeLabel?: (id: string) => string | undefined): string {
  const known = KNOWN_FAMILIES.find((f) => f.value === family);
  if (known) return plural ? known.plural : known.label;
  return sourceKindLabel(family) ?? typeLabel?.(family) ?? family;
}

/** "" = any family (the card knob). */
export type WorkFilter = string;

export const byType = (items: SourceItem[], family: WorkFilter) => (family ? items.filter((m) => m.family === family) : items);

/**
 * The Source a capture should default to: the latest-started work in
 * progress (what I'm reading, watching, listening to now), else the Source
 * last noted or quoted from, else the most recently added.
 */
export function defaultCaptureItem(items: SourceItem[], family: WorkFilter = "", lastUsed: ReadonlyMap<string, string> = new Map()): SourceItem | undefined {
  return currentSources(byType(items, family), lastUsed)[0];
}

/**
 * "The Sources I'm in now", in order (ADR 0070's capture): works in progress
 * by when they started, then Sources by when I last took something from
 * them, then the rest by when they were added. What a phone capture offers
 * first, so a required Source costs one tap.
 */
export function currentSources(items: SourceItem[], lastUsed: ReadonlyMap<string, string> = new Map()): SourceItem[] {
  const going = items.filter((m) => m.engagement === "IN_PROGRESS").sort((a, b) => (b.startedOn ?? "").localeCompare(a.startedOn ?? ""));
  const rest = items.filter((m) => m.engagement !== "IN_PROGRESS");
  const used = rest.filter((m) => lastUsed.has(m.id)).sort((a, b) => lastUsed.get(b.id)!.localeCompare(lastUsed.get(a.id)!));
  const unused = rest.filter((m) => !lastUsed.has(m.id)).sort((a, b) => (b.addedOn ?? b.createdAt).localeCompare(a.addedOn ?? a.createdAt));
  return [...going, ...used, ...unused];
}

/** A random index into `pool` different from `avoid` when the pool allows it. */
export function pickIndex(poolSize: number, avoid: number | null, rnd: () => number = Math.random): number {
  if (poolSize <= 0) return -1;
  if (poolSize === 1) return 0;
  let i = Math.floor(rnd() * poolSize);
  if (i === avoid) i = (i + 1 + Math.floor(rnd() * (poolSize - 1))) % poolSize;
  return i;
}
