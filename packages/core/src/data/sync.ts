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

/** A synced collection's row on the wire: every one carries the LWW keys (`updatedAt`, `deleted`) beside PocketBase's own. */
type PbRecord = Record<string, unknown> & SyncedRecord & { updated: string };

/**
 * Strip PocketBase system fields before storing locally; Documents get their
 * `fields` JSON spread flat (ADR 0018). `owner` is the server's business
 * (ADR 0039): it never reaches the local store, so it can never land in a
 * Document's `fields` on the way back up.
 */
function toLocal(collection: string, r: PbRecord): SyncedRecord {
  const { collectionId: _c, collectionName: _n, created: _cr, updated: _u, owner: _o, ...rest } = r;
  if (collection === DOCUMENTS) {
    const { fields, ...common } = rest as Record<string, unknown> & { fields?: unknown };
    const extra = fields && typeof fields === "object" && !Array.isArray(fields) ? (fields as Record<string, unknown>) : {};
    const doc = { ...extra, ...common } as Document;
    if (!Array.isArray(doc.tags)) doc.tags = [];
    if (typeof doc.folder !== "string") doc.folder = "";
    // Separation (ADR 0048): a row written before the field existed is shared.
    if (typeof doc.workspace !== "string") doc.workspace = "";
    // The wire always carries a body; a type that has none keeps none locally.
    if (doc.body === null || (doc.body === "" && documentTypeSync(doc.type)?.body === "none")) delete doc.body;
    return doc;
  }
  return rest;
}

/**
 * The wire shape of a local record: Documents pack their type fields into
 * `fields`; an Attachment's JSON update never carries `file` (the bytes go
 * up once, at create — ADR 0037), except to clear it when tombstoned so the
 * server frees the storage.
 */
function toRemote(collection: string, local: SyncedRecord): Record<string, unknown> {
  if (collection === ATTACHMENTS) {
    const { file: _f, ...rest } = local as SyncedRecord & { file?: unknown };
    return local.deleted ? { ...rest, file: null } : rest;
  }
  if (collection !== DOCUMENTS) return { ...local };
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
  form.append("file", row.blob, (local as SyncedRecord & { name: string }).name);
  const created = await pb.collection(ATTACHMENTS).create<{ file?: string }>(form);
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

/** The server refused an update because its copy is newer (`pocketbase/pb_hooks/lww.pb.js`). */
function isStale(err: unknown): boolean {
  return (err as { status?: number })?.status === 409;
}

/**
 * The server holds a newer copy than the queued write (LWW, ADR 0002). The App
 * may rescue the losing local edit (ADR 0010); then the server copy replaces
 * the local row — unless another write to it was queued meanwhile, which push
 * sends next cycle. Stored here, not left to the pull: a push-only cycle pulls
 * nothing, and a cursor already past the server copy would never bring it.
 */
async function resolveStale(collection: string, recordId: string, local: SyncedRecord, seqs: number[]): Promise<void> {
  const server = toLocal(collection, (await pb.collection(collection).getOne(recordId)) as unknown as PbRecord);
  const hook = collection === DOCUMENTS ? documentTypeSync((local as Document).type)?.onConflict : undefined;
  if (hook) await hook(local as Document, server as Document);
  await db().transaction("rw", db().collection(collection), db()._outbox, async () => {
    const rewritten = (await db()._outbox.where("collection").equals(collection).toArray()).some((e) => e.recordId === recordId && !seqs.includes(e.seq!));
    if (!rewritten && shouldApply(await db().collection(collection).get(recordId), server)) await db().collection(collection).put(server);
    await db()._outbox.bulkDelete(seqs);
  });
}

/**
 * Push every queued local write: one request per record. The update goes
 * straight up and the server keeps last-writer-wins — it refuses a write older
 * than its copy with 409 (`lww.pb.js`); a 404 means the record is new to it.
 * Reading the server copy first, to compare here, cost a request per record.
 *
 * One failing record (or a collection the server doesn't have yet) is skipped
 * and left queued for the next cycle — it never blocks the others. Throws at
 * the end if anything failed, so the badge shows an error while everything
 * that could sync did.
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
      try {
        await col.update(recordId, toRemote(collection, local));
      } catch (err) {
        if (isStale(err)) {
          await resolveStale(collection, recordId, local, seqs);
          moved++;
          continue;
        }
        if ((err as { status?: number }).status !== 404) throw err;
        try {
          if (collection === ATTACHMENTS) await createAttachment(recordId, local);
          else await col.create({ ...toRemote(collection, local), id: recordId });
        } catch (createErr) {
          if (isForeignRecord(createErr)) throw new ForeignRecordError(collection, recordId);
          throw createErr;
        }
      }
      await db()._outbox.bulkDelete(seqs);
      moved++;
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

const PULL_PAGE = 200;
/** Held-back ids re-fetched per request: each is one `id = …` clause of the filter. */
const HELD_CHUNK = 50;

/**
 * Store a page of pulled rows. A row with a locally-queued write is newer
 * intent and is left for push to resolve (the LWW check happens there); its id
 * is added to `held` so the server copy is fetched again once push is done.
 * The page's local rows are read in one `bulkGet` and the changed ones written
 * in one `bulkPut`: a read per row was 200 IndexedDB round trips a page.
 * Returns how many rows it wrote.
 */
async function applyPulled(name: string, items: PbRecord[], held: Set<string>): Promise<number> {
  return db().transaction("rw", db().collection(name), db()._outbox, async () => {
    const pending = new Set(
      (await db()._outbox.where("collection").equals(name).toArray()).map((e) => e.recordId),
    );
    const fresh: PbRecord[] = [];
    for (const r of items) {
      if (pending.has(r.id)) held.add(r.id);
      else {
        held.delete(r.id);
        fresh.push(r);
      }
    }
    if (!fresh.length) return 0;
    const locals = await db().collection(name).bulkGet(fresh.map((r) => r.id));
    const writes: SyncedRecord[] = [];
    fresh.forEach((r, i) => {
      const incoming = toLocal(name, r);
      if (shouldApply(locals[i], incoming)) writes.push(incoming);
    });
    if (writes.length) await db().collection(name).bulkPut(writes);
    return writes.length;
  });
}

async function pullCollection(name: string): Promise<void> {
  const cursorKey = `cursor:${name}`;
  const heldKey = `held:${name}`;
  const cursor = (await db()._meta.get(cursorKey))?.value ?? "";
  let maxUpdated = cursor;
  // Rows held back by an earlier pull, by id. Holding back the whole cursor
  // instead let one record whose push kept failing freeze it, so every cycle
  // re-downloaded a growing window; now the cursor always advances and only
  // the held rows are asked for again, by id, once their push has resolved.
  const held = new Set<string>(parseIds((await db()._meta.get(heldKey))?.value));
  const before = [...held].sort().join(",");
  if (held.size) {
    const pending = new Set((await db()._outbox.where("collection").equals(name).toArray()).map((e) => e.recordId));
    const due = [...held].filter((id) => !pending.has(id));
    // A due id the server no longer returns has nothing to wait for.
    for (const id of due) held.delete(id);
    for (let i = 0; i < due.length; i += HELD_CHUNK) {
      const chunk = due.slice(i, i + HELD_CHUNK);
      const params = Object.fromEntries(chunk.map((id, j) => [`id${j}`, id]));
      const filter = pb.filter(chunk.map((_, j) => `id = {:id${j}}`).join(" || "), params);
      const res = await pb.collection(name).getList<PbRecord>(1, HELD_CHUNK, { filter, skipTotal: true });
      moved += await applyPulled(name, res.items, held);
    }
  }
  // Keyset paging: each page starts after the last row of the one before, by
  // (updated, id). Offset paging over `updated` skipped a row for good whenever
  // an earlier one was edited mid-pull — every row after it shifted back one.
  let after: PbRecord | undefined;
  for (;;) {
    const filter = after
      ? pb.filter("updated > {:u} || (updated = {:u} && id > {:id})", { u: after.updated, id: after.id })
      : cursor
        ? pb.filter("updated > {:c}", { c: cursor })
        : "";
    const res = await pb.collection(name).getList<PbRecord>(1, PULL_PAGE, {
      filter,
      sort: "updated,id",
      skipTotal: true,
    });
    const items = res.items;
    const last = items.at(-1);
    if (!last) break;
    after = last;
    moved += await applyPulled(name, items, held);
    if (after.updated > maxUpdated) maxUpdated = after.updated;
    if (items.length < PULL_PAGE) break;
  }
  if (maxUpdated !== cursor) {
    await db()._meta.put({ key: cursorKey, value: maxUpdated });
  }
  const now = [...held].sort().join(",");
  if (now !== before) await db()._meta.put({ key: heldKey, value: JSON.stringify([...held]) });
  // "This collection has been pulled at least once" — written whether or not
  // anything came back, which the cursor above cannot say: it only advances
  // when a row arrives, so a collection the server has no rows for never
  // writes one. Anything waiting for "the server has told us what it has"
  // waits on this (see ensureDefaultWorkspace).
  await db()._meta.put({ key: pulledKey(name), value: "1" });
}

const pulledKey = (name: string) => `pulled:${name}`;

function parseIds(raw: string | undefined): string[] {
  try {
    const v: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

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

/** Records pushed, or written by a pull, since this device started. */
let moved = 0;
/** `moved` as the last pull left it: a pull that finds it unchanged moved nothing since, either way. */
let movedAtLastPull = 0;
/** Pulls in a row that found nothing moved: they stretch the wait for the next (`nextPullDelay`). */
let quietCycles = 0;
let syncing = false;
/** The cycle asked for while one ran: a full one if any trigger wanted a pull. */
let queued: "push" | "full" | null = null;
let started = false;
/** What the last pull found wrong: a push-only cycle reports it still, rather than a clean badge it cannot vouch for. */
let pullProblems: string[] = [];

export async function syncNow(): Promise<void> {
  await cycle(true);
}

/**
 * Push the outbox and pull nothing: for a device that has just written. Its
 * change reaches the server; what other devices changed waits for the next
 * pull. A trigger while a cycle runs queues one to follow it: a push, or a
 * full cycle when any trigger in between asked for a pull.
 */
export async function pushNow(): Promise<void> {
  await cycle(false);
}

async function cycle(pull: boolean): Promise<void> {
  const me = currentAccount();
  if (!me) {
    setState("unauthenticated");
    return;
  }
  if (syncing) {
    queued = pull || queued === "full" ? "full" : "push";
    return;
  }
  // Claimed before the first await: focus, online, the interval and the
  // debounce can all fire together, and two cycles pushing the same new record
  // make the second `create` fail as if the id belonged to another Account.
  syncing = true;
  // One device, one Account (ADR 0039): never push this device's rows as
  // someone else, never pull someone else's rows into them.
  try {
    const bound = await boundAccount();
    if (bound && bound.id !== me.id) {
      lastSyncError = `This device holds ${bound.email || "another account"}'s data — sign in as them, or erase it to switch`;
      listeners.forEach((l) => l());
      setState("error");
      syncing = false;
      queued = null;
      return;
    }
    if (!bound) await bindAccount(me);
  } catch (err) {
    syncing = false;
    throw err;
  }
  setState("syncing");
  const problems: string[] = [];
  try {
    try {
      await pushOnce();
    } catch (err) {
      problems.push((err as Error).message);
    }
    if (pull) {
      pullProblems = [];
      for (const name of syncedCollectionNames()) {
        try {
          await pullCollection(name);
        } catch (err) {
          // A collection missing on the server (pending migration) must not stop the others.
          pullProblems.push(isMissingCollection(err) ? `server has no "${name}" collection yet — run the PocketBase migrations` : `${name}: ${(err as Error).message}`);
        }
      }
    }
    problems.push(...pullProblems);
    if (pull) {
      quietCycles = moved === movedAtLastPull ? quietCycles + 1 : 0;
      movedAtLastPull = moved;
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
    const next = queued;
    queued = null;
    if (next) void cycle(next === "full");
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Nudge the engine after a local write (debounced): a push, and no pull. A
 * typing pause used to run a whole cycle — the push, then every collection
 * pulled — a dozen requests for one edit. Other devices' changes arrive with
 * the interval, focus and online triggers.
 */
export function requestSync(): void {
  void refreshPending();
  if (!started) return;
  wakeUp();
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => void pushNow(), 400);
}

/**
 * How long the engine waits before the next pull, by how many pulls in a row
 * found nothing moved either way: 30 s while things change, stretching to 5
 * minutes when nothing does. A local write, a remote change, focus or the tab
 * coming back sets it to 30 s again.
 */
const PULL_DELAYS_MS = [30_000, 30_000, 60_000, 120_000, 300_000];
/** Two triggers this close together (focus and visibilitychange on the same return) pull once. */
const WAKE_DEDUPE_MS = 2_000;

let pullTimer: ReturnType<typeof setTimeout> | null = null;
let lastWake = 0;

export function nextPullDelay(quiet: number): number {
  return PULL_DELAYS_MS[Math.min(quiet, PULL_DELAYS_MS.length - 1)];
}

const hidden = () => typeof document !== "undefined" && document.visibilityState === "hidden";

/**
 * The next pull. A hidden tab schedules none: it pulls nothing, which on a
 * phone was a battery drain and on the server idle load; it pulls again on
 * coming back (`visibilitychange`).
 */
function schedulePull(): void {
  if (pullTimer) clearTimeout(pullTimer);
  pullTimer = null;
  if (hidden()) return;
  pullTimer = setTimeout(() => void pullAndReschedule(), nextPullDelay(quietCycles));
}

async function pullAndReschedule(): Promise<void> {
  if (hidden()) return;
  await syncNow();
  schedulePull();
}

/** Back to the short wait, without pulling now: a local write pushes on its own. */
function wakeUp(): void {
  if (quietCycles === 0) return;
  quietCycles = 0;
  schedulePull();
}

/** Something says the world may have moved (focus, back online, the tab shown): pull now, and keep pulling often. */
function wake(): void {
  if (hidden()) return;
  const now = Date.now();
  if (now - lastWake < WAKE_DEDUPE_MS) return;
  lastWake = now;
  quietCycles = 0;
  void pullAndReschedule();
}

export function startSync(): void {
  // The Demo has no backend (ADR 0077): local writes fill the outbox, which nothing drains.
  if (started || isDemo()) return;
  started = true;
  wake();
  window.addEventListener("online", wake);
  window.addEventListener("focus", wake);
  document.addEventListener("visibilitychange", wake);
}
