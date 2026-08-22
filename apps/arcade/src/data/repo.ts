import { useMemo } from "react";
import { documentsOf, getDocument, normalizeTags, putDocument, removeDocument, todayStr, useDocument, useLiveQuery } from "@lifeline/core";
import { SETTINGS_TYPE, SETTINGS_ID, WORK_TYPE_IDS, type Acquisition, type Work, type LookupSettings } from "../domain/types";
import type { WorkTypeId } from "../domain/workTypes";
import type { Patch } from "../domain/rules";

/**
 * PocketBase stores absent text/number fields as ""/0 and hands them back
 * that way, so every read re-establishes the domain's defaults.
 */
export function normalize(m: Work): Work {
  return {
    ...m,
    creator: m.creator ?? "",
    externalKey: m.externalKey ?? "",
    coverUrl: m.coverUrl ?? "",
    size: m.size || 0,
    year: m.year || 0,
    reason: m.reason ?? "",
    acquiredOn: m.acquiredOn ?? "",
    startedOn: m.startedOn ?? "",
    finishedOn: m.finishedOn ?? "",
    tags: m.tags ?? [],
  };
}

/** Every media item, across all six medium types (one query per type, flattened). */
export function useWorks(): Work[] {
  const rows = useLiveQuery(
    async () => (await Promise.all(WORK_TYPE_IDS.map((t) => documentsOf<Work>(t)))).flat(),
    [],
    [] as Work[],
  );
  return useMemo(() => rows.map(normalize), [rows]);
}

export function useMediaItem(id: string | undefined): Work | undefined {
  const row = useDocument<Work>(id);
  return useMemo(() => (row ? normalize(row) : undefined), [row]);
}

export async function addWork(input: {
  medium: WorkTypeId;
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
  const today = todayStr();
  const row = await putDocument<Work>({
    type: input.medium,
    title: input.title.trim(),
    creator: input.creator?.trim() ?? "",
    externalKey: input.externalKey ?? "",
    coverUrl: input.coverUrl ?? "",
    size: input.size || 0,
    year: input.year || 0,
    acquisition: input.acquisition,
    engagement: "UNSTARTED",
    reason: input.reason.trim(),
    addedOn: today,
    acquiredOn: input.acquisition === "OWNED" || input.acquisition === "BORROWED" ? today : "",
    startedOn: "",
    finishedOn: "",
    tags: normalizeTags(input.tags),
  });
  return row.id;
}

/** Apply a transition patch (or an edit) to an item. */
export async function patchWork(item: Work, patch: Patch): Promise<void> {
  const next = { ...item, ...patch };
  await putDocument<Work>({ ...next, tags: normalizeTags(next.tags) });
}

export async function deleteWork(id: string): Promise<void> {
  await removeDocument(id);
}

/** Existing item with the same external identity, if any ("do I already own this?"). */
export function findByExternalKey(items: Work[], key: string): Work | undefined {
  return key ? items.find((m) => m.externalKey === key) : undefined;
}

/**
 * Quick add (ADR 0006 amendment): title, optional creator, medium — straight
 * onto the To… shelf, nothing else asked. Optional lookup hit attaches
 * cover/year/external key. Returns the id (for Undo).
 */
export async function quickAddWork(input: { medium: WorkTypeId; title: string; creator?: string; hit?: { externalKey: string; coverUrl: string; year: number; size: number; creator: string } }): Promise<string> {
  return addWork({
    medium: input.medium,
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

/* ---------- Lookup settings (one internal Document, id "default") ---------- */

const EMPTY_SETTINGS: LookupSettings = {
  id: SETTINGS_ID, type: SETTINGS_TYPE, title: "Arcade lookup settings", tags: [], folder: "", createdAt: "",
  rawgKey: "", updatedAt: "", deleted: 0,
};

function normalizeSettings(s: Partial<LookupSettings> | undefined): LookupSettings {
  return { ...EMPTY_SETTINGS, ...(s ?? {}), rawgKey: s?.rawgKey ?? "" };
}

/**
 * One-time seed from the retired Media App's `media_settings` record
 * (ADR 0024): copy this App's keys the first time it finds none of its own.
 */
let seeded = false;
async function seedFromMediaSettings(): Promise<void> {
  if (seeded) return;
  seeded = true;
  const own = await getDocument<LookupSettings>(SETTINGS_ID);
  if (own && (own.type === SETTINGS_TYPE)) return;
  const old = await getDocument<{ rawgKey?: string; type?: string } & LookupSettings>("default");
  const legacy = old?.type === "media_settings" ? old : undefined;
  if (!legacy?.rawgKey) return;
  await putDocument<LookupSettings>({ ...EMPTY_SETTINGS, id: SETTINGS_ID, rawgKey: legacy.rawgKey ?? "" });
}

/** The lookup settings record (empty keys until saved). */
export function useLookupSettings(): LookupSettings {
  const row = useLiveQuery(async () => {
    await seedFromMediaSettings();
    const r = await getDocument<LookupSettings>(SETTINGS_ID);
    return r && r.type === SETTINGS_TYPE ? r : undefined;
  }, [], undefined as LookupSettings | undefined);
  // Stable identity between live-query results: effects depend on it.
  return useMemo(() => normalizeSettings(row), [row]);
}

export async function saveLookupSettings(patch: Partial<Omit<LookupSettings, "id" | "updatedAt" | "deleted">>): Promise<void> {
  const cur = normalizeSettings(await getDocument<LookupSettings>(SETTINGS_ID));
  const trimmed = Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]));
  await putDocument<LookupSettings>({ ...cur, ...trimmed, id: SETTINGS_ID, type: SETTINGS_TYPE });
}
