import { db, type SyncedRecord } from "./db";
import { requestSync } from "./sync";

/**
 * All local writes go through here: stamp the LWW clock, store, queue for
 * push. Apps never talk to PocketBase directly.
 */
export async function put<T extends SyncedRecord>(
  collection: string,
  record: Omit<T, "updatedAt" | "deleted"> & Partial<SyncedRecord>,
): Promise<void> {
  const full = {
    deleted: 0,
    ...record,
    updatedAt: new Date().toISOString(),
  } as T;
  await db().transaction("rw", db().collection(collection), db()._outbox, async () => {
    await db().collection<T>(collection).put(full);
    await db()._outbox.add({
      collection,
      recordId: full.id,
      queuedAt: new Date().toISOString(),
    });
  });
  requestSync();
}

/** Tombstone, never a hard delete — remote devices need to see it die. */
export async function remove(collection: string, id: string): Promise<void> {
  const existing = await db().collection(collection).get(id);
  if (!existing) return;
  await put(collection, { ...existing, deleted: 1 });
}

export async function get<T extends SyncedRecord>(
  collection: string,
  id: string,
): Promise<T | undefined> {
  const rec = await db().collection<T>(collection).get(id);
  return rec && !rec.deleted ? rec : undefined;
}

/** All live (non-tombstoned) records. */
export async function all<T extends SyncedRecord>(collection: string): Promise<T[]> {
  return db().collection<T>(collection).where("deleted").equals(0).toArray();
}
