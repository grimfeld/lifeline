import { db, put, remove, newId, todayStr, useLiveQuery } from "@lifeline/core";
import { MEDIA, type Acquisition, type MediaItem } from "../domain/types";
import type { MediaTypeId } from "../domain/mediaTypes";
import type { Patch } from "../domain/rules";

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
  });
  return id;
}

/** Apply a transition patch (or an edit) to an item. */
export async function patchMedia(item: MediaItem, patch: Patch): Promise<void> {
  await put<MediaItem>(MEDIA, { ...item, ...patch });
}

export async function deleteMedia(id: string): Promise<void> {
  await remove(MEDIA, id);
}

/** Existing item with the same external identity, if any ("do I already own this?"). */
export function findByExternalKey(items: MediaItem[], key: string): MediaItem | undefined {
  return key ? items.find((m) => m.externalKey === key) : undefined;
}
