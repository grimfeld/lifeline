import { newId, PRIVATE_SETTINGS_TYPE, putDocument, todayStr, type Document, type DocumentTypeDef } from "@lifeline/core";
import { DAILY, DAILY_TEMPLATE, TEMPLATE, journalHref, noteHref } from "./domain/types";

/**
 * Sync conflict (ADR 0010): the server copy is newer than an unsynced local
 * edit. Keep the local text as a sibling of the same type, "<title> (conflict HH:MM)".
 */
export async function onNoteConflict(local: Document, server: Document): Promise<void> {
  if (local.body === server.body && local.title === server.title) return;
  const d = new Date();
  const stamp = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  await putDocument({
    id: newId(),
    type: local.type,
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
    // Mood left the daily note for the Mood App (ADR 0044); daily notes are body-only.
    fields: [],
    template: DAILY_TEMPLATE,
    // A date in prose is not a mention of the day; the Daylog ties days together (CONTEXT.md "Unlinked mention").
    linkable: { mentions: false },
    href: (d) => journalHref(d.title),
    onConflict: onNoteConflict,
    order: 0,
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
  {
    // The Private folder's password (ADR 0038): one internal Document, read by Core's gate by id. A hash and its salt, nothing secret.
    id: PRIVATE_SETTINGS_TYPE,
    label: "Private notes settings",
    iconName: "lock",
    titleRule: "name",
    body: "none",
    internal: true,
    fields: [
      { key: "salt", label: "Salt", kind: "text", hidden: true, guarded: true },
      { key: "hash", label: "Hash", kind: "text", hidden: true, guarded: true },
      { key: "iterations", label: "Iterations", kind: "number", hidden: true, guarded: true },
    ],
    linkable: false,
    order: 99,
    builtIn: true,
  },
];
