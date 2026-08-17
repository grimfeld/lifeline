import { useEffect, useMemo, useReducer } from "react";
import { db, liveQuery, newId, put, remove, useLiveQuery, type SyncedRecord } from "@lifeline/core";
import { BUILTIN_TYPES, builtinType, PLAIN_TYPE, typeIcon, type NoteTypeDef, type PropertyDef } from "../domain/noteTypes";

/** A user-defined Note type (ADR 0009, amended): synced like any record; the built-ins stay in code. */
export interface NoteTypeRecord extends SyncedRecord {
  /** Type id used in `notes.type` — a slug, immutable after creation. */
  typeId: string;
  label: string;
  plural: string;
  /** Name in TYPE_ICONS. */
  icon: string;
  /** Default folder for new notes ("" = root). */
  folder: string;
  properties: PropertyDef[];
  order: number;
}

export const NOTE_TYPES_COLLECTION = "note_types";

function toDef(r: NoteTypeRecord): NoteTypeDef {
  return {
    id: r.typeId,
    label: r.label,
    plural: r.plural || r.label,
    icon: typeIcon(r.icon),
    iconName: r.icon,
    folder: r.folder ?? "",
    titleRule: "name",
    properties: Array.isArray(r.properties) ? r.properties : [],
    template: "",
    order: 100 + (r.order || 0),
    builtIn: false,
  };
}

function merge(user: NoteTypeRecord[]): NoteTypeDef[] {
  const builtins = BUILTIN_TYPES as readonly NoteTypeDef[];
  const ids = new Set(builtins.map((t) => t.id));
  const extra = user.filter((r) => !ids.has(r.typeId)).map(toDef);
  return [...builtins, ...extra].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
}

// --- synchronous access: a module cache kept fresh by a live subscription ------
let cache: NoteTypeDef[] = merge([]);
let watching = false;
const listeners = new Set<() => void>();
function ensureWatch() {
  if (watching) return;
  watching = true;
  try {
    liveQuery(() => db().collection<NoteTypeRecord>(NOTE_TYPES_COLLECTION).where("deleted").equals(0).toArray()).subscribe({
      next: (rows) => {
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

/** All Note types (built-in + user), synchronously from the cache. */
export function allNoteTypes(): NoteTypeDef[] {
  ensureWatch();
  return cache;
}

/** One type by id — unknown ids render as plain (deleted user types degrade gracefully). */
export function noteType(id: string): NoteTypeDef {
  ensureWatch();
  return cache.find((t) => t.id === id) ?? builtinType(id) ?? (builtinType(PLAIN_TYPE) as NoteTypeDef);
}

/** Live list of Note types for components. */
export function useNoteTypes(): NoteTypeDef[] {
  ensureWatch();
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    listeners.add(force);
    return () => void listeners.delete(force);
  }, []);
  const rows = useLiveQuery(() => db().collection<NoteTypeRecord>(NOTE_TYPES_COLLECTION).where("deleted").equals(0).toArray(), [], undefined);
  return useMemo(() => (rows ? merge(rows) : cache), [rows]);
}

export function useUserNoteTypes(): NoteTypeRecord[] {
  return useLiveQuery(() => db().collection<NoteTypeRecord>(NOTE_TYPES_COLLECTION).where("deleted").equals(0).sortBy("order"), [], [] as NoteTypeRecord[]);
}

export async function saveNoteType(input: Omit<NoteTypeRecord, "id" | "updatedAt" | "deleted"> & { id?: string }): Promise<NoteTypeRecord> {
  const { id, ...rest } = input;
  const rec: NoteTypeRecord = { ...rest, id: id ?? newId(), updatedAt: "", deleted: 0 };
  await put<NoteTypeRecord>(NOTE_TYPES_COLLECTION, rec);
  return rec;
}

export async function deleteNoteType(id: string): Promise<void> {
  await remove(NOTE_TYPES_COLLECTION, id);
}
