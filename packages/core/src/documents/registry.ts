import { useSyncExternalStore } from "react";
import { liveQuery } from "dexie";
import { useLiveQuery } from "dexie-react-hooks";
import { db, DOCUMENT_TYPES, type SyncedRecord } from "../data/db";
import { put, remove } from "../data/repo";
import { newId } from "../ids";
import type { BodyPolicy, DocumentTypeDef, FieldDef } from "./types";

/**
 * A user-defined Document type (ADR 0019): a row of Core's `document_types`
 * collection. Built-ins live in code; a user record whose `typeId` matches a
 * built-in *overrides* its label/icon/folder/fields (the built-in's
 * rules — title rule, body policy, Contracts, App — stay).
 */
export interface DocumentTypeRecord extends SyncedRecord {
  /** Type id, a slug, immutable after creation. */
  typeId: string;
  label: string;
  /** Name in the curated icon set. */
  icon: string;
  /** Default folder for new Documents ("" = root). */
  folder: string;
  fields: FieldDef[];
  /** Body policy; defaults to "optional". */
  body?: BodyPolicy;
  /** Linkable by title/aliases (data-declarable Contract). */
  linkable?: boolean;
  /** Key of the geo field that makes Documents Locatable; "" = none. */
  locatableField?: string;
  template?: string;
  order: number;
}

// --- built-ins: set once at startup from the App manifests ---------------------
let builtins: DocumentTypeDef[] = [];
/** Icon resolver for user-defined types; the shell installs the curated set (packages/ui) at startup. */
let iconResolver: (name: string | undefined) => DocumentTypeDef["icon"] = () => undefined;

export function registerBuiltinTypes(defs: DocumentTypeDef[]): void {
  builtins = defs.map((d) => ({ ...d, builtIn: true }));
  cache = merge(lastRows);
}

export function setTypeIconResolver(fn: (name: string | undefined) => DocumentTypeDef["icon"]): void {
  iconResolver = fn;
  cache = merge(lastRows);
}

export function builtinTypes(): DocumentTypeDef[] {
  return builtins;
}

export function builtinType(id: string): DocumentTypeDef | undefined {
  return builtins.find((t) => t.id === id);
}

function toDef(r: DocumentTypeRecord): DocumentTypeDef {
  return {
    id: r.typeId,
    label: r.label,
    icon: iconResolver(r.icon),
    iconName: r.icon,
    folder: r.folder ?? "",
    titleRule: "name",
    body: r.body ?? "optional",
    fields: Array.isArray(r.fields) ? r.fields : [],
    template: r.template ?? "",
    linkable: r.linkable !== false,
    locatable: r.locatableField || undefined,
    order: 100 + (r.order || 0),
    builtIn: false,
  };
}

function merge(user: DocumentTypeRecord[]): DocumentTypeDef[] {
  const byId = new Map(user.map((r) => [r.typeId, r]));
  const merged = builtins.map((b) => {
    const r = byId.get(b.id);
    if (!r) return b;
    const d = toDef(r);
    return { ...b, label: d.label, singular: undefined, icon: d.icon ?? b.icon, iconName: d.iconName, folder: d.folder, fields: d.fields, builtIn: true, overridden: true };
  });
  const ids = new Set(builtins.map((t) => t.id));
  const extra = user.filter((r) => !ids.has(r.typeId)).map(toDef);
  return [...merged, ...extra].sort((a, b) => (a.order ?? 50) - (b.order ?? 50) || a.label.localeCompare(b.label));
}

// --- synchronous access: a module cache kept fresh by a live subscription ------
let lastRows: DocumentTypeRecord[] = [];
let cache: DocumentTypeDef[] = [];
let watching = false;
const listeners = new Set<() => void>();

function ensureWatch() {
  if (watching) return;
  watching = true;
  try {
    liveQuery(() => db().collection<DocumentTypeRecord>(DOCUMENT_TYPES).where("deleted").equals(0).toArray()).subscribe({
      next: (rows) => {
        lastRows = rows;
        cache = merge(rows);
        listeners.forEach((l) => l());
      },
      error: () => {
        /* keep the last cache */
      },
    });
  } catch {
    watching = false; // db not open yet; retry on next call
  }
}

/** Every Document type (built-in + user-defined), synchronously from the cache. */
export function allDocumentTypes(): DocumentTypeDef[] {
  ensureWatch();
  return cache;
}

/** One type by id, or undefined for an unknown/deleted type. */
export function documentType(id: string): DocumentTypeDef | undefined {
  ensureWatch();
  return cache.find((t) => t.id === id) ?? builtinType(id);
}

/** Sync-layer access (no React, no watch side effects beyond the cache). */
export function documentTypeSync(id: string): DocumentTypeDef | undefined {
  return cache.find((t) => t.id === id) ?? builtinType(id);
}

function subscribeTypes(l: () => void) {
  listeners.add(l);
  ensureWatch();
  return () => void listeners.delete(l);
}

/** Live list of Document types for components — the one shared cache, so every consumer sees the same array per change. */
export function useDocumentTypes(): DocumentTypeDef[] {
  ensureWatch();
  return useSyncExternalStore(subscribeTypes, () => cache);
}

export function useDocumentType(id: string | undefined): DocumentTypeDef | undefined {
  const all = useDocumentTypes();
  return id ? all.find((t) => t.id === id) : undefined;
}

/** The raw user-defined records (for the type manager). */
export function useUserDocumentTypes(): DocumentTypeRecord[] {
  return useLiveQuery(() => db().collection<DocumentTypeRecord>(DOCUMENT_TYPES).where("deleted").equals(0).sortBy("order"), [], [] as DocumentTypeRecord[]);
}

export async function saveDocumentType(input: Omit<DocumentTypeRecord, "id" | "updatedAt" | "deleted"> & { id?: string }): Promise<DocumentTypeRecord> {
  const { id, ...rest } = input;
  const rec: DocumentTypeRecord = { ...rest, id: id ?? newId(), updatedAt: "", deleted: 0 };
  await put<DocumentTypeRecord>(DOCUMENT_TYPES, rec);
  return rec;
}

export async function deleteDocumentType(id: string): Promise<void> {
  await remove(DOCUMENT_TYPES, id);
}

/** Types the Vault tree shows: body-first ones (and any Document with a non-empty body, decided per row). */
export function isVaultType(def: DocumentTypeDef): boolean {
  return !def.internal && (def.vault ?? def.body === "required");
}
