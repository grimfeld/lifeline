import type { DocumentTypeDef, FieldDef } from "@lifeline/core";
import { Book, BookOpen, UserPen } from "lucide-react";
import { ACQUISITION, AUTHOR, ENGAGEMENT, SETTINGS_TYPE } from "./domain/types";
import { WORK_TYPES, type WorkTypeId } from "./domain/workTypes";
import { APP_HREF } from "./constants";
import { cascadeWorkDelete } from "./data/repo";

const ACQ_LABELS: Record<string, string> = { WANTED: "Wanted", OWNED: "Owned", BORROWED: "Borrowed", GONE: "Gone" };
const ENG_LABELS: Record<string, string> = { UNSTARTED: "Not started", IN_PROGRESS: "In progress", DONE: "Done", ABANDONED: "Dropped" };

/**
 * The fields books and comics share (ADR 0024): both axes plus the
 * Nightstand slot — the reading family keeps everything the old Media model
 * had except Studied. Shelf moves, slots and the auto-stamped days are
 * guarded (ADR 0019).
 */
const WORK_FIELDS: FieldDef[] = [
  { key: "authors", label: "Authors", kind: "links", linkType: AUTHOR, column: true },
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
  linkable: { subtitle: () => t.label },
  href: () => APP_HREF,
  indexes: ["slot", "externalKey"],
  order: 40 + i,
  builtIn: true,
  fields: WORK_FIELDS,
  // Its Quotes go with it, from wherever it is deleted (ADR 0045).
  onDelete: (doc) => cascadeWorkDelete(doc.id),
}));

/**
 * The Author (ADR 0052): Linkable by name and aliases, with a body for my
 * own words. Opens on the Vault's generic page (the body lives there); the
 * Library's own Author screen is one click away from it.
 */
export const authorTypeDef: DocumentTypeDef = {
  id: AUTHOR,
  label: "Authors",
  icon: UserPen,
  iconName: "user",
  titleRule: "name",
  body: "optional",
  linkable: { subtitle: (d) => { const a = d as { born?: string; died?: string }; return a.born || a.died ? `Author · ${[a.born, a.died].filter(Boolean).join(" – ")}` : "Author"; } },
  indexes: ["externalKey"],
  order: 42,
  builtIn: true,
  fields: [
    { key: "aliases", label: "Aliases", kind: "list" },
    { key: "born", label: "Born", kind: "text", column: true },
    { key: "died", label: "Died", kind: "text", column: true },
    { key: "photoUrl", label: "Photo URL", kind: "url" },
    { key: "externalKey", label: "External key", kind: "text", hidden: true },
  ],
};

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
