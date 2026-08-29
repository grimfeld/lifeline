import { newId, putDocument, todayStr, type Document, type DocumentTypeDef } from "@lifeline/core";
import { DAILY, DAILY_TEMPLATE, MOODS, NOTE, TEMPLATE, journalHref, noteHref } from "./domain/types";

/**
 * Sync conflict (ADR 0010): the server copy is newer than an unsynced local
 * edit. Keep the local text as a sibling note "<title> (conflict HH:MM)".
 */
export async function onNoteConflict(local: Document, server: Document): Promise<void> {
  if (local.body === server.body && local.title === server.title) return;
  const d = new Date();
  const stamp = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  await putDocument({
    id: newId(),
    type: NOTE,
    folder: local.folder ?? "",
    title: `${local.title} (conflict ${stamp})`,
    body: typeof local.body === "string" ? local.body : "",
    conflictOf: local.title,
    createdAt: todayStr(),
  });
}

/** UI-free type definitions (icons are attached in index.ts so tests don't pull the UI kit). */
export const noteTypes: DocumentTypeDef[] = [
  {
    id: DAILY,
    label: "Daily notes",
    iconName: "calendar-days",
    titleRule: "date",
    body: "required",
    fields: [{ key: "mood", label: "Mood", kind: "select", options: MOODS, column: true }],
    template: DAILY_TEMPLATE,
    // A date in prose is not a mention of the day; the Daylog ties days together (CONTEXT.md "Unlinked mention").
    linkable: { mentions: false },
    href: (d) => journalHref(d.title),
    onConflict: onNoteConflict,
    order: 0,
    builtIn: true,
  },
  {
    id: NOTE,
    label: "Notes",
    iconName: "file-text",
    titleRule: "name",
    body: "required",
    fields: [{ key: "aliases", label: "Aliases", kind: "list" }],
    folder: "",
    template: "",
    linkable: true,
    href: (d) => noteHref(d),
    onConflict: onNoteConflict,
    order: 10,
    builtIn: true,
  },
  {
    id: TEMPLATE,
    label: "Templates",
    iconName: "layout-template",
    titleRule: "name",
    body: "required",
    fields: [],
    folder: "Templates",
    linkable: false,
    href: (d) => noteHref(d),
    order: 90,
    builtIn: true,
  },
];
