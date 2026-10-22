import { newId } from "../ids";
import { todayStr } from "../dates";
import { putDocument } from "./store";
import type { Document } from "./types";

/**
 * Sync conflict hook (ADR 0010): the server copy is newer than an unsynced local
 * edit. Keep the local Document as a sibling of the same type, "<title> (conflict HH:MM)",
 * with every field it had (a Note keeps its Source). Nothing is merged.
 */
export async function conflictCopy(local: Document, server: Document): Promise<void> {
  if (local.body === server.body && local.title === server.title) return;
  const d = new Date();
  const stamp = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  // The sync clock and tombstone belong to the row, not the content: the copy is a new row.
  const { updatedAt: _updatedAt, deleted: _deleted, ...fields } = local;
  await putDocument({
    ...fields,
    id: newId(),
    folder: local.folder ?? "",
    title: `${local.title} (conflict ${stamp})`,
    body: typeof local.body === "string" ? local.body : "",
    conflictOf: local.title,
    createdAt: todayStr(),
  });
}
