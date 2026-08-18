import type { DateStr } from "@lifeline/core";
import type { NoteIndex } from "./index";
import type { Note } from "./types";
import { normalizeName } from "./markdown";

export interface MentionRank {
  noteId: string;
  /** Distinct daily notes (dated ≥ since) that link to it. */
  count: number;
  /** Most recent daily-note date mentioning it. */
  last: DateStr;
}

/**
 * Rank notes of a type by how many daily notes dated on/after `since` link
 * to them — "people I've seen" when type = person. Ties break by recency,
 * then by title. Notes with zero recent mentions are omitted.
 */
export function rankMentions(index: NoteIndex, notes: Note[], opts: { type?: string; since: DateStr }): MentionRank[] {
  const out: MentionRank[] = [];
  for (const n of notes) {
    if (opts.type && n.type !== opts.type) continue;
    if (n.type === "daily") continue;
    const days = new Set<DateStr>();
    for (const b of index.backlinksTo({ kind: "note", noteId: n.id })) {
      const src = index.byId.get(b.noteId);
      if (!src || src.type !== "daily" || src.title < opts.since) continue;
      days.add(src.title);
    }
    if (days.size === 0) continue;
    out.push({ noteId: n.id, count: days.size, last: Array.from(days).sort().at(-1)! });
  }
  const title = (id: string) => index.byId.get(id)?.title ?? "";
  return out.sort((a, b) => b.count - a.count || b.last.localeCompare(a.last) || title(a.noteId).localeCompare(title(b.noteId)));
}

export interface Mention {
  noteId: string;
  context: string;
  /** Sort key: the daily date for daily notes, else the note's updatedAt. */
  when: string;
}

/** Linked mentions of a note, newest first (daily notes by date, others by last edit). */
export function mentionsOf(index: NoteIndex, noteId: string): Mention[] {
  return index
    .backlinksTo({ kind: "note", noteId })
    .map((b) => {
      const src = index.byId.get(b.noteId);
      const when = !src ? "" : src.type === "daily" ? src.title : src.updatedAt.slice(0, 10) || src.createdAt;
      return { noteId: b.noteId, context: b.context, when };
    })
    .sort((a, b) => b.when.localeCompare(a.when));
}

export interface UnresolvedEntry {
  /** Name as first written in a [[link]]. */
  name: string;
  noteIds: string[];
}

/**
 * Unresolved link names with the notes mentioning them. The index keys are
 * normalized; the display name is recovered from the first mention's link text.
 */
export function unresolvedEntries(index: NoteIndex, sort: "count" | "name" = "count"): UnresolvedEntry[] {
  const out: UnresolvedEntry[] = [];
  for (const [key, noteIds] of index.unresolved) {
    let name = key;
    const first = noteIds[0];
    if (first) {
      const hit = index.linksFrom(first).find((l) => l.ref.kind === "unresolved" && normalizeName(l.ref.name) === key);
      if (hit && hit.ref.kind === "unresolved") name = hit.ref.name;
    }
    out.push({ name, noteIds });
  }
  return out.sort((a, b) => (sort === "count" ? b.noteIds.length - a.noteIds.length || a.name.localeCompare(b.name) : a.name.localeCompare(b.name)));
}

/** Append a plain bullet line to a note body (Quick capture "bullet" prefix). */
export function appendBullet(body: string, text: string): string {
  const line = `- ${text.trim()}`;
  return body.endsWith("\n") || body === "" ? `${body}${line}\n` : `${body}\n${line}\n`;
}
