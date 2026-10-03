import type { DocumentTypeDef, FieldDef } from "@lifeline/core";
import { Film, ListVideo, Tv } from "lucide-react";
import { ENGAGEMENT, PLAYLIST, SETTINGS_TYPE, type Work } from "./domain/types";
import { WORK_TYPES, type WorkTypeId } from "./domain/workTypes";
import { APP_HREF } from "./constants";
import { cascadeWorkDelete } from "./data/repo";

const ENG_LABELS: Record<string, string> = { UNSTARTED: "Not started", IN_PROGRESS: "In progress", DONE: "Done", ABANDONED: "Dropped" };

/**
 * The watching family's shared fields (ADR 0024, type ids unchanged from
 * Media — no data migration): the Shelf only — streamed media have no
 * Acquisition. Shelf moves and the auto-stamped days are guarded (ADR 0019).
 * The Marks (ADR 0035) are plain: nothing to guard. The Review is the body.
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
];

const ICONS: Record<WorkTypeId, { icon: typeof Film; name: string }> = {
  movie: { icon: Film, name: "film" },
  series: { icon: Tv, name: "film" },
};

export const workTypeDefs: DocumentTypeDef[] = WORK_TYPES.map((t, i) => ({
  id: t.id,
  label: t.plural,
  singular: t.label,
  icon: ICONS[t.id].icon,
  iconName: ICONS[t.id].name,
  titleRule: "name",
  body: "optional",
  linkable: { subtitle: (d) => { const m = d as Work; return `${t.label}${m.creator ? " · " + m.creator : ""}`; } },
  href: () => APP_HREF,
  indexes: ["externalKey"],
  order: 42 + i,
  builtIn: true,
  fields: WORK_FIELDS,
  // Its Quotes (and Playlist places) go with it, from wherever it is deleted (ADR 0045).
  onDelete: (doc) => cascadeWorkDelete(doc.id),
}));

/** A Playlist (ADR 0035): its works are an ordered, guarded list of ids; the body is its blurb. */
export const playlistTypeDef: DocumentTypeDef = {
  id: PLAYLIST,
  label: "Playlists",
  icon: ListVideo,
  iconName: "list",
  titleRule: "name",
  body: "optional",
  href: () => APP_HREF,
  order: 46,
  builtIn: true,
  fields: [
    { key: "workIds", label: "Works", kind: "json", guarded: true },
    { key: "ranked", label: "Ranked", kind: "boolean", column: true },
  ],
};

export const settingsTypeDef: DocumentTypeDef = {
  id: SETTINGS_TYPE,
  label: "Cinema lookup settings",
  internal: true,
  titleRule: "name",
  body: "none",
  order: 999,
  builtIn: true,
  fields: [{ key: "tmdbKey", label: "TMDB key", kind: "text" }],
};
