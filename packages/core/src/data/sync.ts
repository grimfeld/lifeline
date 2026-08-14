import { db, syncedCollectionNames, type SyncedRecord } from "./db";
import { pb } from "./pb";
import { useSyncExternalStore } from "react";

export type SyncState = "idle" | "syncing" | "offline" | "unauthenticated" | "error";

let state: SyncState = "idle";
let pendingCount = 0;
const listeners = new Set<() => void>();

function setState(s: SyncState) {
  if (state !== s) {
    state = s;
    listeners.forEach((l) => l());
  }
}

async function refreshPending() {
  const n = await db()._outbox.count();
  if (n !== pendingCount) {
    pendingCount = n;
    listeners.forEach((l) => l());
  }
}

export function useSyncState(): { state: SyncState; pending: number } {
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => `${state}:${pendingCount}`,
    () => "idle:0",
  );
  return { state, pending: pendingCount };
}

type PbRecord = Record<string, unknown> & { id: string; updated: string };

/** Strip PocketBase system fields before storing locally. */
function toLocal(r: PbRecord): SyncedRecord {
  const { collectionId: _c, collectionName: _n, created: _cr, updated: _u, ...rest } = r as Record<string, unknown>;
  return rest as unknown as SyncedRecord;
}

async function pushOnce(): Promise<void> {
  // Coalesce multiple queued writes of the same record into one push.
  const entries = await db()._outbox.orderBy("seq").toArray();
  const latest = new Map<string, { seqs: number[]; collection: string; recordId: string }>();
  for (const e of entries) {
    const k = `${e.collection}/${e.recordId}`;
    const cur = latest.get(k) ?? { seqs: [], collection: e.collection, recordId: e.recordId };
    cur.seqs.push(e.seq!);
    latest.set(k, cur);
  }

  for (const { seqs, collection, recordId } of latest.values()) {
    const local = await db().collection(collection).get(recordId);
    if (!local) {
      await db()._outbox.bulkDelete(seqs);
      continue;
    }
    const col = pb.collection(collection);
    try {
      let serverNewer = false;
      try {
        const server = (await col.getOne(recordId)) as unknown as PbRecord & { updatedAt?: string };
        // LWW: the newer client clock wins; a newer server copy will arrive via pull.
        if (server.updatedAt && server.updatedAt > local.updatedAt) serverNewer = true;
        if (!serverNewer) await col.update(recordId, local);
      } catch (err) {
        if ((err as { status?: number }).status === 404) {
          await col.create({ ...local, id: recordId });
        } else {
          throw err;
        }
      }
      await db()._outbox.bulkDelete(seqs);
    } catch (err) {
      // Leave the entry queued; next cycle retries.
      throw err;
    }
  }
}

async function pullCollection(name: string): Promise<void> {
  const cursorKey = `cursor:${name}`;
  const cursor = (await db()._meta.get(cursorKey))?.value ?? "";
  const filter = cursor ? pb.filter("updated > {:c}", { c: cursor }) : "";
  let page = 1;
  let maxUpdated = cursor;
  for (;;) {
    const res = await pb.collection(name).getList(page, 200, {
      filter,
      sort: "updated",
      skipTotal: true,
    });
    const items = res.items as unknown as PbRecord[];
    if (items.length === 0) break;
    await db().transaction("rw", db().collection(name), db()._outbox, async () => {
      const pending = new Set(
        (await db()._outbox.where("collection").equals(name).toArray()).map((e) => e.recordId),
      );
      for (const r of items) {
        if (r.updated > maxUpdated) maxUpdated = r.updated;
        // A locally-queued write is newer intent: let push resolve it (LWW check happens there).
        if (pending.has(r.id)) continue;
        const local = await db().collection(name).get(r.id);
        const incoming = toLocal(r);
        if (!local || incoming.updatedAt >= local.updatedAt) {
          await db().collection(name).put(incoming);
        }
      }
    });
    if (items.length < 200) break;
    page++;
  }
  if (maxUpdated !== cursor) {
    await db()._meta.put({ key: cursorKey, value: maxUpdated });
  }
}

let syncing = false;
let queued = false;
let started = false;

export async function syncNow(): Promise<void> {
  if (!pb.authStore.isValid) {
    setState("unauthenticated");
    return;
  }
  if (syncing) {
    queued = true;
    return;
  }
  syncing = true;
  setState("syncing");
  try {
    await pushOnce();
    for (const name of syncedCollectionNames()) {
      await pullCollection(name);
    }
    setState("idle");
  } catch {
    setState(navigator.onLine ? "error" : "offline");
  } finally {
    await refreshPending();
    syncing = false;
    if (queued) {
      queued = false;
      void syncNow();
    }
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/** Nudge the engine after a local write (debounced). */
export function requestSync(): void {
  void refreshPending();
  if (!started) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => void syncNow(), 400);
}

const PULL_INTERVAL_MS = 30_000;

export function startSync(): void {
  if (started) return;
  started = true;
  void syncNow();
  setInterval(() => void syncNow(), PULL_INTERVAL_MS);
  window.addEventListener("online", () => void syncNow());
  window.addEventListener("focus", () => void syncNow());
}
