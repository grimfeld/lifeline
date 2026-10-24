import "fake-indexeddb/auto";
import { parentPort, workerData } from "node:worker_threads";
import { db, initApps, lastSyncError, pb, pushNow, syncNow } from "@lifeline/core";
import { manifests } from "./apps";
import { unsyncedWrite } from "./devices";
import { listMacroTools, runTool, ToolError } from "./handlers";

/**
 * One Account's headless device (ADR 0062). A worker thread has its own
 * module instances and its own in-memory IndexedDB, so Core's singletons — the
 * database, the PocketBase client, the current Workspace — are this Account's
 * alone. It syncs like any phone or laptop: pull before a call, push after a
 * write, last write wins. A write only pushes: what other devices changed
 * arrives with the next call's pull, not as a second round of every collection.
 */

export interface DeviceAuth {
  token: string;
  record: { id: string; email: string; collectionId: string; collectionName: string };
}

export type DeviceRequest =
  | { id: number; kind: "call"; tool: string; args: Record<string, unknown>; write: boolean; auth: DeviceAuth }
  | { id: number; kind: "flush"; auth: DeviceAuth }
  /** The Account's Macro tools (tools.ts `macroTools`), for the server to list beside its own. */
  | { id: number; kind: "macro-tools"; auth: DeviceAuth };

export type DeviceResponse =
  | { id: number; ok: true; result: unknown; pending: number }
  | { id: number; ok: false; error: string; expected: boolean; pending: number };

/**
 * How old the last pull may be before a call pulls again. A read tolerates a
 * few seconds' staleness — an agent's burst of searches and gets shares one
 * pull instead of each paying a round of every collection. A write acts on
 * what it reads (last write wins), so it keeps the short window.
 */
const READ_FRESH_MS = 15_000;
const WRITE_FRESH_MS = 2_000;

const { pbUrl } = workerData as { pbUrl: string };
initApps(manifests);
pb.baseURL = pbUrl;
pb.autoCancellation(false);

let lastPull = 0;
let pulledOnce = false;

function adoptAuth(auth: DeviceAuth): void {
  if (pb.authStore.token !== auth.token) pb.authStore.save(auth.token, auth.record as never);
}

async function sync(): Promise<void> {
  await syncNow();
  lastPull = Date.now();
  // The first pull is the whole Account: without it every read would be empty, not just stale.
  if (!pulledOnce) {
    if (lastSyncError && (await db().documents.count()) === 0) throw new Error(`Could not load the Account: ${lastSyncError}`);
    pulledOnce = true;
  }
}

async function handle(req: DeviceRequest): Promise<DeviceResponse> {
  const pending = async () => db()._outbox.count();
  try {
    adoptAuth(req.auth);
    if (req.kind === "flush") {
      await pushNow();
      return { id: req.id, ok: true, result: null, pending: await pending() };
    }
    if (req.kind === "macro-tools") {
      if (Date.now() - lastPull > READ_FRESH_MS) await sync();
      return { id: req.id, ok: true, result: await listMacroTools(), pending: await pending() };
    }
    if (Date.now() - lastPull > (req.write ? WRITE_FRESH_MS : READ_FRESH_MS)) await sync();
    const result = await runTool(req.tool, req.args);
    let unsynced: object | undefined;
    if (req.write) {
      await pushNow();
      if ((await pending()) > 0) unsynced = unsyncedWrite(lastSyncError);
    }
    return { id: req.id, ok: true, result: unsynced ? { ...(result as object), ...unsynced } : result, pending: await pending() };
  } catch (err) {
    return { id: req.id, ok: false, error: (err as Error).message ?? String(err), expected: err instanceof ToolError, pending: await pending().catch(() => -1) };
  }
}

// One call at a time: Core's operations assume a single user acting.
let chain: Promise<unknown> = Promise.resolve();
parentPort!.on("message", (req: DeviceRequest) => {
  chain = chain.then(async () => parentPort!.postMessage(await handle(req)));
});
