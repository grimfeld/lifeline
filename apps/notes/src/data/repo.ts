import { useMemo } from "react";
import { createDocument, defaultFolder, documentsOf, putDocument, todayStr, useAllDocuments, type DateStr } from "@lifeline/core";
import { DAILY, NOTE_TYPES, THOUGHT, type Note } from "../domain/types";
import { kindOfKey, periodFolder } from "../domain/periods";

const isNoteType = (t: string) => (NOTE_TYPES as readonly string[]).includes(t);

function normalize(n: Note): Note {
  return { ...n, body: typeof n.body === "string" ? n.body : "", title: n.title ?? "" };
}

/** Live Notes: Documents of the note / daily / template types. */
export function useNotes(): Note[] {
  const docs = useAllDocuments();
  return useMemo(() => docs.filter((d) => isNoteType(d.type)).map((d) => normalize(d as Note)), [docs]);
}

/** Create a note-shaped Document from its type's template (Core handles folder rules and user templates). */
export async function createNote(input: { type?: string; title: string; folder?: string; body?: string }): Promise<Note> {
  return (await createDocument({ type: input.type ?? THOUGHT, title: input.title, folder: input.folder, body: input.body })) as Note;
}

export async function saveBody(note: Note, body: string): Promise<void> {
  if (body === note.body) return;
  await putDocument<Note>({ ...note, body });
}

/** The daily note for a day, or undefined. */
export async function dailyNote(date: DateStr): Promise<Note | undefined> {
  return (await documentsOf<Note>(DAILY)).find((n) => n.title === date);
}

const inflight = new Map<DateStr, Promise<Note>>();

/** Get-or-create the daily note from the daily template. Concurrent calls for one day share one creation. */
export function ensureDailyNote(date: DateStr): Promise<Note> {
  const pending = inflight.get(date);
  if (pending) return pending;
  const p = (async () => (await dailyNote(date)) ?? createNote({ type: DAILY, title: date, folder: defaultFolder(DAILY, date) }))().finally(() => inflight.delete(date));
  inflight.set(date, p);
  return p;
}

const periodsInflight = new Map<string, Promise<Note>>();

/**
 * Get-or-create the Document of a review stretch (a Week, Month, Quarter or
 * Year), titled by its key, from its type's Template. Concurrent calls for one
 * stretch share one creation, as a Day's do.
 */
export function ensurePeriod(key: string): Promise<Note> {
  const kind = kindOfKey(key);
  if (!kind) return Promise.reject(new Error(`“${key}” is not a week, month, quarter or year`));
  const pending = periodsInflight.get(key);
  if (pending) return pending;
  const p = (async () => (await documentsOf<Note>(kind)).find((n) => n.title === key) ?? createNote({ type: kind, title: key, folder: periodFolder(key) }))().finally(() => periodsInflight.delete(key));
  periodsInflight.set(key, p);
  return p;
}

/** Quick capture: append a timestamped line to today's daily note. */
export async function appendToDaily(text: string, now = new Date()): Promise<Note> {
  const note = await ensureDailyNote(todayStr(now));
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const line = `- ${hh}:${mm} ${text.trim()}`;
  const body = note.body.endsWith("\n") || note.body === "" ? `${note.body}${line}\n` : `${note.body}\n${line}\n`;
  return putDocument<Note>({ ...note, body });
}

/** Append a raw markdown block (no timestamp) to today's daily note — used by other Apps through the bridge event. */
export async function appendBlockToDaily(markdown: string, now = new Date()): Promise<Note> {
  const note = await ensureDailyNote(todayStr(now));
  const block = markdown.replace(/\s+$/, "");
  const sep = note.body === "" ? "" : note.body.endsWith("\n\n") ? "" : note.body.endsWith("\n") ? "\n" : "\n\n";
  return putDocument<Note>({ ...note, body: `${note.body}${sep}${block}\n` });
}
