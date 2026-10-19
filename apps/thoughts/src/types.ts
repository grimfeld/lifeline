import { newId, putDocument, todayStr, type Document, type DocumentTypeDef } from "@lifeline/core";
import { THOUGHT, THOUGHT_KINDS, THOUGHTS_FOLDER, thoughtHref } from "./domain/types";

/**
 * Sync conflict (ADR 0010): the server copy is newer than an unsynced local
 * edit. Keep the local text as a sibling "<title> (conflict HH:MM)".
 */
export async function onThoughtConflict(local: Document, server: Document): Promise<void> {
  if (local.body === server.body && local.title === server.title) return;
  const d = new Date();
  const stamp = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  await putDocument({
    id: newId(),
    type: THOUGHT,
    folder: local.folder ?? "",
    title: `${local.title} (conflict ${stamp})`,
    body: typeof local.body === "string" ? local.body : "",
    kind: local.kind ?? "",
    conflictOf: local.title,
    createdAt: todayStr(),
  });
}

/** UI-free type definition (the icon is attached in index.ts so tests don't pull the UI kit). */
export const thoughtTypeDef: DocumentTypeDef = {
  id: THOUGHT,
  label: "Thoughts",
  iconName: "lightbulb",
  titleRule: "name",
  body: "required",
  fields: [
    { key: "kind", label: "Kind", kind: "select", options: THOUGHT_KINDS.map((k) => ({ value: k.value, label: k.label })), column: true },
    { key: "aliases", label: "Aliases", kind: "list" },
  ],
  folder: THOUGHTS_FOLDER,
  template: "",
  linkable: true,
  href: (d) => thoughtHref(d.id),
  onConflict: onThoughtConflict,
  order: 10,
  builtIn: true,
};
