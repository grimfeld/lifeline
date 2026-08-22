import type { DocumentTypeDef, FieldDef } from "@lifeline/core";
import { Book, BookOpen } from "lucide-react";
import { ACQUISITION, ENGAGEMENT, SETTINGS_TYPE, type Work } from "./domain/types";
import { WORK_TYPES, type WorkTypeId } from "./domain/workTypes";
import { APP_HREF } from "./constants";

const ACQ_LABELS: Record<string, string> = { WANTED: "Wanted", OWNED: "Owned", BORROWED: "Borrowed", GONE: "Gone" };
const ENG_LABELS: Record<string, string> = { UNSTARTED: "Not started", IN_PROGRESS: "In progress", DONE: "Done", ABANDONED: "Dropped" };

/**
 * The fields books and comics share (ADR 0024): both axes plus the
 * Nightstand slot — the reading family keeps everything the old Media model
 * had except Studied. Shelf moves, slots and the auto-stamped days are
 * guarded (ADR 0019).
 */
const WORK_FIELDS: FieldDef[] = [
  { key: "creator", label: "Creator", kind: "text", column: true },
  { key: "year", label: "Year", kind: "number", column: true },
  { key: "size", label: "Size", kind: "number" },
  { key: "acquisition", label: "Owned", kind: "select", options: ACQUISITION.map((v) => ({ value: v, label: ACQ_LABELS[v] })), guarded: true, column: true },
  { key: "engagement", label: "Shelf", kind: "select", options: ENGAGEMENT.map((v) => ({ value: v, label: ENG_LABELS[v] })), guarded: true, column: true },
  { key: "reason", label: "Reason", kind: "longtext" },
  { key: "slot", label: "Nightstand slot", kind: "number", guarded: true },
  { key: "coverUrl", label: "Cover URL", kind: "url" },
  { key: "externalKey", label: "External key", kind: "text", hidden: true },
  { key: "addedOn", label: "Added on", kind: "date", guarded: true },
  { key: "acquiredOn", label: "Acquired on", kind: "date", guarded: true },
  { key: "slottedOn", label: "Slotted on", kind: "date", guarded: true },
  { key: "startedOn", label: "Started on", kind: "date", guarded: true },
  { key: "finishedOn", label: "Finished on", kind: "date", guarded: true },
];

const ICONS: Record<WorkTypeId, { icon: typeof Book; name: string }> = {
  book: { icon: Book, name: "book-open" },
  comic: { icon: BookOpen, name: "book-open" },
};

/** One Document type per medium (type ids unchanged from Media — no data migration). */
export const workTypeDefs: DocumentTypeDef[] = WORK_TYPES.map((t, i) => ({
  id: t.id,
  label: t.plural,
  singular: t.label,
  icon: ICONS[t.id].icon,
  iconName: ICONS[t.id].name,
  titleRule: "name",
  body: "none",
  linkable: { subtitle: (d) => { const m = d as Work; return `${t.label}${m.creator ? " · " + m.creator : ""}`; } },
  href: () => APP_HREF,
  indexes: ["slot", "externalKey"],
  order: 40 + i,
  builtIn: true,
  fields: WORK_FIELDS,
}));

export const settingsTypeDef: DocumentTypeDef = {
  id: SETTINGS_TYPE,
  label: "Library lookup settings",
  internal: true,
  titleRule: "name",
  body: "none",
  order: 999,
  builtIn: true,
  fields: [
    { key: "comicvineKey", label: "ComicVine key", kind: "text" },
    { key: "googleBooksKey", label: "Google Books key", kind: "text" },
  ],
};
