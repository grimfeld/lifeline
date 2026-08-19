import { db, normalizeTags, put, remove, newId, todayStr, useLiveQuery } from "@lifeline/core";
import { MEDIA, type Acquisition, type MediaItem } from "../domain/types";
import type { MediaTypeId } from "../domain/mediaTypes";
import type { Patch } from "../domain/rules";
import { deleteQuotesOf } from "./quotes";

function normalize(m: MediaItem): MediaItem {
  return {
    ...m,
    creator: m.creator ?? "",
    externalKey: m.externalKey ?? "",
    coverUrl: m.coverUrl ?? "",
    size: m.size || 0,
    year: m.year || 0,
    reason: m.reason ?? "",
    slot: m.slot || 0,
    studied: !!m.studied,
    acquiredOn: m.acquiredOn ?? "",
    slottedOn: m.slottedOn ?? "",
    startedOn: m.startedOn ?? "",
    finishedOn: m.finishedOn ?? "",
    tags: m.tags ?? [],
  };
}

export function useMedia(): MediaItem[] {
  return useLiveQuery(
    async () => (await db().collection<MediaItem>(MEDIA).where("deleted").equals(0).toArray()).map(normalize),
    [],
    [] as MediaItem[],
  );
}

export async function addMedia(input: {
  type: MediaTypeId;
  title: string;
  creator?: string;
  externalKey?: string;
  coverUrl?: string;
  size?: number;
  year?: number;
  acquisition: Acquisition;
  reason: string;
  tags?: string[];
}): Promise<string> {
  const id = newId();
  const today = todayStr();
  await put<MediaItem>(MEDIA, {
    id,
    type: input.type,
    title: input.title.trim(),
    creator: input.creator?.trim() ?? "",
    externalKey: input.externalKey ?? "",
    coverUrl: input.coverUrl ?? "",
    size: input.size || 0,
    year: input.year || 0,
    acquisition: input.acquisition,
    engagement: "UNSTARTED",
    studied: false,
    reason: input.reason.trim(),
    slot: 0,
    addedOn: today,
    acquiredOn: input.acquisition === "OWNED" || input.acquisition === "BORROWED" ? today : "",
    slottedOn: "",
    startedOn: "",
    finishedOn: "",
    tags: normalizeTags(input.tags),
  });
  return id;
}

/** Apply a transition patch (or an edit) to an item. */
export async function patchMedia(item: MediaItem, patch: Patch): Promise<void> {
  const next = { ...item, ...patch };
  await put<MediaItem>(MEDIA, { ...next, tags: normalizeTags(next.tags) });
}

export async function deleteMedia(id: string): Promise<void> {
  await remove(MEDIA, id);
  // A Quote cannot outlive its item (CONTEXT.md).
  await deleteQuotesOf(id);
}

/** Existing item with the same external identity, if any ("do I already own this?"). */
export function findByExternalKey(items: MediaItem[], key: string): MediaItem | undefined {
  return key ? items.find((m) => m.externalKey === key) : undefined;
}

/**
 * Quick add (ADR 0006 amendment): title, optional creator, medium — straight
 * onto the To… shelf, nothing else asked. Optional lookup hit attaches
 * cover/year/external key. Returns the id (for Undo).
 */
export async function quickAddMedia(input: { type: MediaTypeId; title: string; creator?: string; hit?: { externalKey: string; coverUrl: string; year: number; size: number; creator: string } }): Promise<string> {
  return addMedia({
    type: input.type,
    title: input.title,
    creator: input.creator || input.hit?.creator || "",
    externalKey: input.hit?.externalKey ?? "",
    coverUrl: input.hit?.coverUrl ?? "",
    year: input.hit?.year ?? 0,
    size: input.hit?.size ?? 0,
    acquisition: "WANTED",
    reason: "",
  });
}

/** Parse "Title — Creator" / "Title - Creator" / "Title by Creator" typed in a quick-add box. */
export function parseQuickTitle(raw: string): { title: string; creator: string } {
  const t = raw.trim();
  const m = /^(.*?)\s+(?:—|–|-|by)\s+(.+)$/.exec(t);
  if (m && m[1].trim() && m[2].trim()) return { title: m[1].trim(), creator: m[2].trim() };
  return { title: t, creator: "" };
}
