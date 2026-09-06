import Dexie, { type Table } from "dexie";
import type { CollectionDef } from "../manifest";
import type { DateStr } from "../dates";
import type { CardSettings } from "../cards";
import type { Document } from "../documents/types";

/** Every synced record carries these. `deleted` is a tombstone (0|1 — Dexie can't index booleans). */
export interface SyncedRecord {
  id: string;
  /** Client write time, ISO with millis. The LWW clock. */
  updatedAt: string;
  deleted: 0 | 1;
}

export interface OutboxEntry {
  seq?: number;
  collection: string;
  recordId: string;
  queuedAt: string;
}

export interface MetaEntry {
  key: string;
  value: string;
}

/**
 * Core-owned: a Schedulable item pinned to a specific day, overriding its
 * natural date — and, with `start` set, a Time block on the Schedule surface
 * (ADR 0015). The time is the surface's, never the App's.
 */
export interface Placement extends SyncedRecord {
  appId: string;
  itemId: string;
  date: DateStr;
  /** "HH:MM"; absent/null = untimed (day pin only). */
  start?: string | null;
  end?: string | null;
}

export interface ScreenLayoutItem {
  /** Unique within the Screen; the same cardId may be placed several times (ADR 0008). Older layouts lack it — see normalizeLayout(). */
  instanceId?: string;
  cardId: string;
  /** Instance settings for configurable Cards. */
  settings?: CardSettings;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Core-owned: a user-created Screen — a named grid of Cards. */
export interface UserScreen extends SyncedRecord {
  name: string;
  layout: ScreenLayoutItem[];
  sort: number;
  /** Screen-level Tag filter (ADR 0014): every tagFilterable Card on it obeys. */
  tags?: string[];
  /** The one Screen the phone's bottom bar opens as Home (grill 2026-08-20). Synced; at most one Screen holds it. */
  phoneHome?: boolean;
}

/**
 * Core-owned: a saved View inside a type's Base (CONTEXT.md "View"):
 * filters, sort, visible fields and layout. Every Base has an implicit
 * "All" View; these are the user's extra ones.
 */
/** A View's layout (CONTEXT.md "View"). Layouts display; they never bypass App ownership (ADR 0020). */
export type ViewLayout = "table" | "list" | "cards" | "gallery" | "map" | "board" | "calendar";

export interface ViewRecord extends SyncedRecord {
  /** Document type id the Base belongs to. */
  type: string;
  name: string;
  layout: ViewLayout;
  /** gallery: field whose value is the image URL. */
  imageField?: string;
  /** map: geo field ([lat, lon]) placing each Document. */
  geoField?: string;
  /** board: select field the columns group by. */
  groupField?: string;
  /** calendar: date/datetime field placing each Document. */
  dateField?: string;
  /** Conjunction of filters. */
  filters: ViewFilter[];
  /** Text search across title/body. */
  search?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  /** Visible field keys (undefined = type default). */
  columns?: string[];
  sort: number;
}

export type ViewFilterOp = "eq" | "neq" | "contains" | "empty" | "notEmpty" | "gt" | "lt" | "anyOf";

export interface ViewFilter {
  /** Field key, or "title" / "tags" / "folder" / "createdAt". */
  field: string;
  op: ViewFilterOp;
  value?: string | number | boolean | string[];
}

/**
 * Bump whenever the set of stores or their indexes changes (Dexie needs a
 * monotonically increasing version to migrate an existing local database;
 * only the latest version has to be declared).
 *   1–12 — per-App collections (pre-ADR 0018)
 *   13 — one `documents` store (ADR 0018), `views`, `document_types`; per-App stores dropped
 *   14 — media split: per-medium types; media's `[type+medium]` index dropped, `[type+slot]`/`[type+externalKey]` shared by the six types
 *   15 — Museum App (ADR 0022): `[type+artistId]` and `[type+exhibitionId]` added
 *   16 — Attachments (ADR 0037): synced `attachments` metadata, local `_blobs` bytes
 *   18 — Prices App (ADR 0045): `[type+receiptId]`, `[type+productId]`, `[type+shopId]` added
 *   19 — Mail App (ADR 0047): local `_mail_cache` table
 */
const DB_VERSION = 19;

/** Stores that existed before ADR 0018; deleted on upgrade so a client re-pulls into `documents`. */
const LEGACY_STORES = [
  "chores", "chore_completions", "tasks", "task_occurrences", "events", "stats", "stat_entries", "media", "media_quotes",
  "media_settings", "notes", "note_types", "sources",
];

export const DOCUMENTS = "documents";
export const VIEWS = "views";
export const DOCUMENT_TYPES = "document_types";
/** Attachment metadata (ADR 0037) — synced; the bytes live in `_blobs`, local only. */
export const ATTACHMENTS = "attachments";
export const BLOBS = "_blobs";

/** Indexes every Document row gets; type-declared ones are added as `[type+field]`. */
const DOCUMENT_BASE_INDEXES = ["id", "updatedAt", "deleted", "type", "[type+deleted]", "title", "folder", "*tags", "createdAt"];

export function compileDocumentIndex(ix: string): string {
  return ix.startsWith("[") ? ix : `[type+${ix}]`;
}

export class LifelineDB extends Dexie {
  _outbox!: Table<OutboxEntry, number>;
  _meta!: Table<MetaEntry, string>;
  documents!: Table<Document, string>;

  constructor(documentIndexes: string[], localTables: CollectionDef[]) {
    super("lifeline");
    const stores: Record<string, string | null> = {
      _outbox: "++seq, collection",
      _meta: "key",
      placements: "id, updatedAt, deleted, date, [appId+itemId]",
      screens: "id, updatedAt, deleted, sort",
      [VIEWS]: "id, updatedAt, deleted, type, sort",
      [DOCUMENT_TYPES]: "id, updatedAt, deleted, typeId",
      [ATTACHMENTS]: "id, updatedAt, deleted, name",
      [BLOBS]: "id",
      [DOCUMENTS]: Array.from(new Set([...DOCUMENT_BASE_INDEXES, ...documentIndexes.map(compileDocumentIndex)])).join(", "),
    };
    for (const c of localTables) {
      stores[c.name] = ["id, updatedAt, deleted", ...(c.indexes ?? [])].join(", ");
    }
    for (const l of LEGACY_STORES) stores[l] = null;
    this.version(DB_VERSION).stores(stores);
  }

  collection<T extends SyncedRecord = SyncedRecord>(name: string): Table<T, string> {
    return this.table(name) as Table<T, string>;
  }
}

let _db: LifelineDB | null = null;

export function openDb(documentIndexes: string[], localTables: CollectionDef[]): LifelineDB {
  if (_db) return _db;
  _db = new LifelineDB(documentIndexes, localTables);
  return _db;
}

export function db(): LifelineDB {
  if (!_db) throw new Error("Database not opened — call initApps() first");
  return _db;
}

/** Names of all synced collections (documents + core bookkeeping). Internal tables excluded. */
export function syncedCollectionNames(): string[] {
  return db()
    .tables.map((t) => t.name)
    .filter((n) => !n.startsWith("_"));
}
