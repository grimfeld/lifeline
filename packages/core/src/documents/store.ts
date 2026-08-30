import type { Table } from "dexie";
import { useLiveQuery } from "dexie-react-hooks";
import { db, DOCUMENTS } from "../data/db";
import { sharedLiveQuery } from "../data/live";
import { put, remove } from "../data/repo";
import { newId } from "../ids";
import { todayStr } from "../dates";
import { normalizeTags } from "../tags";
import { extractProseTags } from "../markdown";
import { normalizeFolder } from "../folders";
import { documentTypeSync } from "./registry";
import { inPrivateFolder, privateGate, visibleUnder } from "../private";
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
 * The Private gate (ADR 0038): every read below drops the Documents of the
 * Private folder while it is locked. This is the one choke point — no
 * surface checks the gate itself, and nothing reads around it.
 */
async function gated<T extends Document>(rows: T[]): Promise<T[]> {
  return visibleUnder(rows, await privateGate());
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
  return d;
}

/** Every live Document of every type — for cross-type tooling only (Bases, links, tags). */
export async function allDocuments(): Promise<Document[]> {
  return gated(await documentsTable().where("deleted").equals(0).toArray());
}

/** React hook: live rows of one type. */
export function useDocuments<T extends Document = Document>(type: string | undefined): T[] {
  return useLiveQuery(async () => (type ? await documentsOf<T>(type) : ([] as T[])), [type], [] as T[]);
}

/** React hook: one Document by id (undefined while loading / when missing). */
export function useDocument<T extends Document = Document>(id: string | undefined): T | undefined {
  return useLiveQuery(async () => (id ? await getDocument<T>(id) : undefined), [id], undefined);
}

const allLive = sharedLiveQuery(() => allDocuments(), [] as Document[]);

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
  } as unknown as T;
  if (body === undefined) delete (row as Document).body;
  else (row as Document).body = body;
  if (!row.title && def?.titleOf) row.title = def.titleOf(row);
  await put<T>(DOCUMENTS, row);
  return row;
}

/** Tombstone a Document (never a hard delete). */
export async function removeDocument(id: string): Promise<void> {
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
