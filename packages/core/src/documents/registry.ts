import { useSyncExternalStore } from "react";
import { liveQuery } from "dexie";
import { useLiveQuery } from "dexie-react-hooks";
import { db, DOCUMENT_TYPES, type SyncedRecord } from "../data/db";
import { put, remove } from "../data/repo";
import { newId } from "../ids";
import { ownKeyRefusal } from "./typeRules";
import { optionValueFrom } from "./fieldDrafts";
import { foldName } from "../markdown";
import type { BodyPolicy, DocumentTypeDef, FieldDef, FieldOption, ReportSetting } from "./types";

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
  /** The Module the user homes the type in (ADR 0068); "" or absent = none. Ignored on a built-in's override. */
  module?: string;
  /** The type's chosen Reports (ADR 0076), built-in or not; absent = the defaults. */
  reports?: ReportSetting[];
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
    homeModule: r.module || undefined,
    order: 100 + (r.order || 0),
    reports: Array.isArray(r.reports) ? r.reports : undefined,
    builtIn: false,
  };
}

/**
 * A `userOptions` Choice's options: the App's, each under the user's label
 * when they renamed it, then the ones the user added, in their order. An App
 * option the user's list leaves out keeps its place and label: none is lost.
 */
export function userChoiceOptions(app: readonly FieldOption[], user: readonly FieldOption[] | undefined): FieldOption[] {
  const mine = new Map((user ?? []).filter((o) => o && typeof o.value === "string" && typeof o.label === "string" && o.label.trim()).map((o) => [o.value, o.label.trim()]));
  const known = new Set(app.map((o) => o.value));
  return [...app.map((o) => (mine.has(o.value) ? { ...o, label: mine.get(o.value)! } : o)), ...[...mine].filter(([v]) => !known.has(v)).map(([value, label]) => ({ value, label }))];
}

/**
 * The options the user added to a built-in's `userOptions` Choices, from an
 * override record's Fields: the App's own options, renamed or not, left out,
 * and a Choice with none added dropped. What a reset keeps (ADR 0123).
 */
function addedOptions(b: DocumentTypeDef | undefined, fields: unknown): FieldDef[] {
  return (Array.isArray(fields) ? (fields as FieldDef[]) : []).flatMap((f) => {
    const own = b?.fields.find((x) => x.key === f.key);
    if (!own?.userOptions) return [];
    const app = new Set((own.options ?? []).map((o) => o.value));
    const added = (f.options ?? []).filter((o) => !app.has(o.value));
    return added.length ? [{ ...f, options: added }] : [];
  });
}

/**
 * Whether an override record holds nothing but options the user added, as a
 * reset leaves it: not an edit, so the type reads unedited and offers no reset
 * that would do nothing.
 */
function onlyAddedOptions(b: DocumentTypeDef, r: DocumentTypeRecord): boolean {
  const fields = Array.isArray(r.fields) ? r.fields : [];
  const added = addedOptions(b, fields);
  const same = (x: FieldDef, y: FieldDef | undefined) => !!y && (x.options ?? []).length === (y.options ?? []).length;
  return r.label === b.label && (r.icon ?? "") === (b.iconName ?? "") && (r.folder ?? "") === (b.folder ?? "") && !r.reports && fields.length === added.length && fields.every((f) => same(f, added.find((a) => a.key === f.key)));
}

/** A built-in's own Fields with the user's options on each `userOptions` Choice, from the override record. */
function ownFields(b: DocumentTypeDef, r: DocumentTypeRecord): FieldDef[] {
  const saved = new Map((Array.isArray(r.fields) ? r.fields : []).map((f) => [f.key, f]));
  return b.fields.map((f) => (f.userOptions && saved.has(f.key) ? { ...f, options: userChoiceOptions(f.options ?? [], saved.get(f.key)!.options) } : f));
}

function merge(user: DocumentTypeRecord[]): DocumentTypeDef[] {
  const byId = new Map(user.map((r) => [r.typeId, r]));
  const merged = builtins.map((b) => {
    const r = byId.get(b.id);
    if (!r) return b;
    const d = toDef(r);
    // The built-in's own Fields stay its App's (CONTEXT.md "Field"); the user's sit beside them, a key the App already declares kept as the App's.
    const own = new Set(b.fields.map((f) => f.key));
    const fields = [...ownFields(b, r), ...d.fields.filter((f) => !own.has(f.key))];
    return { ...b, label: d.label, singular: undefined, icon: d.icon ?? b.icon, iconName: d.iconName, folder: d.folder, fields, reports: d.reports ?? b.reports, builtIn: true, overridden: !onlyAddedOptions(b, r) };
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

/**
 * Save a type record. Throws when it adds a Field keyed with one of a
 * Document's own keys (spec #95) — whoever calls, the editor or an agent; a
 * Field the record already had is kept.
 */
export async function saveDocumentType(input: Omit<DocumentTypeRecord, "id" | "updatedAt" | "deleted"> & { id?: string }): Promise<DocumentTypeRecord> {
  const { id, ...rest } = input;
  const before = id ? await db().collection<DocumentTypeRecord>(DOCUMENT_TYPES).get(id) : undefined;
  const refusal = ownKeyRefusal(Array.isArray(before?.fields) ? before.fields : [], Array.isArray(rest.fields) ? rest.fields : []);
  if (refusal) throw new Error(refusal);
  const rec: DocumentTypeRecord = { ...rest, id: id ?? newId(), updatedAt: "", deleted: 0 };
  await put<DocumentTypeRecord>(DOCUMENT_TYPES, rec);
  return rec;
}

/**
 * Rename and add options on a built-in's `userOptions` Choice (a Place's Kind):
 * `options` is the list as the user wants it, an option with no value a new
 * one. Kept on the type's override record, made from the built-in when it has
 * none. Throws in words for an empty name or two options with one name.
 */
export async function saveFieldOptions(typeId: string, key: string, options: readonly { value?: string; label: string }[]): Promise<void> {
  const b = builtinType(typeId);
  const field = b?.fields.find((f) => f.key === key);
  if (!b || !field?.userOptions) throw new Error(`${b?.label ?? typeId}: ${key} takes no options of yours`);
  const seen = new Set<string>();
  const values: string[] = (field.options ?? []).map((o) => o.value);
  const next: FieldOption[] = [];
  for (const o of options) {
    const label = o.label.trim();
    if (!label) throw new Error(`A ${field.label} needs a name`);
    if (seen.has(foldName(label))) throw new Error(`“${label}” is already a ${field.label}`);
    seen.add(foldName(label));
    const value = o.value ?? optionValueFrom(label, values);
    values.push(value);
    next.push({ value, label });
  }
  const rows = await db().collection<DocumentTypeRecord>(DOCUMENT_TYPES).where("deleted").equals(0).toArray();
  const r = rows.find((x) => x.typeId === typeId);
  const entry: FieldDef = { key, label: field.label, kind: field.kind, options: next };
  const fields = [...(r?.fields ?? []).filter((f) => f.key !== key), entry];
  await put<DocumentTypeRecord>(DOCUMENT_TYPES, r ? { ...r, fields } : { id: newId(), typeId, label: b.label, icon: b.iconName ?? "", folder: b.folder ?? "", fields, order: 0, updatedAt: "", deleted: 0 });
}

export async function deleteDocumentType(id: string): Promise<void> {
  await remove(DOCUMENT_TYPES, id);
}

/**
 * Reset a built-in type to its default (ADR 0072): its override record goes,
 * except the options the user added to a `userOptions` Choice, which stay on a
 * record of their own — a Place with a Kind of yours must still find it (ADR
 * 0123: an option is never removed). The App's own options, renamed or not,
 * take their App's names back.
 */
export async function resetBuiltinType(rec: DocumentTypeRecord): Promise<void> {
  const b = builtinType(rec.typeId);
  const kept = addedOptions(b, rec.fields);
  if (kept.length === 0) return deleteDocumentType(rec.id);
  await put<DocumentTypeRecord>(DOCUMENT_TYPES, { id: rec.id, typeId: rec.typeId, label: b?.label ?? rec.label, icon: b?.iconName ?? "", folder: b?.folder ?? "", fields: kept, order: 0, updatedAt: "", deleted: 0 });
}

/** Types the Vault tree shows: body-first ones (and any Document with a non-empty body, decided per row). */
export function isVaultType(def: DocumentTypeDef): boolean {
  return !def.internal && (def.vault ?? def.body === "required");
}
