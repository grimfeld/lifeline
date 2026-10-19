import { ATTACHMENTS, BLOBS, db, DOCUMENTS, syncedCollectionNames, type SyncedRecord } from "./db";
import { pb } from "./pb";
import { isDemo } from "../demo";
import { bindAccount, boundAccount, currentAccount } from "./account";
import { shouldApply } from "./reconcile";
import { documentTypeSync } from "../documents/registry";
import { isCommonKey, type Document } from "../documents/types";
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

/**
 * Strip PocketBase system fields before storing locally; Documents get their
 * `fields` JSON spread flat (ADR 0018). `owner` is the server's business
 * (ADR 0039): it never reaches the local store, so it can never land in a
 * Document's `fields` on the way back up.
 */
function toLocal(collection: string, r: PbRecord): SyncedRecord {
  const { collectionId: _c, collectionName: _n, created: _cr, updated: _u, owner: _o, ...rest } = r as Record<string, unknown>;
  if (collection === DOCUMENTS) {
    const { fields, ...common } = rest as Record<string, unknown> & { fields?: unknown };
    const extra = fields && typeof fields === "object" && !Array.isArray(fields) ? (fields as Record<string, unknown>) : {};
    const doc = { ...extra, ...common } as Document;
    if (!Array.isArray(doc.tags)) doc.tags = [];
    if (typeof doc.folder !== "string") doc.folder = "";
    // Separation (ADR 0048): a row written before the field existed is shared.
    if (typeof doc.workspace !== "string") doc.workspace = "";
    if (doc.body === null) delete doc.body;
    return doc;
  }
  return rest as unknown as SyncedRecord;
}

/**
 * The wire shape of a local record: Documents pack their type fields into
 * `fields`; an Attachment's JSON update never carries `file` (the bytes go
 * up once, at create — ADR 0037), except to clear it when tombstoned so the
 * server frees the storage.
 */
function toRemote(collection: string, local: SyncedRecord): Record<string, unknown> {
  if (collection === ATTACHMENTS) {
    const { file: _f, ...rest } = local as unknown as Record<string, unknown>;
    return local.deleted ? { ...rest, file: null } : rest;
  }
  if (collection !== DOCUMENTS) return local as unknown as Record<string, unknown>;
  const common: Record<string, unknown> = {};
  const fields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(local)) {
    if (isCommonKey(k)) common[k] = v;
    else if (v !== undefined) fields[k] = v;
  }
  return { ...common, body: (common.body as string | undefined) ?? "", fields };
}

/**
 * An Attachment's first push is a multipart create carrying the local blob
 * (ADR 0037). The server names the file; that name is kept locally, outside
 * the outbox, so lazy fetches elsewhere know what to ask for. A tombstone
 * that never reached the server has nothing to create.
 */
async function createAttachment(recordId: string, local: SyncedRecord): Promise<void> {
  if (local.deleted) return;
  const row = (await db().table(BLOBS).get(recordId)) as { blob: Blob } | undefined;
  if (!row) throw new Error("attachment bytes are missing locally");
  const form = new FormData();
  for (const [k, v] of Object.entries(toRemote(ATTACHMENTS, local))) {
    if (v === undefined || v === null) continue;
    form.append(k, String(v));
  }
  form.append("file", row.blob, (local as unknown as { name: string }).name);
  const created = (await pb.collection(ATTACHMENTS).create(form)) as unknown as { file?: string };
  if (created.file) await db().collection<SyncedRecord & { file?: string }>(ATTACHMENTS).update(recordId, { file: created.file });
}

/**
 * A record this device holds that the server has, but not for this Account:
 * the read came back 404 (the view rule hid it), then the create said the id
 * is taken. Left over from before Accounts existed (ADR 0039), when every
 * sign-in pulled every row — the write can never land, so retrying is noise.
 */
class ForeignRecordError extends Error {
  constructor(collection: string, recordId: string) {
    super(`${collection}/${recordId} belongs to another account (left over from before Accounts) — erase this device's local data to clean it up`);
  }
}

function isForeignRecord(err: unknown): boolean {
  const e = err as { status?: number; response?: { data?: { id?: { code?: string } } } };
  return e?.status === 400 && e.response?.data?.id?.code === "validation_not_unique";
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
          const hook = collection === DOCUMENTS ? documentTypeSync((local as Document).type)?.onConflict : undefined;
          if (hook) await hook(local as Document, toLocal(collection, server) as Document);
        } else {
          await col.update(recordId, toRemote(collection, local));
        }
      } catch (err) {
        if ((err as { status?: number }).status === 404) {
          try {
            if (collection === ATTACHMENTS) await createAttachment(recordId, local);
            else await col.create({ ...toRemote(collection, local), id: recordId });
          } catch (createErr) {
            if (isForeignRecord(createErr)) throw new ForeignRecordError(collection, recordId);
            throw createErr;
          }
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
      } else if (err instanceof ForeignRecordError) {
        // Report it first: the other failures are usually this one's shadow.
        failures.unshift(err.message);
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
  // A record held back below leaves the cursor where it is, so the server copy
  // comes again next cycle instead of being skipped for good.
  let held = false;
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
        // A locally-queued write is newer intent: let push resolve it (LWW check happens there).
        if (pending.has(r.id)) {
          held = true;
          continue;
        }
        if (!held && r.updated > maxUpdated) maxUpdated = r.updated;
        const local = await db().collection(name).get(r.id);
        const incoming = toLocal(name, r);
        if (shouldApply(local, incoming)) await db().collection(name).put(incoming);
      }
    });
    if (items.length < 200) break;
    page++;
  }
  if (maxUpdated !== cursor) {
    await db()._meta.put({ key: cursorKey, value: maxUpdated });
  }
  // "This collection has been pulled at least once" — written whether or not
  // anything came back, which the cursor above cannot say: it only advances
  // when a row arrives, so a collection the server has no rows for never
  // writes one. Anything waiting for "the server has told us what it has"
  // waits on this (see ensureDefaultWorkspace).
  await db()._meta.put({ key: pulledKey(name), value: "1" });
}

const pulledKey = (name: string) => `pulled:${name}`;

/**
 * Whether one collection has been pulled at least once on this device — the
 * honest "we know what the server has" signal for that collection.
 *
 * Per collection, deliberately, and not "a whole cycle came back clean": a
 * cycle-level flag is blocked by *any* failing collection, so one collection
 * awaiting a migration would stall unrelated work that only needs its own.
 *
 * Signed out it is vacuously true: no sync is coming, so nothing should wait.
 */
export async function hasPulledOnce(collection: string): Promise<boolean> {
  if (!pb.authStore.isValid) return true;
  return !!(await db()._meta.get(pulledKey(collection)));
}

let syncing = false;
let queued = false;
let started = false;

export async function syncNow(): Promise<void> {
  const me = currentAccount();
  if (!me) {
    setState("unauthenticated");
    return;
  }
  if (syncing) {
    queued = true;
    return;
  }
  // One device, one Account (ADR 0039): never push this device's rows as
  // someone else, never pull someone else's rows into them.
  const bound = await boundAccount();
  if (bound && bound.id !== me.id) {
    lastSyncError = `This device holds ${bound.email || "another account"}'s data — sign in as them, or erase it to switch`;
    listeners.forEach((l) => l());
    setState("error");
    return;
  }
  if (!bound) await bindAccount(me);
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
  // The Demo has no backend (ADR 0077): local writes fill the outbox, which nothing drains.
  if (started || isDemo()) return;
  started = true;
  void syncNow();
  setInterval(() => void syncNow(), PULL_INTERVAL_MS);
  window.addEventListener("online", () => void syncNow());
  window.addEventListener("focus", () => void syncNow());
}
