import { useSyncExternalStore } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, DOCUMENTS } from "./data/db";
import { sharedLiveQuery } from "./data/live";
import { put, remove } from "./data/repo";
import { newId } from "./ids";
import { docPath, isWithin } from "./folders";
import { normalizeName } from "./markdown";
import type { Document, DocumentTypeDef } from "./documents/types";
import { isVaultType } from "./documents/registry";
import { onWorkspaceChange, workspaceScope } from "./workspaces";

/**
 * The Private folder (ADR 0038, CONTEXT.md "Private folder", "Locked /
 * Unlocked"): one reserved Folder whose Documents Core's store drops from
 * every read while the gate is **locked**. A gate, not a safe (ADR 0105):
 * bytes stay plain on the device and the server, and the password's hash
 * syncs in a Document. It keeps eyes at the screen and agents (the MCP
 * server's own checks) away from them; this module only decides what a read
 * may see, keeps the lock state and the idle timeout, and checks the
 * password. Nothing outside Core reads around it, on purpose.
 */

export const PRIVATE_FOLDER = "Private";

/** True for the Private folder and everything below it. */
export function inPrivateFolder(folder: string): boolean {
  return isWithin(folder, PRIVATE_FOLDER);
}

/** Types that may live in Private: body-first ones (Note, Clipping, Writing…). A hidden Task is lost work, not privacy. */
export function mayBePrivate(def: DocumentTypeDef | undefined): boolean {
  return !!def && isVaultType(def);
}

// --- settings: one internal Document, owned by the Notes App, found by type ---

export const PRIVATE_SETTINGS_TYPE = "private_settings";
/** The first release used a `:` id PocketBase refuses; see repairPrivateSettings. */
const LEGACY_SETTINGS_ID = "private:settings";

/**
 * The one settings Document of this type. Found by type, never by a fixed
 * id: every Account has its own, and a shared fixed id could only ever be
 * created once on the server (ADR 0039).
 */
async function settingsRow(): Promise<PrivateSettings | undefined> {
  // Deliberately scope-blind (ADR 0048). Separation partitions Documents, and
  // ADR 0039 replaced fixed-id singletons with "the one Document of that type"
  // — which, under a partition, would silently become one *per Workspace*.
  // The Private folder is an Account-level gate with one password on every
  // device (CONTEXT.md "Private folder"), not a per-Workspace one, so this
  // lookup reads past the scope and the row it finds is written shared below.
  return (await db().documents.where("[type+deleted]").equals([PRIVATE_SETTINGS_TYPE, 0]).first()) as PrivateSettings | undefined;
}

/**
 * One-time local repair: a settings row under the old, unsyncable id is
 * re-keyed to a valid one and the old row dropped for good (its queued
 * push goes with it — the outbox forgets entries whose row is gone). Run
 * once at startup, never inside a live query.
 */
export async function repairPrivateSettings(): Promise<void> {
  const d = db();
  const old = (await d.documents.get(LEGACY_SETTINGS_ID)) as PrivateSettings | undefined;
  if (!old) return;
  if (!old.deleted && old.type === PRIVATE_SETTINGS_TYPE && !(await settingsRow())) {
    await put<PrivateSettings>(DOCUMENTS, { ...old, id: newId(), workspace: "" });
  }
  await d.documents.delete(LEGACY_SETTINGS_ID);
}

export interface PrivateSettings extends Document {
  type: typeof PRIVATE_SETTINGS_TYPE;
  /** Base64 salt. */
  salt: string;
  /** Base64 PBKDF2-SHA256 derivation of the password. */
  hash: string;
  iterations: number;
}

// --- lock state -----------------------------------------------------------------

const UNLOCK_KEY = "private:unlocked";
/**
 * Unlocking writes this page load's token to `_meta`; a read is unlocked only
 * while the stored token is this one. A reload mints a new token, so the
 * store is locked again without anything having to run first (memory-only
 * semantics on top of a table live queries can observe).
 */
const bootToken = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export interface PrivateGate {
  /** A password has been set (the settings Document exists). */
  configured: boolean;
  /** Private Documents are absent from reads right now. */
  locked: boolean;
}

/**
 * What the store may show. Not set up → open, except before the first pull
 * of `documents` on this device, when a Private folder that already has
 * Documents stays locked (the safe default: the settings may simply not have
 * arrived yet).
 */
export async function privateGate(): Promise<PrivateGate> {
  const d = db();
  const configured = !!(await settingsRow());
  if (configured) {
    const unlocked = (await d._meta.get(UNLOCK_KEY))?.value === bootToken;
    return { configured, locked: !unlocked };
  }
  const pulled = !!(await d._meta.get(`cursor:${DOCUMENTS}`))?.value;
  if (pulled) return { configured: false, locked: false };
  const any = await d.documents.where("folder").startsWith(PRIVATE_FOLDER).filter((r) => !r.deleted && inPrivateFolder(r.folder)).first();
  return { configured: false, locked: !!any };
}

/** Rows a locked gate lets through. Pure. */
export function visibleUnder<T extends Pick<Document, "folder">>(rows: T[], gate: PrivateGate): T[] {
  return gate.locked ? rows.filter((r) => !inPrivateFolder(r.folder)) : rows;
}

/** React hook: the gate, live. */
export function usePrivateGate(): PrivateGate {
  return useLiveQuery(privateGate, [], { configured: false, locked: false } as PrivateGate);
}

export async function lockPrivate(): Promise<void> {
  stopIdleWatch();
  await db()._meta.put({ key: UNLOCK_KEY, value: "" });
}

async function unlock(): Promise<void> {
  await db()._meta.put({ key: UNLOCK_KEY, value: bootToken });
  startIdleWatch();
}

// --- idle timeout: ten minutes without input, or that long in the background, locks again ---

export const PRIVATE_IDLE_MS = 10 * 60 * 1000;
let lastActivity = 0;
let idleTimer: ReturnType<typeof setInterval> | null = null;
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "touchstart", "wheel"] as const;
const touch = () => {
  lastActivity = Date.now();
};
const check = () => {
  if (Date.now() - lastActivity >= PRIVATE_IDLE_MS) void lockPrivate();
};
const onVisible = () => {
  if (document.visibilityState === "visible") check();
};

function startIdleWatch(): void {
  if (typeof window === "undefined") return;
  stopIdleWatch();
  lastActivity = Date.now();
  for (const e of ACTIVITY_EVENTS) window.addEventListener(e, touch, { passive: true });
  document.addEventListener("visibilitychange", onVisible);
  idleTimer = setInterval(check, 15_000);
}

function stopIdleWatch(): void {
  if (typeof window === "undefined") return;
  for (const e of ACTIVITY_EVENTS) window.removeEventListener(e, touch);
  document.removeEventListener("visibilitychange", onVisible);
  if (idleTimer) clearInterval(idleTimer);
  idleTimer = null;
}

// --- password ---------------------------------------------------------------------

const ITERATIONS = 150_000;

function b64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function unb64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

export async function derivePrivateHash(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password.normalize("NFKC")), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations }, key, 256);
  return b64(new Uint8Array(bits));
}

/** Set (or replace) the password and unlock. Adopts an existing plain `Private` folder as is. */
export async function setPrivatePassword(password: string): Promise<void> {
  if (!password) throw new Error("A password is needed");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePrivateHash(password, salt, ITERATIONS);
  const cur = await settingsRow();
  const row: PrivateSettings = {
    id: cur?.id ?? newId(),
    type: PRIVATE_SETTINGS_TYPE,
    title: "Private notes",
    tags: [],
    folder: "",
    createdAt: cur?.createdAt ?? new Date().toISOString().slice(0, 10),
    updatedAt: "",
    deleted: 0,
    salt: b64(salt),
    hash,
    iterations: ITERATIONS,
    // Shared, never held: one password for the Account, not one per Workspace.
    workspace: "",
  };
  await put<PrivateSettings>(DOCUMENTS, row);
  await unlock();
}

/** Wrong tries in a row, kept on the device so a reload does not reset the wait (#271). */
const FAILURES_KEY = "private:failures";

/** The wait before trying again after `failures` wrong tries in a row: 0.5 s, doubling, at most 8 s. */
export function unlockDelayMs(failures: number): number {
  return failures > 0 ? Math.min(8000, 500 * 2 ** (failures - 1)) : 0;
}

/** Check the password; on success the gate opens. Wrong tries wait a little longer each time. */
export async function unlockPrivate(password: string): Promise<boolean> {
  const row = await settingsRow();
  if (!row) return false;
  const d = db();
  const failures = Number((await d._meta.get(FAILURES_KEY))?.value) || 0;
  const delay = unlockDelayMs(failures);
  if (delay) await new Promise((r) => setTimeout(r, delay));
  const hash = await derivePrivateHash(password, unb64(row.salt), row.iterations || ITERATIONS);
  if (hash !== row.hash) {
    await d._meta.put({ key: FAILURES_KEY, value: String(failures + 1) });
    return false;
  }
  await d._meta.delete(FAILURES_KEY);
  await unlock();
  return true;
}

/** Forget the password: `Private` becomes a plain folder again; nothing is deleted or moved. */
export async function disablePrivate(): Promise<void> {
  const row = await settingsRow();
  if (row) await remove(DOCUMENTS, row.id);
  await lockPrivate();
}

// --- what a locked reader may still learn: that a name or id is behind the gate ---

export interface PrivateLockedRefs {
  /** Normalised titles and paths of locked Documents — so a link shows a lock, not a hole. */
  names: ReadonlySet<string>;
  ids: ReadonlySet<string>;
}
const NO_REFS: PrivateLockedRefs = { names: new Set(), ids: new Set() };

/**
 * The one sanctioned peek behind the gate: membership only, never rows.
 * Empty while unlocked (nothing is hidden then).
 */
export async function privateLockedRefs(): Promise<PrivateLockedRefs> {
  const gate = await privateGate();
  if (!gate.locked) return NO_REFS;
  // Scoped like every other read (ADR 0048): a link in this Workspace must not
  // report another Workspace's private note as "locked" — outside its scope the
  // target does not exist at all, which is a different answer.
  const scope = await workspaceScope();
  const rows = (await db().documents.where("folder").startsWith(PRIVATE_FOLDER).filter((r) => !r.deleted && inPrivateFolder(r.folder)).toArray())
    .filter((r) => (r.workspace ?? "") === scope);
  const names = new Set<string>();
  const ids = new Set<string>();
  for (const r of rows) {
    ids.add(r.id);
    if (r.title) {
      names.add(normalizeName(r.title));
      names.add(normalizeName(docPath(r)));
    }
  }
  return { names, ids };
}

// One shared query: the link index caches on the identity of these sets, and a
// query per consumer handed each one its own, so every consumer rebuilt the
// whole index on every change while Private was locked.
// Scoped to the Workspace, so a switch re-runs it.
const lockedRefsLive = sharedLiveQuery(async () => privateLockedRefs(), NO_REFS, { restartOn: onWorkspaceChange });

/** React hook: the locked membership sets, live. One shared query: every consumer sees the same sets per change. */
export function usePrivateLockedRefs(): PrivateLockedRefs {
  return lockedRefsLive.use();
}

// --- write guards (Core ops call these) -----------------------------------------

/** Refuse a Document landing in Private while locked, or one of a type that may not live there. */
export async function assertMayEnterPrivate(folder: string, def: DocumentTypeDef | undefined): Promise<void> {
  if (!inPrivateFolder(folder)) return;
  if (!mayBePrivate(def)) throw new Error(`Only notes and other written Documents can live in ${PRIVATE_FOLDER}`);
  if ((await privateGate()).locked) throw new Error(`Unlock ${PRIVATE_FOLDER} first`);
}

/** The Private folder itself is reserved once set up: no rename, move or delete. */
export async function assertNotReservedFolder(path: string): Promise<void> {
  if (path === PRIVATE_FOLDER && (await privateGate()).configured) throw new Error(`${PRIVATE_FOLDER} is reserved`);
}

// --- dialog requests: any surface may ask the shell to show the unlock/setup dialog ---

export type PrivateDialogKind = "setup" | "unlock" | "change" | "disable";
let dialogRequest: PrivateDialogKind | null = null;
const dialogListeners = new Set<() => void>();

export function openPrivateDialog(kind: PrivateDialogKind): void {
  dialogRequest = kind;
  dialogListeners.forEach((l) => l());
}
export function closePrivateDialog(): void {
  dialogRequest = null;
  dialogListeners.forEach((l) => l());
}
export function usePrivateDialogRequest(): PrivateDialogKind | null {
  return useSyncExternalStore(
    (l) => {
      dialogListeners.add(l);
      return () => void dialogListeners.delete(l);
    },
    () => dialogRequest,
    () => null,
  );
}
