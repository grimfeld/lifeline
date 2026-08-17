import { db, syncedCollectionNames, type SyncedRecord } from "./db";
import { pb } from "./pb";
import { collectionDef } from "../registry";
import { useSyncExternalStore } from "react";

export type SyncState = "idle" | "syncing" | "offline" | "unauthenticated" | "error";

let state: SyncState = "idle";
let pendingCount = 0;
const listeners = new Set<() => void>();

/** Last sync problem, for the badge/tooltip ("" when the last cycle was clean). */
export let lastSyncError = "";

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

export function useSyncState(): { state: SyncState; pending: number; error: string } {
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => `${state}:${pendingCount}:${lastSyncError}`,
    () => "idle:0:",
  );
  return { state, pending: pendingCount, error: lastSyncError };
}

type PbRecord = Record<string, unknown> & { id: string; updated: string };

/** Strip PocketBase system fields before storing locally. */
function toLocal(r: PbRecord): SyncedRecord {
  const { collectionId: _c, collectionName: _n, created: _cr, updated: _u, ...rest } = r as Record<string, unknown>;
  return rest as unknown as SyncedRecord;
}

/** PocketBase says a collection is missing when the server hasn't run a migration yet. */
function isMissingCollection(err: unknown): boolean {
  const e = err as { status?: number; response?: { message?: string } };
  return e?.status === 404 && /collection/i.test(e.response?.message ?? "");
}

/**
 * Push every queued local write. One failing record (or a collection the
 * server doesn't have yet) is skipped and left queued for the next cycle —
 * it never blocks the others. Throws at the end if anything failed, so the
 * badge shows an error while everything that could sync did.
 */
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

  const failures: string[] = [];
  const skipCollections = new Set<string>();
  for (const { seqs, collection, recordId } of latest.values()) {
    if (skipCollections.has(collection)) continue;
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
        if (serverNewer) {
          // The App may rescue the losing local edit (ADR 0010) before pull overwrites it.
          const hook = collectionDef(collection)?.onConflict;
          if (hook) await hook(local, toLocal(server));
        } else {
          await col.update(recordId, local);
        }
      } catch (err) {
        if ((err as { status?: number }).status === 404) {
          await col.create({ ...local, id: recordId });
        } else {
          throw err;
        }
      }
      await db()._outbox.bulkDelete(seqs);
    } catch (err) {
      // Leave the entry queued; next cycle retries. Keep pushing the rest.
      if (isMissingCollection(err)) {
        skipCollections.add(collection);
        failures.push(`server has no "${collection}" collection yet — run the PocketBase migrations`);
      } else {
        const msg = (err as { response?: { message?: string }; message?: string }).response?.message ?? (err as Error).message ?? String(err);
        failures.push(`${collection}/${recordId}: ${msg}`);
      }
    }
  }
  if (failures.length) throw new Error(failures[0] + (failures.length > 1 ? ` (+${failures.length - 1} more)` : ""));
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
  const problems: string[] = [];
  try {
    try {
      await pushOnce();
    } catch (err) {
      problems.push((err as Error).message);
    }
    for (const name of syncedCollectionNames()) {
      try {
        await pullCollection(name);
      } catch (err) {
        // A collection missing on the server (pending migration) must not stop the others.
        problems.push(isMissingCollection(err) ? `server has no "${name}" collection yet — run the PocketBase migrations` : `${name}: ${(err as Error).message}`);
      }
    }
    lastSyncError = problems[0] ?? "";
    listeners.forEach((l) => l());
    if (problems.length) {
      console.warn("[sync]", problems.join("; "));
      setState(navigator.onLine ? "error" : "offline");
    } else setState("idle");
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
