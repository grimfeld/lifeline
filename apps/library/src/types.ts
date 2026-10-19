import type { DocumentTypeDef, FieldDef, RoleDef } from "@lifeline/core";
import { Book, BookOpen, UserPen } from "lucide-react";
import { ACQUISITION, AUTHOR, ENGAGEMENT, SETTINGS_TYPE } from "./domain/types";
import { WORK_TYPES, type WorkTypeId } from "./domain/workTypes";
import { APP_HREF } from "./constants";
import { cascadeWorkDelete } from "./data/repo";
import { libraryParts } from "./parts";
import { AuthorPeek, WorkPeek } from "./components/LibraryPeeks";

const ACQ_LABELS: Record<string, string> = { WANTED: "Wanted", OWNED: "Owned", BORROWED: "Borrowed", GONE: "Gone" };
const ENG_LABELS: Record<string, string> = { UNSTARTED: "Not started", IN_PROGRESS: "In progress", DONE: "Done", ABANDONED: "Dropped" };

/**
 * The fields books, comics and manga share (ADR 0024): both axes plus the
 * Nightstand slot — the reading family keeps everything the old Media model
 * had except Studied. Shelf moves, slots and the auto-stamped days are
 * guarded (ADR 0019). The Marks are plain and the Review is the body
 * (ADR 0074, as Cinema's — ADR 0035).
 */
const WORK_FIELDS: FieldDef[] = [
  { key: "authors", label: "Authors", kind: "links", linkRole: AUTHOR, column: true },
  { key: "year", label: "Year", kind: "number", column: true },
  { key: "size", label: "Size", kind: "number" },
  { key: "acquisition", label: "Owned", kind: "select", options: ACQUISITION.map((v) => ({ value: v, label: ACQ_LABELS[v] })), guarded: true, column: true },
  { key: "engagement", label: "Shelf", kind: "select", options: ENGAGEMENT.map((v) => ({ value: v, label: ENG_LABELS[v] })), guarded: true, column: true },
  { key: "liked", label: "Liked", kind: "boolean", column: true },
  { key: "rating", label: "Rating", kind: "number", column: true },
  { key: "reason", label: "Reason", kind: "longtext" },
  { key: "slot", label: "Nightstand slot", kind: "number", guarded: true },
  { key: "coverUrl", label: "Cover URL", kind: "url" },
  { key: "externalKey", label: "External key", kind: "text", hidden: true },
  { key: "addedOn", label: "Added on", kind: "date", guarded: true },
  { key: "acquiredOn", label: "Acquired on", kind: "date", guarded: true },
  { key: "slottedOn", label: "Slotted on", kind: "date", guarded: true },
  { key: "startedOn", label: "Started on", kind: "date", guarded: true },
  { key: "finishedOn", label: "Finished on", kind: "date", guarded: true },
  // Parts (ADR 0074): moved through the Parts, never typed.
  { key: "partsTracked", label: "Parts tracked", kind: "boolean", guarded: true },
  { key: "caughtUpGroup", label: "Caught up to (group)", kind: "number", guarded: true, hidden: true },
  { key: "caughtUpPart", label: "Caught up to", kind: "number", guarded: true },
  { key: "partCount", label: "Chapters", kind: "number" },
];

const ICONS: Record<WorkTypeId, { icon: typeof Book; name: string }> = {
  book: { icon: Book, name: "book-open" },
  comic: { icon: BookOpen, name: "book-open" },
  manga: { icon: BookOpen, name: "book-open" },
};

/** One Document type per medium (type ids unchanged from Media — no data migration). */
export const workTypeDefs: DocumentTypeDef[] = WORK_TYPES.map((t, i) => ({
  id: t.id,
  label: t.plural,
  singular: t.label,
  icon: ICONS[t.id].icon,
  iconName: ICONS[t.id].name,
  titleRule: "name",
  body: "optional",
  linkable: { subtitle: () => t.label },
  href: () => APP_HREF,
  indexes: ["slot", "externalKey"],
  order: 40 + i,
  builtIn: true,
  fields: WORK_FIELDS,
  // Edited where it is peeked, through the Library's own controls (ADR 0085).
  peekEdit: WorkPeek,
  // Its Parts and Groups die with it and follow it to another Workspace (ADR 0074).
  ...libraryParts.workTypeHooks,
  // Its Quotes go with it too, from wherever it is deleted (ADR 0045).
  onDelete: async (doc) => {
    await libraryParts.workTypeHooks.onDelete(doc);
    await cascadeWorkDelete(doc.id);
  },
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
  peekEdit: AuthorPeek,
  fields: [
    { key: "aliases", label: "Aliases", kind: "list" },
    { key: "born", label: "Born", kind: "text", column: true },
    { key: "died", label: "Died", kind: "text", column: true },
    { key: "photoUrl", label: "Photo URL", kind: "url" },
    { key: "externalKey", label: "External key", kind: "text", hidden: true },
  ],
};

/**
 * The Author Role (ADR 0069): what makes a Document an Author without making
 * it of the Author type — my user-defined Person `Ursula Le Guin` wears it, and
 * her books name her. Lends the Author's own facts; the wearer keeps its own
 * title, aliases and body. The Author type is its home: an author who is
 * nobody else is simply an Author.
 */
export const authorRole: RoleDef = {
  id: AUTHOR,
  label: "Author",
  homeType: AUTHOR,
  fields: authorTypeDef.fields.filter((f) => f.key !== "aliases"),
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
