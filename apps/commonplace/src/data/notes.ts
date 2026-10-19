import { useMemo } from "react";
import { createDocument, documentsOf, getDocument, normalizeTags, putDocument, useDocuments, type Document } from "@lifeline/core";
import { NOTE, NOTES_FOLDER, type Note } from "../domain/types";
import { freeTitle, noteTitleFrom } from "../domain/notes";

function normalize(n: Note): Note {
  return { ...n, body: typeof n.body === "string" ? n.body : "", source: n.source ?? "", locator: n.locator ?? "" };
}

export function useNotes(): Note[] {
  const rows = useDocuments<Note>(NOTE);
  return useMemo(() => rows.map(normalize), [rows]);
}

/** A title free among the Notes already in `folder`. */
async function freeNoteTitle(wanted: string, folder: string): Promise<string> {
  const taken = (await documentsOf<Note>(NOTE)).filter((n) => n.folder === folder).map((n) => n.title);
  return freeTitle(wanted, taken);
}

/**
 * Take a Note on a Source (ADR 0070): my words, with where in the Source they
 * came from. The title is the first line unless given, numbered on a repeat —
 * capture must never fail because I noted the same thing twice.
 */
export async function addNote(input: { source: string; text: string; locator?: string; title?: string; tags?: string[] }): Promise<Note> {
  if (!input.source) throw new Error("A Note needs its Source — without one it is a Thought");
  const text = input.text.replace(/\s+$/, "");
  if (!text.trim()) throw new Error("Write the note");
  const title = await freeNoteTitle(input.title?.trim() || noteTitleFrom(text) || "Note", NOTES_FOLDER);
  return (await createDocument({
    type: NOTE,
    title,
    folder: NOTES_FOLDER,
    body: text + "\n",
    fields: { source: input.source, locator: (input.locator ?? "").trim(), aliases: [], tags: normalizeTags(input.tags ?? []) },
  })) as Note;
}

/**
 * A Thought becomes a Note by being given a Source (ADR 0070): one deliberate
 * act that keeps the Document — its id, body, Tags and links — and changes its
 * type. Its Folder follows only when it sat in the Thoughts home.
 */
export async function noteFromThought(id: string, source: string): Promise<Note> {
  const doc = await getDocument(id);
  if (!doc || doc.type !== "thought") throw new Error("Only a Thought can be given a Source");
  if (!source) throw new Error("Pick a Source");
  const folder = doc.folder === "Thoughts" || doc.folder.startsWith("Thoughts/") ? NOTES_FOLDER + doc.folder.slice("Thoughts".length) : doc.folder;
  const { kind: _kind, ...rest } = doc as Document & { kind?: string };
  const title = await freeNoteTitle(doc.title, folder);
  return putDocument<Note>({ ...rest, type: NOTE, title, folder, source, locator: "" } as unknown as Parameters<typeof putDocument<Note>>[0]);
}

/** The reverse: a Note whose Source is taken away is a Thought again, the same Document. */
export async function thoughtFromNote(id: string): Promise<Document> {
  const doc = await getDocument<Note>(id);
  if (!doc || doc.type !== NOTE) throw new Error("Only a Note can lose its Source");
  const folder = doc.folder === NOTES_FOLDER || doc.folder.startsWith(NOTES_FOLDER + "/") ? "Thoughts" + doc.folder.slice(NOTES_FOLDER.length) : doc.folder;
  const { source: _s, locator: _l, ...rest } = doc;
  const taken = (await documentsOf("thought")).filter((t) => t.folder === folder).map((t) => t.title);
  return putDocument({ ...rest, type: "thought", title: freeTitle(doc.title, taken), folder, kind: "" } as Parameters<typeof putDocument>[0]);
}
