import Dexie, { type Table } from "dexie";
import type { CollectionDef } from "../manifest";
import type { DateStr } from "../dates";
import type { CardSettings } from "../cards";

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
}

/**
 * Bump whenever the set of stores or their indexes changes (Dexie needs a
 * monotonically increasing version to migrate an existing local database;
 * only the latest version has to be declared).
 *   1 — tracer bullet: chores, chore_completions, placements, screens
 *   2 — Tasks App: tasks, task_occurrences
 *   3 — Calendar App: events
 *   4 — Stats App: stats, stat_entries; Media App: media
 *   5 — Notes App: notes
 *   6 — notes.folder index (ADR 0013)
 *   7 — note_types (user-defined Note types)
 *   8 — *tags multi-entry indexes on tasks, chores, events, stats, media (ADR 0014)
 */
const DB_VERSION = 8;

export class LifelineDB extends Dexie {
  _outbox!: Table<OutboxEntry, number>;
  _meta!: Table<MetaEntry, string>;

  constructor(collections: CollectionDef[]) {
    super("lifeline");
    const stores: Record<string, string> = {
      _outbox: "++seq, collection",
      _meta: "key",
      placements: "id, updatedAt, deleted, date, [appId+itemId]",
      screens: "id, updatedAt, deleted, sort",
    };
    for (const c of collections) {
      stores[c.name] = ["id, updatedAt, deleted", ...(c.indexes ?? [])].join(", ");
    }
    this.version(DB_VERSION).stores(stores);
  }

  collection<T extends SyncedRecord = SyncedRecord>(name: string): Table<T, string> {
    return this.table(name) as Table<T, string>;
  }
}

let _db: LifelineDB | null = null;

export function openDb(collections: CollectionDef[]): LifelineDB {
  if (_db) return _db;
  _db = new LifelineDB(collections);
  return _db;
}

export function db(): LifelineDB {
  if (!_db) throw new Error("Database not opened — call initApps() first");
  return _db;
}

/** Names of all synced collections (core + apps). Internal tables excluded. */
export function syncedCollectionNames(): string[] {
  return db()
    .tables.map((t) => t.name)
    .filter((n) => !n.startsWith("_"));
}
