import type { DocumentTypeDef, FieldDef } from "@lifeline/core";
import { ListMusic, Music } from "lucide-react";
import { ENGAGEMENT, PLAYLIST, type Work } from "./domain/types";
import { WORK_TYPES } from "./domain/workTypes";
import { APP_HREF } from "./constants";
import { PlaylistPeek, WorkPeek } from "./components/DiscothequePeeks";
import { cascadeWorkDelete } from "./data/repo";
import { discothequeParts } from "./parts";

const ENG_LABELS: Record<(typeof ENGAGEMENT)[number], string> = { UNSTARTED: "Not started", IN_PROGRESS: "In progress", DONE: "Done", ABANDONED: "Dropped" };

/**
 * The music type (ADR 0024, type id unchanged from Media — no data
 * migration): the Shelf only — streamed media have no Acquisition. Shelf
 * moves and the auto-stamped days are guarded (ADR 0019).
 */
const WORK_FIELDS: FieldDef[] = [
  { key: "creator", label: "Creator", kind: "text", column: true },
  { key: "year", label: "Year", kind: "number", column: true },
  { key: "size", label: "Size", kind: "number" },
  { key: "engagement", label: "Shelf", kind: "select", options: ENGAGEMENT.map((v) => ({ value: v, label: ENG_LABELS[v] })), guarded: true, column: true },
  { key: "liked", label: "Liked", kind: "boolean", column: true },
  { key: "rating", label: "Rating", kind: "number", column: true },
  { key: "reason", label: "Reason", kind: "longtext" },
  { key: "coverUrl", label: "Cover URL", kind: "url" },
  { key: "externalKey", label: "External key", kind: "text", hidden: true },
  { key: "addedOn", label: "Added on", kind: "date", guarded: true },
  { key: "startedOn", label: "Started on", kind: "date", guarded: true },
  { key: "finishedOn", label: "Finished on", kind: "date", guarded: true },
  // Parts (ADR 0074): moved through the Parts, never typed.
  { key: "partsTracked", label: "Parts tracked", kind: "boolean", guarded: true },
  { key: "caughtUpGroup", label: "Caught up to (group)", kind: "number", guarded: true, hidden: true },
  { key: "caughtUpPart", label: "Caught up to", kind: "number", guarded: true },
];

export const workTypeDefs: DocumentTypeDef[] = WORK_TYPES.map((t) => ({
  id: t.id,
  label: t.plural,
  singular: t.label,
  icon: Music,
  iconName: "music",
  titleRule: "name",
  body: "optional",
  linkable: { subtitle: (d) => { const m = d as Work; return `${t.label}${m.creator ? " · " + m.creator : ""}`; } },
  href: () => APP_HREF,
  indexes: ["externalKey"],
  order: 44,
  builtIn: true,
  fields: WORK_FIELDS,
  // Edited where it is peeked, through the App's own controls (ADR 0085).
  peekEdit: WorkPeek,
  // Its Parts and Groups die with it and follow it to another Workspace (ADR 0074).
  ...discothequeParts.workTypeHooks,
  // Its Quotes and Playlist places go with it too, from wherever it is deleted (ADR 0045).
  onDelete: async (doc) => {
    await discothequeParts.workTypeHooks.onDelete(doc);
    await cascadeWorkDelete(doc.id);
  },
}));

/** A Playlist (ADR 0035): its albums are an ordered, guarded list of ids; the body is its blurb. */
export const playlistTypeDef: DocumentTypeDef = {
  id: PLAYLIST,
  label: "Playlists",
  icon: ListMusic,
  iconName: "list",
  titleRule: "name",
  body: "optional",
  href: () => APP_HREF,
  order: 47,
  builtIn: true,
  peekEdit: PlaylistPeek,
  fields: [
    { key: "workIds", label: "Albums", kind: "json", guarded: true },
    { key: "ranked", label: "Ranked", kind: "boolean", column: true },
  ],
};
