import type { DateStr } from "@lifeline/core";
import { MEDIA_TYPES, mediaType, type MediaTypeId } from "./mediaTypes";
import type { MediaItem } from "./types";

/** "" = any medium (the shared `medium` card knob). */
export type MediumFilter = MediaTypeId | "";

export const byMedium = (items: MediaItem[], medium: MediumFilter) => (medium ? items.filter((m) => m.type === medium) : items);

/** Human label for the medium knob: "" → "", "book" → "Books". */
export const mediumLabel = (medium: string): string => (medium ? mediaType(medium as MediaTypeId).plural : "");

/** "Base" or "Base · Books" — the instanceTitle convention shared by every media card. */
export const titleWithMedium = (base: string, medium: unknown) => (typeof medium === "string" && medium ? `${base} · ${mediumLabel(medium)}` : base);

/** Everything being read/watched/played right now, most recently started first. */
export function inProgress(items: MediaItem[], medium: MediumFilter = ""): MediaItem[] {
  return byMedium(items, medium)
    .filter((m) => m.engagement === "IN_PROGRESS")
    .sort((a, b) => b.startedOn.localeCompare(a.startedOn));
}

/** Done items finished in `year`, most recently finished first. */
export function finishedIn(items: MediaItem[], year: number, medium: MediumFilter = ""): MediaItem[] {
  const prefix = `${year}-`;
  return byMedium(items, medium)
    .filter((m) => m.engagement === "DONE" && m.finishedOn.startsWith(prefix))
    .sort((a, b) => b.finishedOn.localeCompare(a.finishedOn));
}

/** Backlog items I own (or borrowed) and have not started — the "Surprise me" pool. */
export function surprisePool(items: MediaItem[], medium: MediumFilter = ""): MediaItem[] {
  return byMedium(items, medium).filter(
    (m) => m.slot === 0 && m.engagement === "UNSTARTED" && (m.acquisition === "OWNED" || m.acquisition === "BORROWED"),
  );
}

/** The item a quote capture should default to: first in-progress of the medium (latest started), else the most recently added. */
export function defaultCaptureItem(items: MediaItem[], medium: MediumFilter = ""): MediaItem | undefined {
  const ofMedium = byMedium(items, medium);
  const going = inProgress(ofMedium);
  if (going[0]) return going[0];
  return [...ofMedium].sort((a, b) => b.addedOn.localeCompare(a.addedOn))[0];
}

/** Counts per medium, in registry order, omitting zeros. */
export function countByMedium(items: MediaItem[]): { type: MediaTypeId; count: number }[] {
  return MEDIA_TYPES.map((t) => ({ type: t.id, count: items.filter((m) => m.type === t.id).length })).filter((c) => c.count > 0);
}

/** "12 books · 5 movies". */
export function mediumBreakdown(items: MediaItem[]): string {
  return countByMedium(items)
    .map(({ type, count }) => {
      const def = mediaType(type);
      return `${count} ${(count === 1 ? def.label : def.plural).toLowerCase()}`;
    })
    .join(" · ");
}

/** A random index into `pool` different from `avoid` when the pool allows it. */
export function pickIndex(poolSize: number, avoid: number | null, rnd: () => number = Math.random): number {
  if (poolSize <= 0) return -1;
  if (poolSize === 1) return 0;
  let i = Math.floor(rnd() * poolSize);
  if (i === avoid) i = (i + 1 + Math.floor(rnd() * (poolSize - 1))) % poolSize;
  return i;
}

/** One Daylog line for a media item on a day: what happened, in the medium's words. */
export interface MediaDayFact {
  item: MediaItem;
  /** Verb-first: the medium's past-tense finish verb ("Read", "Watched"…), else "Started" / "Acquired" / "Added". */
  kind: string;
}

/**
 * The facts of one day, one line per item, most significant stamp wins:
 * finished > started > acquired > added. Finishing uses the medium's own
 * past-tense verb (registry `engagement.DONE`); the other verbs are neutral.
 */
export function daylogFacts(items: MediaItem[], day: DateStr): MediaDayFact[] {
  const out: MediaDayFact[] = [];
  for (const item of items) {
    if (item.finishedOn === day) out.push({ item, kind: mediaType(item.type).engagement.DONE });
    else if (item.startedOn === day) out.push({ item, kind: "Started" });
    else if (item.acquiredOn === day) out.push({ item, kind: "Acquired" });
    else if (item.addedOn === day) out.push({ item, kind: "Added" });
  }
  return out;
}
