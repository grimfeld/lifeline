import { useMemo } from "react";
import { documentsOf, normalizeTags, patchDocument, putDocument, removeDocument, useDocuments, type CardOption } from "@lifeline/core";
import { PROVISION, STORAGE, STORAGE_KINDS, type Provision, type Storage, type StorageKind } from "../domain/types";
import { clampQty, matchByTitle, sortStorages } from "../domain/rules";

/**
 * PocketBase stores absent fields as "" / 0 and hands them back that way,
 * so every read re-establishes the domain's defaults.
 */
export function normalizeProvision(p: Provision): Provision {
  return {
    ...p,
    storageId: p.storageId ?? "",
    quantity: clampQty(Number(p.quantity) || 0),
    unit: p.unit ?? "",
    minimum: clampQty(Number(p.minimum) || 0),
    expires: p.expires ?? "",
    frozenOn: p.frozenOn ?? "",
    tags: p.tags ?? [],
  };
}

export function normalizeStorage(s: Storage): Storage {
  const kind = (STORAGE_KINDS as readonly string[]).includes(s.kind) ? s.kind : "shelf";
  return { ...s, kind: kind as StorageKind, tags: s.tags ?? [] };
}

export function useProvisions(): Provision[] {
  const rows = useDocuments<Provision>(PROVISION);
  return useMemo(() => rows.map(normalizeProvision), [rows]);
}

export async function allProvisions(): Promise<Provision[]> {
  return (await documentsOf<Provision>(PROVISION)).map(normalizeProvision);
}

export function useStorages(): Storage[] {
  const rows = useDocuments<Storage>(STORAGE);
  return useMemo(() => sortStorages(rows.map(normalizeStorage)), [rows]);
}

/** Live options for the Storage-picking Card settings. */
export function useStorageOptions(): CardOption[] {
  return useStorages().map((s) => ({ value: s.id, label: s.title }));
}

export async function addStorage(title: string, kind: StorageKind): Promise<string> {
  const row = await putDocument<Storage>({ type: STORAGE, title: title.trim(), kind });
  return row.id;
}

export const patchStorage = (id: string, patch: Partial<Pick<Storage, "title" | "kind">>) => patchDocument(id, patch);

/** A Storage goes only when nothing is stored in it; false = still holds Provisions. */
export async function removeStorageIfEmpty(id: string): Promise<boolean> {
  const held = (await documentsOf<Provision>(PROVISION)).filter((p) => p.storageId === id);
  if (held.length > 0) return false;
  await removeDocument(id);
  return true;
}

export async function addProvision(input: {
  title: string;
  storageId: string;
  quantity?: number;
  unit?: string;
  minimum?: number;
  expires?: string;
  frozenOn?: string;
  tags?: string[];
}): Promise<string> {
  const row = await putDocument<Provision>({
    type: PROVISION,
    title: input.title.trim(),
    storageId: input.storageId,
    quantity: clampQty(input.quantity ?? 1),
    unit: (input.unit ?? "").trim(),
    minimum: clampQty(input.minimum ?? 0),
    expires: input.expires ?? "",
    frozenOn: input.frozenOn ?? "",
    tags: normalizeTags(input.tags),
  });
  return row.id;
}

export const patchProvision = (id: string, patch: Partial<Provision>) => patchDocument(id, patch);
export const deleteProvision = (id: string) => removeDocument(id);

/** The one-tap stepper: bump the counter, floor at zero. */
export const adjustQuantity = (p: Provision, delta: number) => patchDocument(p.id, { quantity: clampQty(p.quantity + delta) });

/**
 * Quick add (ADR 0043): the same title in the same Storage restocks (+1)
 * instead of duplicating — Provisions are a catalog, not a log.
 */
export async function quickAdd(title: string, storageId: string): Promise<{ id: string; restocked: boolean } | null> {
  const name = title.trim();
  if (!name || !storageId) return null;
  const all = (await documentsOf<Provision>(PROVISION)).map(normalizeProvision);
  const hit = matchByTitle(all, storageId, name);
  if (hit) {
    await adjustQuantity(hit, +1);
    return { id: hit.id, restocked: true };
  }
  const id = await addProvision({ title: name, storageId, quantity: 1 });
  return { id, restocked: false };
}
