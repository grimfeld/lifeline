import { useSyncExternalStore } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, WORKSPACES, type SyncedRecord, type UserScreen } from "./data/db";
import { all, put } from "./data/repo";
import { newId } from "./ids";
import { MODULES } from "./manifest";

/**
 * Workspaces (ADR 0047): a user-created, named set of Modules, with the option
 * — off by default — to keep its content to itself (ADR 0048).
 *
 * Two things a Workspace decides, and they must not be confused:
 *
 * - **Modules scope chrome.** Which App screens, Bases and capture Commands
 *   this Workspace lists. Never what a Surface, the Vault or the palette may
 *   reach.
 * - **Separation scopes data.** See `workspaceScope` below and the gate in
 *   documents/store.ts.
 */

export interface WorkspaceRecord extends SyncedRecord {
  name: string;
  /** Module ids, in the user's own order — the phone's bar takes the first three. */
  modules: string[];
  /** Off by default. When on, this Workspace reads and writes only what it holds. */
  separated?: boolean;
  sort: number;
}

/**
 * The scope a Workspace reads and writes under: its own id when separated,
 * "" — shared — when not. This is the whole of separation: a strict partition
 * where every Document carries exactly one of these and a read matches it
 * exactly (ADR 0048). Not a union: a separated Workspace does *not* also see
 * the shared content.
 */
export function scopeOf(ws: WorkspaceRecord | undefined): string {
  return ws?.separated ? ws.id : "";
}

// --- which Workspace this device is in (per-device, never synced) ---

const CURRENT_KEY = "lifeline.workspace.current";
const listeners = new Set<() => void>();
let currentId = read();

function read(): string {
  try {
    return localStorage.getItem(CURRENT_KEY) ?? "";
  } catch {
    return "";
  }
}

/**
 * Which Workspace this device is in. Per-device and unsynced, like the
 * sidebar's collapsed sections and the Frame's last location (ADR 0041): the
 * Workspace *definitions* travel between devices, sitting in one of them does
 * not.
 */
export function currentWorkspaceId(): string {
  return currentId;
}

export function setCurrentWorkspace(id: string): void {
  if (id === currentId) return;
  currentId = id;
  try {
    localStorage.setItem(CURRENT_KEY, id);
  } catch {
    /* private mode: the choice lasts the session */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useCurrentWorkspaceId(): string {
  return useSyncExternalStore(subscribe, currentWorkspaceId, () => "");
}

// --- reading them ---

export async function allWorkspaces(): Promise<WorkspaceRecord[]> {
  return (await all<WorkspaceRecord>(WORKSPACES)).sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
}

/**
 * The Workspace this device is in — the remembered one, or the first by sort
 * when that id names nothing (it was deleted on another device, or this device
 * has never chosen). Undefined only before the first one exists.
 */
export async function currentWorkspace(): Promise<WorkspaceRecord | undefined> {
  const list = await allWorkspaces();
  return list.find((w) => w.id === currentWorkspaceId()) ?? list[0];
}

/** The read/write scope in force on this device right now (see scopeOf). */
export async function workspaceScope(): Promise<string> {
  return scopeOf(await currentWorkspace());
}

export function useWorkspaces(): WorkspaceRecord[] {
  return useLiveQuery(allWorkspaces, [], [] as WorkspaceRecord[]);
}

export function useCurrentWorkspace(): WorkspaceRecord | undefined {
  const id = useCurrentWorkspaceId();
  return useLiveQuery(currentWorkspace, [id], undefined);
}

/** The current Workspace's Modules, in the user's order, dropping any Core no longer defines. */
export function useWorkspaceModules(): string[] {
  const ws = useCurrentWorkspace();
  const known = new Set(MODULES.map((m) => m.id));
  return (ws?.modules ?? []).filter((m) => known.has(m));
}

/** Whether the current Workspace holds a Module — the one question chrome asks. */
export function useHasModule(moduleId: string | undefined): boolean {
  const modules = useWorkspaceModules();
  return !moduleId || modules.includes(moduleId);
}

// --- writing them ---

export async function saveWorkspace(ws: Omit<WorkspaceRecord, "updatedAt" | "deleted"> & Partial<SyncedRecord>): Promise<void> {
  await put<WorkspaceRecord>(WORKSPACES, ws);
}

export async function createWorkspace(name: string, modules: string[], separated = false): Promise<WorkspaceRecord> {
  const list = await allWorkspaces();
  const ws: WorkspaceRecord = {
    id: newId(),
    name,
    modules,
    separated,
    sort: (list[list.length - 1]?.sort ?? 0) + 1,
    updatedAt: new Date().toISOString(),
    deleted: 0,
  };
  await saveWorkspace(ws);
  return ws;
}

/**
 * The one Workspace a fresh account starts with: every Module, unseparated,
 * so the app before Workspaces and the app after it are the same app until a
 * second Workspace is made (ADR 0047).
 *
 * Existing accounts are migrated server-side instead (PocketBase migration
 * 1757200000), so this only ever fires for a genuinely empty account — and it
 * is guarded on the workspaces collection having been pulled at least once,
 * or a device that signs in before its first sync would make a second
 * "Personal" beside the one the server already has.
 */
export async function ensureDefaultWorkspace(): Promise<void> {
  if ((await allWorkspaces()).length > 0) return;
  const pulled = await db()._meta.get(`cursor:${WORKSPACES}`);
  if (!pulled) return;
  await createWorkspace(
    "Personal",
    MODULES.map((m) => m.id),
  );
}

/**
 * Deleting a Workspace **releases** rather than destroys (ADR 0048): what it
 * held becomes shared, its Screens move to the Workspace left behind, and only
 * then does the Workspace go. A container never takes down content with a life
 * of its own — deleting a Workout keeps its Sessions — and the Workspace is the
 * only thing here without one.
 *
 * Refuses the last Workspace: there is always at least one, which is what
 * spares the whole app a second code path for having none.
 */
export async function deleteWorkspace(id: string, releaseDocuments: (scope: string) => Promise<void>): Promise<void> {
  const list = await allWorkspaces();
  if (list.length < 2) throw new Error("The last Workspace cannot be deleted");
  const ws = list.find((w) => w.id === id);
  if (!ws) return;
  const fallback = list.find((w) => w.id !== id)!;

  // Held Documents first: if this half fails, the Workspace is still there to
  // reach them through. Doing it the other way round strands them.
  if (ws.separated) await releaseDocuments(ws.id);

  const screens = (await all<UserScreen>("screens")).filter((s) => s.workspace === id);
  for (const s of screens) {
    await put<UserScreen>("screens", { ...s, workspace: fallback.id, phoneHome: false });
  }

  await put<WorkspaceRecord>(WORKSPACES, { ...ws, deleted: 1 });
  if (currentWorkspaceId() === id) setCurrentWorkspace(fallback.id);
}
