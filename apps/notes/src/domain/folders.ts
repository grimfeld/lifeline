import type { DateStr } from "@lifeline/core";
import type { Note } from "./types";
import { normalizeName } from "./markdown";

/**
 * Folder paths (ADR 0013): "/"-separated, "" = root, no leading/trailing
 * slashes, segments trimmed. Folders exist because notes are in them.
 */
export function normalizeFolder(path: string): string {
  return path
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean)
    .join("/");
}

export function parentFolder(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
}

export function folderName(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? path : path.slice(i + 1);
}

export function joinFolder(parent: string, name: string): string {
  return normalizeFolder(`${parent}/${name}`);
}

/** True when `path` is `ancestor` or lives below it. */
export function isWithin(path: string, ancestor: string): boolean {
  if (ancestor === "") return true;
  return path === ancestor || path.startsWith(ancestor + "/");
}

/** Move `path` (a folder or a note's folder) from under `from` to under `to`. */
export function rebase(path: string, from: string, to: string): string {
  if (!isWithin(path, from)) return path;
  const rest = path === from ? "" : path.slice(from.length + 1);
  return normalizeFolder(`${to}/${rest}`);
}

/** Full path of a note: "Folder/Sub/Title" (or just "Title" at root). */
export function notePath(n: Pick<Note, "folder" | "title">): string {
  return n.folder ? `${n.folder}/${n.title}` : n.title;
}

/** Where daily notes live: Journal/YYYY/MM. */
export function dailyFolder(date: DateStr): string {
  const [y, m] = date.split("-");
  return `Journal/${y}/${m}`;
}

export const TEMPLATES_FOLDER = "Templates";

/** Default folder for a note of a type when nothing else is chosen; user types may declare one. */
export function defaultFolder(type: string, title: string, typeFolder = ""): string {
  if (type === "daily") return dailyFolder(title);
  if (type === "template") return TEMPLATES_FOLDER;
  return normalizeFolder(typeFolder);
}

/** Legacy notes (before folders) get a folder on read; idempotent. */
export function migrateFolder(n: Pick<Note, "folder" | "type" | "title">): string {
  if (n.folder !== undefined && n.folder !== null) return normalizeFolder(n.folder);
  return defaultFolder(n.type, n.title);
}

export interface FolderNode {
  path: string;
  name: string;
  folders: FolderNode[];
  notes: Note[];
}

/**
 * Build the tree: every folder implied by a note plus `extraFolders`
 * (user-created, still empty). Folders sort by name; notes by the given
 * comparator (dailies newest first by default).
 */
export function buildTree(notes: Note[], extraFolders: string[] = [], compare: (a: Note, b: Note) => number = compareNotes): FolderNode {
  const root: FolderNode = { path: "", name: "", folders: [], notes: [] };
  const byPath = new Map<string, FolderNode>([["", root]]);
  const ensure = (path: string): FolderNode => {
    const p = normalizeFolder(path);
    const existing = byPath.get(p);
    if (existing) return existing;
    const parent = ensure(parentFolder(p));
    const node: FolderNode = { path: p, name: folderName(p), folders: [], notes: [] };
    parent.folders.push(node);
    byPath.set(p, node);
    return node;
  };
  for (const f of extraFolders) if (f) ensure(f);
  for (const n of notes) ensure(n.folder).notes.push(n);
  const sortNode = (node: FolderNode) => {
    node.folders.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    node.notes.sort(compare);
    node.folders.forEach(sortNode);
  };
  sortNode(root);
  return root;
}

export function compareNotes(a: Note, b: Note): number {
  if (a.type === "daily" && b.type === "daily") return b.title.localeCompare(a.title);
  return a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: "base" });
}

/** All folder paths in the tree (depth-first, root excluded). */
export function allFolders(root: FolderNode): string[] {
  const out: string[] = [];
  const walk = (n: FolderNode) => {
    for (const f of n.folders) {
      out.push(f.path);
      walk(f);
    }
  };
  walk(root);
  return out;
}

/** True when another live note in `folder` has this title (case-insensitive). */
export function titleTaken(notes: Note[], folder: string, title: string, exceptId?: string): boolean {
  const f = normalizeFolder(folder);
  const t = normalizeName(title);
  return notes.some((n) => n.id !== exceptId && n.folder === f && normalizeName(n.title) === t);
}
