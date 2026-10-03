import type { Table } from "dexie";
import { useLiveQuery } from "dexie-react-hooks";
import { ATTACHMENTS, db, DOCUMENTS, type SyncedRecord } from "../data/db";
import { sharedLiveQuery } from "../data/live";
import { put, remove } from "../data/repo";
import { newId } from "../ids";
import { todayStr } from "../dates";
import { normalizeTags } from "../tags";
import { extractLinks, extractProseTags, isImageEmbed, normalizeName } from "../markdown";
import { normalizeFolder } from "../folders";
import { documentTypeSync } from "./registry";
import { inPrivateFolder, privateGate, visibleUnder } from "../private";
import { onWorkspaceChange, useCurrentWorkspaceId, workspaceScope } from "../workspaces";
import type { Document } from "./types";

/**
 * The Document store (ADR 0018): one Dexie table, one PocketBase collection.
 * Apps read/write their own types through these helpers and never touch
 * another type's semantics (ADR 0019); generic tooling (Bases, Vault, links)
 * reads any type.
 */

export function documentsTable(): Table<Document, string> {
  return db().table(DOCUMENTS) as Table<Document, string>;
}

/**
 * A Document is in scope when its `workspace` matches the current one exactly:
 * "" — shared — inside an unseparated Workspace, the Workspace's own id inside
 * a separated one. A strict partition and never a union, which is the whole of
 * separation (ADR 0048): a separated Workspace does not also see the shared
 * content, which is why turning separation on starts a Workspace empty and
 * content crosses only by being moved.
 */
export function inScope(doc: Pick<Document, "workspace">, scope: string): boolean {
  return (doc.workspace ?? "") === scope;
}

/**
 * The two gates (ADR 0038, ADR 0048): every read below drops the Documents of
 * the Private folder while it is locked, and the Documents of every Workspace
 * but this one. This is the one choke point — no surface checks either gate
 * itself, and nothing reads around them.
 */
async function gated<T extends Document>(rows: T[]): Promise<T[]> {
  const scope = await workspaceScope();
  return visibleUnder(rows, await privateGate()).filter((r) => inScope(r, scope));
}

/** Live rows of one type (tombstones excluded). */
export async function documentsOf<T extends Document = Document>(type: string): Promise<T[]> {
  return gated((await documentsTable().where("[type+deleted]").equals([type, 0]).toArray()) as T[]);
}

/** Rows of one type where an indexed field equals a value (`indexes` on the type def). */
export async function documentsWhere<T extends Document = Document>(type: string, field: string, value: unknown): Promise<T[]> {
  const rows = (await documentsTable().where(`[type+${field}]`).equals([type, value as string]).toArray()) as T[];
  return gated(rows.filter((r) => !r.deleted));
}

export async function getDocument<T extends Document = Document>(id: string): Promise<T | undefined> {
  const d = (await documentsTable().get(id)) as T | undefined;
  if (!d || d.deleted) return undefined;
  if (inPrivateFolder(d.folder) && (await privateGate()).locked) return undefined;
  if (!inScope(d, await workspaceScope())) return undefined;
  return d;
}

/** Every live Document of every type — for cross-type tooling only (Bases, links, tags). */
export async function allDocuments(): Promise<Document[]> {
  return gated(await documentsTable().where("deleted").equals(0).toArray());
}

// The Workspace is a dependency of every read below although no table holds
// it (it lives in memory, per device): a switch must re-run them, or each list
// keeps showing the Workspace it was first read in.

/**
 * Every live Document of every Workspace, still behind the Private gate. Only
 * for whole-Account checks that must never act on one Workspace's view alone —
 * an Attachment some other Workspace's body embeds is not an orphan.
 */
export async function allDocumentsEveryWorkspace(): Promise<Document[]> {
  return visibleUnder(await documentsTable().where("deleted").equals(0).toArray(), await privateGate());
}

/** React hook: live rows of one type. */
export function useDocuments<T extends Document = Document>(type: string | undefined): T[] {
  const wsId = useCurrentWorkspaceId();
  return useLiveQuery(async () => (type ? await documentsOf<T>(type) : ([] as T[])), [type, wsId], [] as T[]);
}

/** React hook: one Document by id (undefined while loading / when missing). */
export function useDocument<T extends Document = Document>(id: string | undefined): T | undefined {
  const wsId = useCurrentWorkspaceId();
  return useLiveQuery(async () => (id ? await getDocument<T>(id) : undefined), [id, wsId], undefined);
}

const allLive = sharedLiveQuery(async () => allDocuments(), [] as Document[], { restartOn: onWorkspaceChange });

/** React hook: every live Document (cross-type tooling). One shared query: every consumer sees the same array per change. */
export function useAllDocuments(): Document[] {
  return allLive.use();
}

/** Effective tags: the explicit list ∪ `#tags` in the body, normalised. */
export function effectiveTags(explicit: readonly string[] | undefined, body: string | undefined): string[] {
  return normalizeTags([...(explicit ?? []), ...(body ? extractProseTags(body) : [])]);
}

export type DocumentInput<T extends Document = Document> = Omit<T, "id" | "updatedAt" | "deleted" | "tags" | "folder" | "createdAt" | "title"> &
  Partial<Pick<T, "id" | "tags" | "folder" | "createdAt" | "title">> & { type: string };

/**
 * Write a Document: fills common keys (id, createdAt, folder, derived title),
 * recomputes tags from the body, stamps the LWW clock and queues the push.
 * Returns the stored row.
 *
 * This is also where separation is **written** (ADR 0048): a new Document takes
 * the scope of the Workspace it is made in, so a separated Workspace holds what
 * it creates and an unseparated one shares it. One choke point, as the read has
 * one — every creation path in the app, from a capture Command to a Base's new
 * row, arrives here. An existing row keeps the scope it has, so an edit never
 * moves a Document between Workspaces; only `moveDocumentToWorkspace` does.
 */
export async function putDocument<T extends Document = Document>(input: DocumentInput<T>): Promise<T> {
  const def = documentTypeSync(input.type);
  const id = input.id ?? newId();
  const body = def?.body === "none" ? undefined : (input.body as string | undefined);
  const row = {
    ...input,
    id,
    createdAt: input.createdAt ?? todayStr(),
    folder: normalizeFolder(input.folder ?? ""),
    tags: effectiveTags(input.tags, body),
    title: input.title ?? "",
    workspace: input.workspace ?? (await workspaceScope()),
  } as unknown as T;
  if (body === undefined) delete (row as Document).body;
  else (row as Document).body = body;
  if (!row.title && def?.titleOf) row.title = def.titleOf(row);
  await put<T>(DOCUMENTS, row);
  return row;
}

/** Tombstone a Document (never a hard delete). */
export async function removeDocument(id: string): Promise<void> {
  // The type's cascade first (ADR 0045): whatever exists only in service of
  // this Document goes with it, from every place a Document can be deleted.
  // `removeDocumentsWhere` below tombstones directly, so a cascade that uses
  // it cannot re-enter this.
  const doc = await documentsTable().get(id);
  if (doc && !doc.deleted) await documentTypeSync(doc.type)?.onDelete?.(doc);
  await remove(DOCUMENTS, id);
}

/** Tombstone every live Document of a type matching a predicate (cascades: a Task's overrides, a Writing's Versions). */
export async function removeDocumentsWhere(type: string, pred: (d: Document) => boolean): Promise<void> {
  const rows = await documentsOf(type);
  for (const r of rows) if (pred(r)) await remove(DOCUMENTS, r.id);
}

/** Patch plain fields of a Document (Bases, generic forms). Guarded fields are the caller's responsibility to exclude. */
export async function patchDocument(id: string, patch: Record<string, unknown>): Promise<void> {
  const existing = await documentsTable().get(id);
  if (!existing || existing.deleted) return;
  await putDocument({ ...existing, ...patch } as DocumentInput);
}


/**
 * Move Documents into a Workspace, or out to the shared content with `""`.
 * The only way content crosses a separation boundary (ADR 0048) — a sealed box
 * you cannot put anything into is a box you cannot use, which is why this
 * ships with separation rather than after it.
 *
 * Reads the rows directly rather than through `gated`: moving *out* of the
 * current Workspace means writing rows the gate is about to stop showing, and
 * releasing a Workspace on delete means writing rows it never showed here.
 */
export async function moveDocumentsToWorkspace(ids: string[], workspace: string): Promise<void> {
  // A type may name what goes with its Documents (a Project's Tasks): moved in
  // the same act, so nothing is left behind pointing across the boundary.
  const all = new Set(ids);
  for (const id of ids) {
    const doc = await documentsTable().get(id);
    if (!doc || doc.deleted) continue;
    for (const f of (await documentTypeSync(doc.type)?.followers?.(doc)) ?? []) all.add(f);
  }
  const bodies: string[] = [];
  for (const id of all) {
    const doc = await documentsTable().get(id);
    if (!doc || doc.deleted || (doc.workspace ?? "") === workspace) continue;
    await put<Document>(DOCUMENTS, { ...doc, workspace });
    if (typeof doc.body === "string" && doc.body) bodies.push(doc.body);
  }
  // Attachments follow the Document that embeds them (ADR 0048). Left behind,
  // the moved body could not resolve its images, and "Clean up attachments"
  // in either Workspace took them for orphans.
  if (!bodies.length) return;
  type AttachmentRow = SyncedRecord & { name: string; workspace?: string };
  const rows = await db().collection<AttachmentRow>(ATTACHMENTS).where("deleted").equals(0).toArray();
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const id of attachmentsFollowing(rows, bodies, workspace)) await put<AttachmentRow>(ATTACHMENTS, { ...byId.get(id)!, workspace });
}

/** Ids of the live Attachments these bodies embed that are not in `workspace` yet. Pure. */
export function attachmentsFollowing(
  attachments: readonly { id: string; name: string; workspace?: string; deleted: 0 | 1 }[],
  bodies: readonly string[],
  workspace: string,
): string[] {
  const embedded = new Set<string>();
  for (const body of bodies) for (const l of extractLinks(body)) if (isImageEmbed(l)) embedded.add(normalizeName(l.name));
  return attachments.filter((a) => !a.deleted && (a.workspace ?? "") !== workspace && embedded.has(normalizeName(a.name))).map((a) => a.id);
}

/** Every Document a Workspace holds — ungated, for the move dialog and for release on delete. */
export async function documentsHeldBy(workspace: string): Promise<Document[]> {
  return (await documentsTable().where("workspace").equals(workspace).toArray()).filter((d) => !d.deleted);
}

/** Release everything a Workspace holds back to the shared content (ADR 0048's delete). */
export async function releaseWorkspaceDocuments(workspace: string): Promise<void> {
  if (!workspace) return;
  const held = await documentsHeldBy(workspace);
  await moveDocumentsToWorkspace(held.map((d) => d.id), "");
}
