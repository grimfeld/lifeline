import { useEffect, useReducer } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../data/db";
import { renameLinks } from "../markdown";
import { renderTemplate } from "../templates";
import { todayStr } from "../dates";
import { defaultFolder, docPath, isWithin, normalizeFolder, rebase, titleTaken } from "../folders";
import { documentTypeSync } from "./registry";
import { allDocuments, putDocument } from "./store";
import { assertMayEnterPrivate, assertNotReservedFolder, inPrivateFolder, privateGate } from "../private";
import type { Document } from "./types";

/**
 * Generic Document operations the Vault needs (ADR 0013 semantics, now over
 * every Document): create from the type's template, rename (rewriting
 * [[Old]] in every body), move between Folders, folder rename/delete, and
 * the local list of user-created empty folders.
 */

export async function createDocument(input: { type: string; title: string; folder?: string; body?: string; fields?: Record<string, unknown> }): Promise<Document> {
  const def = documentTypeSync(input.type);
  const title = input.title.trim();
  const folder = input.folder === undefined ? defaultFolder(input.type, title, def?.folder ?? "") : normalizeFolder(input.folder);
  await assertMayEnterPrivate(folder, def);
  const docs = await allDocuments();
  if (def?.titleRule !== "derived" && titleTaken(docs.filter((d) => d.type === input.type), folder, title)) {
    throw new Error(`“${title}” already exists in ${folder || "the root"}`);
  }
  const body = def?.body === "none" ? undefined : (input.body ?? (await templateFor(input.type, title, docs)));
  return putDocument({ ...(input.fields ?? {}), type: input.type, title, folder, body });
}

/** The "template" Document type: a Document whose title is a type id and whose body seeds new Documents of that type. */
export const TEMPLATE_TYPE = "template";

/** Rendered template for a type: the user's template Document (title = type id) if any, else the type's code default. */
export async function templateFor(type: string, title: string, docs?: Document[]): Promise<string> {
  const def = documentTypeSync(type);
  const all = docs ?? (await allDocuments());
  const custom = all.find((d) => d.type === TEMPLATE_TYPE && d.title.toLowerCase() === type.toLowerCase());
  const raw = custom && typeof custom.body === "string" ? custom.body : (def?.template ?? "");
  return renderTemplate(raw, { title, date: def?.titleRule === "date" ? title : todayStr() });
}

/** Rename a Document and rewrite [[Old]] / [[Folder/Old]] → new in every body (Obsidian behaviour). */
export async function renameDocument(doc: Document, newTitle: string): Promise<void> {
  const title = newTitle.trim();
  if (!title || title === doc.title) return;
  const docs = await allDocuments();
  if (titleTaken(docs.filter((d) => d.type === doc.type), doc.folder, title, doc.id)) throw new Error(`“${title}” already exists in ${doc.folder || "the root"}`);
  const next = { ...doc, title } as Document;
  await putDocument(next);
  await rewriteReferrers(docs, doc, next);
}

/** Move a Document to another Folder; path-form links are rewritten, name-form links are untouched. */
export async function moveDocument(doc: Document, folder: string): Promise<void> {
  const f = normalizeFolder(folder);
  if (f === doc.folder) return;
  await assertMayEnterPrivate(f, documentTypeSync(doc.type));
  const docs = await allDocuments();
  if (titleTaken(docs.filter((d) => d.type === doc.type), f, doc.title, doc.id)) throw new Error(`“${doc.title}” already exists in ${f || "the root"}`);
  const next = { ...doc, folder: f } as Document;
  await putDocument(next);
  await rewriteReferrers(docs, doc, next);
}

async function rewriteReferrers(docs: Document[], before: Document, after: Document): Promise<void> {
  const oldPath = docPath(before);
  const newPath = docPath(after);
  for (const other of docs) {
    if (other.id === before.id || typeof other.body !== "string" || !other.body) continue;
    let body = other.body;
    if (before.title !== after.title) body = renameLinks(body, before.title, after.title);
    body = renameLinks(body, oldPath, newPath);
    if (body !== other.body) await putDocument({ ...other, body } as Document);
  }
}

/** Rename (or move) a Folder: every descendant Document's folder is rebased; path links follow. */
export async function renameFolder(from: string, to: string): Promise<void> {
  const a = normalizeFolder(from);
  const b = normalizeFolder(to);
  if (!a || a === b) return;
  if (isWithin(b, a) && b !== a) throw new Error("Cannot move a folder into itself");
  await assertNotReservedFolder(a);
  await assertNotReservedFolder(b);
  // Moving a folder into (or out of) Private needs the gate open: a locked store cannot see what it would move.
  if ((inPrivateFolder(a) || inPrivateFolder(b)) && (await privateGate()).locked) throw new Error("Unlock Private first");
  const docs = await allDocuments();
  const moved = docs.filter((n) => isWithin(n.folder, a));
  const staying = docs.filter((n) => !isWithin(n.folder, a));
  for (const n of moved) {
    const target = rebase(n.folder, a, b);
    await assertMayEnterPrivate(target, documentTypeSync(n.type));
    if (titleTaken(staying.filter((d) => d.type === n.type), target, n.title)) throw new Error(`“${n.title}” already exists in ${target}`);
  }
  for (const n of moved) {
    const next = { ...n, folder: rebase(n.folder, a, b) } as Document;
    await putDocument(next);
    await rewriteReferrers(docs, n, next);
  }
  const extra = await extraFolders();
  await setExtraFolders(extra.map((f) => rebase(f, a, b)));
}

// --- user-created empty folders (local UI state, not synced) ---------------
const EXTRA_KEY = "vault:folders";

export async function extraFolders(): Promise<string[]> {
  const raw = (await db()._meta.get(EXTRA_KEY))?.value ?? (await db()._meta.get("notes:folders"))?.value;
  try {
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}
async function setExtraFolders(list: string[]): Promise<void> {
  await db()._meta.put({ key: EXTRA_KEY, value: JSON.stringify(Array.from(new Set(list.map(normalizeFolder).filter(Boolean)))) });
  bumpFolders();
}
export async function createFolder(path: string): Promise<void> {
  const p = normalizeFolder(path);
  if (!p) return;
  await setExtraFolders([...(await extraFolders()), p]);
}
/** Delete a Folder — only when nothing lives in it or below. */
export async function deleteFolder(path: string): Promise<void> {
  const p = normalizeFolder(path);
  await assertNotReservedFolder(p);
  if (inPrivateFolder(p) && (await privateGate()).locked) throw new Error("Unlock Private first");
  const docs = await allDocuments();
  if (docs.some((n) => isWithin(n.folder, p))) throw new Error("Folder is not empty");
  await setExtraFolders((await extraFolders()).filter((f) => !isWithin(f, p)));
}
export async function forgetExtraFolder(path: string): Promise<void> {
  const p = normalizeFolder(path);
  const cur = await extraFolders();
  if (cur.includes(p)) await setExtraFolders(cur.filter((f) => f !== p));
}

let foldersVersion = 0;
const folderListeners = new Set<() => void>();
function bumpFolders() {
  foldersVersion++;
  folderListeners.forEach((l) => l());
}
export function useExtraFolders(): string[] {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    folderListeners.add(force);
    return () => void folderListeners.delete(force);
  }, []);
  return useLiveQuery(extraFolders, [foldersVersion], [] as string[]);
}
