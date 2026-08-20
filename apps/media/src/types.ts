import type { DocumentTypeDef, FieldDef } from "@lifeline/core";
import { Book, BookOpen, Film, Gamepad2, Music, Quote as QuoteIcon, Tv } from "lucide-react";
import { ACQUISITION, ENGAGEMENT, MEDIA_SETTINGS, MEDIA_TYPE_IDS, QUOTES, type MediaItem, type Quote } from "./domain/types";
import { MEDIA_TYPES, type MediaTypeId } from "./domain/mediaTypes";
import { quoteName } from "./domain/quotes";
import { MEDIA_HREF, QUOTES_HREF } from "./constants";

const ACQ_LABELS: Record<string, string> = { WANTED: "Wanted", OWNED: "Owned", BORROWED: "Borrowed", GONE: "Gone" };
const ENG_LABELS: Record<string, string> = { UNSTARTED: "Not started", IN_PROGRESS: "In progress", DONE: "Done", ABANDONED: "Dropped" };

/**
 * The fields every medium's Document type shares — the media model is
 * medium-neutral (ADR 0006); only labels differ, and those live in
 * MEDIA_TYPES, not in the schema. Shelf moves, slots and the auto-stamped
 * days are guarded: they change only through the App's transitions
 * (domain/rules.ts), never by a Base's raw write.
 */
const MEDIA_FIELDS: FieldDef[] = [
  { key: "creator", label: "Creator", kind: "text", column: true },
  { key: "year", label: "Year", kind: "number", column: true },
  { key: "size", label: "Size", kind: "number" },
  { key: "acquisition", label: "Owned", kind: "select", options: ACQUISITION.map((v) => ({ value: v, label: ACQ_LABELS[v] })), guarded: true, column: true },
  { key: "engagement", label: "Shelf", kind: "select", options: ENGAGEMENT.map((v) => ({ value: v, label: ENG_LABELS[v] })), guarded: true, column: true },
  { key: "studied", label: "Studied", kind: "boolean" },
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

const ICONS: Record<MediaTypeId, { icon: typeof Book; name: string }> = {
  book: { icon: Book, name: "book-open" },
  comic: { icon: BookOpen, name: "book-open" },
  movie: { icon: Film, name: "film" },
  series: { icon: Tv, name: "film" },
  music: { icon: Music, name: "music" },
  game: { icon: Gamepad2, name: "gamepad" },
};

/**
 * One Document type per medium (all owned by the Media App, ADR 0019): the
 * Document `type` IS the medium, so each medium gets its own Base while the
 * App's screens, cards and rules stay shared.
 */
export const mediaTypeDefs: DocumentTypeDef[] = MEDIA_TYPES.map((t, i) => ({
  id: t.id,
  label: t.plural,
  singular: t.label,
  icon: ICONS[t.id].icon,
  iconName: ICONS[t.id].name,
  titleRule: "name",
  body: "none",
  linkable: { subtitle: (d) => { const m = d as MediaItem; return `${t.label}${m.creator ? " · " + m.creator : ""}`; } },
  href: () => MEDIA_HREF,
  indexes: ["slot", "externalKey"],
  order: 40 + i,
  builtIn: true,
  fields: MEDIA_FIELDS,
}));

export const quoteTypeDef: DocumentTypeDef = {
  id: QUOTES,
  label: "Quotes",
  icon: QuoteIcon,
  iconName: "quote",
  titleRule: "derived",
  titleOf: (d) => `“${quoteName((d as Quote).text ?? "")}”`,
  body: "none",
  linkable: { subtitle: () => "Quote" },
  href: () => QUOTES_HREF,
  indexes: ["mediaId", "capturedOn"],
  order: 46,
  builtIn: true,
  fields: [
    { key: "text", label: "Text", kind: "longtext", required: true, column: true },
    { key: "mediaId", label: "Media item", kind: "link", linkType: MEDIA_TYPE_IDS, guarded: true, column: true },
    { key: "locator", label: "Locator", kind: "text", column: true },
    { key: "comment", label: "Comment", kind: "longtext" },
    { key: "capturedOn", label: "Captured on", kind: "date", guarded: true, column: true },
  ],
};

export const mediaSettingsTypeDef: DocumentTypeDef = {
  id: MEDIA_SETTINGS,
  label: "Media lookup settings",
  internal: true,
  titleRule: "name",
  body: "none",
  order: 999,
  builtIn: true,
  fields: [
    { key: "tmdbKey", label: "TMDB key", kind: "text" },
    { key: "rawgKey", label: "RAWG key", kind: "text" },
    { key: "comicvineKey", label: "ComicVine key", kind: "text" },
    { key: "googleBooksKey", label: "Google Books key", kind: "text" },
  ],
};
