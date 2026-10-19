import { useEffect, useReducer } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../data/db";
import { normalizeName, renameLinks, renameLinksMany } from "../markdown";
import { renderTemplate } from "../templates";
import { todayStr } from "../dates";
import { defaultFolder, docPath, isWithin, normalizeFolder, rebase, titleTaken } from "../folders";
import { documentTypeSync } from "./registry";
import { allDocuments, putDocument } from "./store";
import { assertMayEnterPrivate, assertNotReservedFolder, inPrivateFolder, privateGate } from "../private";
import { documentsForLinkRewrite } from "./rewrite";
import type { Document, DocumentTypeDef } from "./types";

/**
 * Generic Document operations the Vault needs (ADR 0013 semantics, now over
 * every Document): create from the type's template, rename (rewriting
 * [[Old]] in every body), move between Folders, folder rename/delete, and
 * the local list of user-created empty folders.
 */

export async function createDocument(input: { type: string; title: string; folder?: string; body?: string; fields?: Record<string, unknown>; templateId?: string }): Promise<Document> {
  const def = documentTypeSync(input.type);
  const title = input.title.trim();
  const folder = input.folder === undefined ? defaultFolder(input.type, title, def?.folder ?? "") : normalizeFolder(input.folder);
  await assertMayEnterPrivate(folder, def);
  const docs = await allDocuments();
  if (def?.titleRule !== "derived" && titleTaken(docs.filter((d) => d.type === input.type), folder, title)) {
    throw new Error(`“${title}” already exists in ${folder || "the root"}`);
  }
  const body = def?.body === "none" ? undefined : (input.body ?? (await templateFor(input.type, title, docs, input.templateId)));
  return putDocument({ ...(input.fields ?? {}), type: input.type, title, folder, body });
}

/** The "template" Document type: a Document whose title is a type id and whose body seeds new Documents of that type. */
export const TEMPLATE_TYPE = "template";

/**
 * A type's Templates (CONTEXT.md "Template"): every Template Document made for
 * it — `forType` names the type — and, from before that field, the one titled
 * by the type id. Each Document type has its own.
 */
export function templatesFor(type: string, docs: readonly Document[]): Document[] {
  const t = type.toLowerCase();
  return docs.filter((d) => d.type === TEMPLATE_TYPE && !d.deleted && (typeof d.forType === "string" && d.forType ? d.forType.toLowerCase() === t : d.title.toLowerCase() === t));
}

/** The Template a new Document of a type starts from when none is picked: the one titled by the type id, else the only one. */
export function defaultTemplateFor(type: string, docs: readonly Document[]): Document | undefined {
  const mine = templatesFor(type, docs);
  return mine.find((d) => d.title.toLowerCase() === type.toLowerCase()) ?? (mine.length === 1 ? mine[0] : undefined);
}

/** Rendered starting body for a type: the picked Template, else its default one, else a built-in's code default. */
export async function templateFor(type: string, title: string, docs?: Document[], templateId?: string): Promise<string> {
  const def = documentTypeSync(type);
  const all = docs ?? (await allDocuments());
  const picked = templateId ? templatesFor(type, all).find((d) => d.id === templateId) : undefined;
  const custom = picked ?? defaultTemplateFor(type, all);
  // Only a built-in carries a default of its own; a user-defined type starts from its Templates alone (CONTEXT.md "Template").
  const raw = custom && typeof custom.body === "string" ? custom.body : def?.builtIn ? (def.template ?? "") : "";
  return renderTemplate(raw, { title, date: def?.titleRule === "date" ? title : todayStr() });
}

/** A starting body a Peek offers for a Document whose body is empty: one Template, already filled for that Document. */
export interface TemplateStart {
  /** The Template Document's id; "" for a built-in's own default. */
  id: string;
  title: string;
  body: string;
}

/**
 * What an empty body may start from (ADR 0085, CONTEXT.md "Template"): each
 * of the type's Templates, filled for this Document; a built-in with none
 * offers its own default instead, and a user-defined type with none offers nothing.
 */
export function templateStartsFor(doc: Document, def: DocumentTypeDef | undefined, docs: readonly Document[], now: Date = new Date()): TemplateStart[] {
  const vars = { title: doc.title, date: def?.titleRule === "date" ? doc.title : todayStr(now), now };
  const mine = templatesFor(doc.type, docs).map((t) => ({ id: t.id, title: t.title, body: renderTemplate(typeof t.body === "string" ? t.body : "", vars) }));
  if (mine.length > 0) return mine;
  return def?.builtIn && def.template ? [{ id: "", title: "Default", body: renderTemplate(def.template, vars) }] : [];
}

/** Rename a Document and rewrite [[Old]] / [[Folder/Old]] → new in every body (Obsidian behaviour). */
export async function renameDocument(doc: Document, newTitle: string): Promise<void> {
  const title = newTitle.trim();
  if (!title || title === doc.title) return;
  const docs = await allDocuments();
  if (titleTaken(docs.filter((d) => d.type === doc.type), doc.folder, title, doc.id)) throw new Error(`“${title}” already exists in ${doc.folder || "the root"}`);
  const next = { ...doc, title } as Document;
  await putDocument(next);
  await rewriteReferrers(doc, next);
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
  await rewriteReferrers(doc, next);
}

/**
 * Rewrite every body linking to `before` so it links to `after`. Reads bodies
 * around the Private gate (documentsForLinkRewrite): a locked Private note's
 * links must follow a rename too, and nothing read here is shown or returned.
 */
async function rewriteReferrers(before: Document, after: Document): Promise<void> {
  const oldPath = docPath(before);
  const newPath = docPath(after);
  for (const other of await documentsForLinkRewrite()) {
    if (other.id === before.id || typeof other.body !== "string" || !other.body) continue;
    let body = other.body;
    if (before.title !== after.title) body = renameLinks(body, before.title, after.title);
    body = renameLinks(body, oldPath, newPath);
    if (body !== other.body) await putDocument({ ...other, body } as Document);
  }
}

/**
 * The rows a Folder rename writes, each Document at most once: a moved one
 * rebased, and every body with its path links following every move at once.
 * Rewriting referrers per moved Document from one snapshot wrote stale rows —
 * a sibling's move was reverted and an earlier rewrite lost. Pure.
 */
export function planFolderRename(docs: Document[], a: string, b: string): Document[] {
  const renames = new Map<string, string>();
  for (const n of docs) {
    if (n.title && isWithin(n.folder, a)) renames.set(normalizeName(docPath(n)), docPath({ folder: rebase(n.folder, a, b), title: n.title }));
  }
  const out: Document[] = [];
  for (const d of docs) {
    const folder = rebase(d.folder, a, b);
    const body = typeof d.body === "string" && d.body ? renameLinksMany(d.body, renames) : d.body;
    if (folder !== d.folder || body !== d.body) out.push({ ...d, folder, body } as Document);
  }
  return out;
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
  // Planned over the ungated rows so locked Private notes' path links follow the
  // move too (see rewriteReferrers). A locked note is never itself moved: it is
  // within `a` only when `a` is in Private, which needs the gate open (above).
  for (const row of planFolderRename(await documentsForLinkRewrite(), a, b)) await putDocument(row);
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
