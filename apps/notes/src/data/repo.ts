import { useEffect, useMemo, useReducer } from "react";
import { db, get, newId, put, remove, todayStr, useLinkTargets, useLiveQuery, type DateStr, type SyncedRecord } from "@lifeline/core";
import { NOTES, type Note } from "../domain/types";
import { TEMPLATE_TYPE, type NoteTypeId } from "../domain/noteTypes";
import { noteType } from "./noteTypes";
import { renderTemplate } from "../domain/templates";
import { buildIndex, type NoteIndex } from "../domain/index";
import { normalizeName, renameLinks, serializeFrontmatter, splitFrontmatter, withProperties, type Properties } from "../domain/markdown";
import { defaultFolder, isWithin, migrateFolder, normalizeFolder, notePath, rebase, titleTaken } from "../domain/folders";

function normalize(n: Note): Note {
  const type = (n.type ?? "plain") as NoteTypeId;
  const title = n.title ?? "";
  return { ...n, body: n.body ?? "", title, type, folder: migrateFolder({ folder: n.folder, type, title }), createdAt: n.createdAt ?? "" };
}

export function useNotes(): Note[] {
  return useLiveQuery(
    async () => (await db().collection<Note>(NOTES).where("deleted").equals(0).toArray()).map(normalize),
    [],
    [] as Note[],
  );
}

export function useNote(id: string | undefined): Note | undefined {
  return useLiveQuery(
    async () => {
      const n = id ? await get<Note>(NOTES, id) : undefined;
      return n ? normalize(n) : undefined;
    },
    [id],
    undefined,
  );
}

/** The derived index over all notes + every App's Linkable targets (ADR 0009). */
export function useNoteIndex(): NoteIndex {
  const notes = useNotes();
  const targets = useLinkTargets();
  // Templates are not link targets and their placeholder links are not backlinks.
  return useMemo(() => buildIndex(notes.filter((n) => n.type !== TEMPLATE_TYPE), targets), [notes, targets]);
}

export async function allNotes(): Promise<Note[]> {
  return (await db().collection<Note>(NOTES).where("deleted").equals(0).toArray()).map(normalize);
}

/** A note by title within a folder (titles are unique per folder). */
export async function findByTitle(title: string, folder = ""): Promise<Note | undefined> {
  const k = normalizeName(title);
  const f = normalizeFolder(folder);
  return (await allNotes()).find((n) => n.folder === f && normalizeName(n.title) === k);
}

/** The template note for a type (a "template" note titled with the type id), if the user made one. */
export async function templateNote(type: NoteTypeId): Promise<Note | undefined> {
  return (await allNotes()).find((n) => n.type === TEMPLATE_TYPE && normalizeName(n.title) === type);
}

/** Template content for a type: the user's template note (content after its frontmatter) or the code default. */
export async function templateFor(type: NoteTypeId, vars: { title: string }): Promise<string> {
  const custom = await templateNote(type);
  const raw = custom ? splitFrontmatter(custom.body).content : noteType(type).template;
  return renderTemplate(raw, { title: vars.title, date: type === "daily" ? vars.title : todayStr() });
}

/** Get-or-create the editable template note for a type, seeded with the code default. */
export async function ensureTemplateNote(type: NoteTypeId): Promise<Note> {
  return (await templateNote(type)) ?? createNote({ type: TEMPLATE_TYPE, title: type, folder: defaultFolder(TEMPLATE_TYPE, type), body: noteType(type).template });
}

/** Create a note of a type; body defaults to the type's template with empty properties. Folder defaults per type. */
export async function createNote(input: { type: NoteTypeId; title: string; folder?: string; body?: string; properties?: Properties }): Promise<Note> {
  const fm = serializeFrontmatter(input.properties ?? {});
  const title = input.title.trim();
  const folder = input.folder === undefined ? defaultFolder(input.type, title, noteType(input.type).folder) : normalizeFolder(input.folder);
  const note: Note = {
    id: newId(),
    type: input.type,
    folder,
    title,
    body: input.body ?? fm + (await templateFor(input.type, { title })),
    createdAt: todayStr(),
    updatedAt: "",
    deleted: 0,
  };
  await put<Note>(NOTES, note);
  return note;
}

export async function saveBody(note: Note, body: string): Promise<void> {
  if (body === note.body) return;
  await put<Note>(NOTES, { ...note, body });
}

export async function setProperties(note: Note, props: Properties): Promise<void> {
  await saveBody(note, withProperties(note.body, props));
}

/** Rename a note and rewrite [[Old]] / [[Folder/Old]] → new in every referring note (Obsidian behaviour). */
export async function renameNote(note: Note, newTitle: string): Promise<void> {
  const title = newTitle.trim();
  if (!title || title === note.title) return;
  const notes = await allNotes();
  if (titleTaken(notes, note.folder, title, note.id)) throw new Error(`“${title}” already exists in ${note.folder || "the root"}`);
  const next = { ...note, title };
  await put<Note>(NOTES, next);
  await rewriteReferrers(notes, note, next);
}

/** Move a note to another folder; path-form links are rewritten, name-form links are untouched. */
export async function moveNote(note: Note, folder: string): Promise<void> {
  const f = normalizeFolder(folder);
  if (f === note.folder) return;
  const notes = await allNotes();
  if (titleTaken(notes, f, note.title, note.id)) throw new Error(`“${note.title}” already exists in ${f || "the root"}`);
  const next = { ...note, folder: f };
  await put<Note>(NOTES, next);
  await rewriteReferrers(notes, note, next);
}

async function rewriteReferrers(notes: Note[], before: Note, after: Note): Promise<void> {
  const oldPath = notePath(before);
  const newPath = notePath(after);
  for (const other of notes) {
    if (other.id === before.id) continue;
    let body = other.body;
    if (before.title !== after.title) body = renameLinks(body, before.title, after.title);
    body = renameLinks(body, oldPath, newPath);
    if (body !== other.body) await put<Note>(NOTES, { ...other, body });
  }
}

/** Rename (or move) a folder: every descendant note's folder is rebased; path links follow. */
export async function renameFolder(from: string, to: string): Promise<void> {
  const a = normalizeFolder(from);
  const b = normalizeFolder(to);
  if (!a || a === b) return;
  if (isWithin(b, a) && b !== a) throw new Error("Cannot move a folder into itself");
  const notes = await allNotes();
  const moved = notes.filter((n) => isWithin(n.folder, a));
  const staying = notes.filter((n) => !isWithin(n.folder, a));
  for (const n of moved) {
    const target = rebase(n.folder, a, b);
    if (titleTaken(staying, target, n.title)) throw new Error(`“${n.title}” already exists in ${target}`);
  }
  for (const n of moved) {
    const next = { ...n, folder: rebase(n.folder, a, b) };
    await put<Note>(NOTES, next);
    await rewriteReferrers(notes, n, next);
  }
  const extra = await extraFolders();
  await setExtraFolders(extra.map((f) => rebase(f, a, b)));
}

// --- user-created empty folders (local UI state, not synced) ---------------
const EXTRA_KEY = "notes:folders";

export async function extraFolders(): Promise<string[]> {
  const raw = (await db()._meta.get(EXTRA_KEY))?.value;
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
/** Delete a folder — only when no note lives in it or below (Obsidian asks; we refuse). */
export async function deleteFolder(path: string): Promise<void> {
  const p = normalizeFolder(path);
  const notes = await allNotes();
  if (notes.some((n) => isWithin(n.folder, p))) throw new Error("Folder is not empty");
  await setExtraFolders((await extraFolders()).filter((f) => !isWithin(f, p)));
}
/** Once a folder has a note, it no longer needs to be remembered. */
export async function forgetExtraFolder(path: string): Promise<void> {
  const p = normalizeFolder(path);
  const cur = await extraFolders();
  if (cur.includes(p)) await setExtraFolders(cur.filter((f) => f !== p));
}

// _meta isn't a live-queried table for the extra-folder list; a tiny version counter re-renders the hook.
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

export async function deleteNote(id: string): Promise<void> {
  await remove(NOTES, id);
}

/** The daily note for a day, or undefined. */
export async function dailyNote(date: DateStr): Promise<Note | undefined> {
  return (await allNotes()).find((n) => n.type === "daily" && n.title === date);
}

const inflight = new Map<DateStr, Promise<Note>>();

/** Get-or-create the daily note from the daily template. Concurrent calls for one day share one creation. */
export function ensureDailyNote(date: DateStr): Promise<Note> {
  const pending = inflight.get(date);
  if (pending) return pending;
  const p = (async () => (await dailyNote(date)) ?? createNote({ type: "daily", title: date, folder: defaultFolder("daily", date) }))().finally(() => inflight.delete(date));
  inflight.set(date, p);
  return p;
}

/** Quick capture: append a timestamped line to today's daily note. */
export async function appendToDaily(text: string, now = new Date()): Promise<Note> {
  const note = await ensureDailyNote(todayStr(now));
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const line = `- ${hh}:${mm} ${text.trim()}`;
  const body = note.body.endsWith("\n") || note.body === "" ? `${note.body}${line}\n` : `${note.body}\n${line}\n`;
  const next = { ...note, body };
  await put<Note>(NOTES, next);
  return next;
}

/** Append a raw markdown block (no timestamp) to today's daily note — used by other Apps through the bridge event. */
export async function appendBlockToDaily(markdown: string, now = new Date()): Promise<Note> {
  const note = await ensureDailyNote(todayStr(now));
  const block = markdown.replace(/\s+$/, "");
  const sep = note.body === "" ? "" : note.body.endsWith("\n\n") ? "" : note.body.endsWith("\n") ? "\n" : "\n\n";
  const next = { ...note, body: `${note.body}${sep}${block}\n` };
  await put<Note>(NOTES, next);
  return next;
}

/**
 * Sync conflict (ADR 0010): the server copy is newer than an unsynced local
 * edit. Keep the local text as a sibling "<title> (conflict HH:MM)" note.
 */
export async function onNoteConflict(local: SyncedRecord, server: SyncedRecord): Promise<void> {
  const l = local as Note;
  const s = server as Note;
  if (l.body === s.body && l.title === s.title) return;
  const d = new Date();
  const stamp = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const { properties, content } = splitFrontmatter(l.body);
  await put<Note>(NOTES, {
    id: newId(),
    type: "plain",
    folder: l.folder ?? "",
    title: `${l.title} (conflict ${stamp})`,
    body: serializeFrontmatter({ ...properties, conflictOf: l.title }) + content,
    createdAt: todayStr(),
    updatedAt: "",
    deleted: 0,
  });
}
