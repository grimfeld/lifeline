import { useMemo } from "react";
import { db, get, newId, put, remove, todayStr, useLinkTargets, useLiveQuery, type DateStr, type SyncedRecord } from "@lifeline/core";
import { NOTES, type Note } from "../domain/types";
import { noteType, type NoteTypeId } from "../domain/noteTypes";
import { buildIndex, type NoteIndex } from "../domain/index";
import { normalizeName, renameLinks, serializeFrontmatter, splitFrontmatter, withProperties, type Properties } from "../domain/markdown";

function normalize(n: Note): Note {
  return { ...n, body: n.body ?? "", title: n.title ?? "", type: (n.type ?? "plain") as NoteTypeId, createdAt: n.createdAt ?? "" };
}

export function useNotes(): Note[] {
  return useLiveQuery(
    async () => (await db().collection<Note>(NOTES).where("deleted").equals(0).toArray()).map(normalize),
    [],
    [] as Note[],
  );
}

export function useNote(id: string | undefined): Note | undefined {
  return useLiveQuery(async () => (id ? get<Note>(NOTES, id) : undefined), [id], undefined);
}

/** The derived index over all notes + every App's Linkable targets (ADR 0009). */
export function useNoteIndex(): NoteIndex {
  const notes = useNotes();
  const targets = useLinkTargets();
  return useMemo(() => buildIndex(notes, targets), [notes, targets]);
}

export async function allNotes(): Promise<Note[]> {
  return (await db().collection<Note>(NOTES).where("deleted").equals(0).toArray()).map(normalize);
}

export async function findByTitle(title: string): Promise<Note | undefined> {
  const k = normalizeName(title);
  return (await allNotes()).find((n) => normalizeName(n.title) === k);
}

/** Create a note of a type; body defaults to the type's template with empty properties. */
export async function createNote(input: { type: NoteTypeId; title: string; body?: string; properties?: Properties }): Promise<Note> {
  const def = noteType(input.type);
  const fm = serializeFrontmatter(input.properties ?? {});
  const note: Note = {
    id: newId(),
    type: input.type,
    title: input.title.trim(),
    body: input.body ?? fm + def.template,
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

/** Rename a note and rewrite [[Old]] → [[New]] in every referring note (Obsidian behaviour). */
export async function renameNote(note: Note, newTitle: string): Promise<void> {
  const title = newTitle.trim();
  if (!title || title === note.title) return;
  await put<Note>(NOTES, { ...note, title });
  for (const other of await allNotes()) {
    if (other.id === note.id) continue;
    const rewritten = renameLinks(other.body, note.title, title);
    if (rewritten !== other.body) await put<Note>(NOTES, { ...other, body: rewritten });
  }
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
  const p = (async () => (await dailyNote(date)) ?? createNote({ type: "daily", title: date }))().finally(() => inflight.delete(date));
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
    title: `${l.title} (conflict ${stamp})`,
    body: serializeFrontmatter({ ...properties, conflictOf: l.title }) + content,
    createdAt: todayStr(),
    updatedAt: "",
    deleted: 0,
  });
}
