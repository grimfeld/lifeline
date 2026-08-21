import type { Document, DocumentTypeDef, FieldDef } from "@lifeline/core";
import { Amphora, Building2, Camera, Frame, Palette, Pencil, User } from "lucide-react";
import { ART_FORMS, type ArtFormId } from "./domain/artForms";
import { ARTIST, EXHIBITION, EXHIBITION_STATES, ROOM, type Artwork } from "./domain/types";
import { STATE_LABELS } from "./domain/rules";
import { exhibitionHref, MUSEUM_HREF } from "./constants";

const ICONS: Record<ArtFormId, { icon: typeof Palette; name: string }> = {
  painting: { icon: Palette, name: "palette" },
  drawing: { icon: Pencil, name: "pen-line" },
  photography: { icon: Camera, name: "film" },
  sculpture: { icon: Amphora, name: "landmark" },
  architecture: { icon: Building2, name: "building" },
};

/**
 * One Document type per art form (all owned by the Museum App, ADR 0022):
 * the Document `type` IS the form, so each form gets its own Base while the
 * App's screens, cards and rules stay shared. Architecture alone declares
 * Locatable through its geo field.
 */
export const artworkTypeDefs: DocumentTypeDef[] = ART_FORMS.map((f, i) => ({
  id: f.id,
  label: f.plural,
  singular: f.label,
  icon: ICONS[f.id].icon,
  iconName: ICONS[f.id].name,
  titleRule: "name",
  body: "optional",
  linkable: { subtitle: (d) => { const a = d as Artwork; return `${f.label}${a.year ? " · " + a.year : ""}`; } },
  ...(f.locatable ? { locatable: "geo" } : {}),
  href: () => MUSEUM_HREF,
  indexes: ["artistId", "externalKey"],
  order: 50 + i,
  builtIn: true,
  fields: [
    { key: "artistId", label: f.artistLabel, kind: "link", linkType: ARTIST, column: true },
    { key: "year", label: "Year", kind: "text", column: true },
    ...(f.hasMaterials
      ? ([
          { key: "materials", label: "Materials", kind: "text", column: true },
          { key: "dimensions", label: "Dimensions", kind: "text" },
        ] satisfies FieldDef[])
      : []),
    { key: "location", label: "Location", kind: "text", column: true },
    ...(f.locatable ? ([{ key: "geo", label: "Coordinates", kind: "geo" }] satisfies FieldDef[]) : []),
    { key: "seen", label: "Seen", kind: "boolean", column: true },
    { key: "imageUrl", label: "Image URL", kind: "url" },
    { key: "externalKey", label: "External key", kind: "text", hidden: true },
    { key: "addedOn", label: "Added on", kind: "date", guarded: true },
  ],
}));

export const artistTypeDef: DocumentTypeDef = {
  id: ARTIST,
  label: "Artists",
  icon: User,
  iconName: "user",
  titleRule: "name",
  body: "optional",
  linkable: { subtitle: (d) => `Artist${(d as { years?: string }).years ? " · " + (d as { years?: string }).years : ""}` },
  href: () => MUSEUM_HREF,
  indexes: ["externalKey"],
  order: 55,
  builtIn: true,
  fields: [
    { key: "aliases", label: "Aliases", kind: "list" },
    { key: "years", label: "Years", kind: "text", column: true },
    { key: "imageUrl", label: "Portrait URL", kind: "url" },
    { key: "externalKey", label: "External key", kind: "text", hidden: true },
  ],
};

export const exhibitionTypeDef: DocumentTypeDef = {
  id: EXHIBITION,
  label: "Exhibitions",
  icon: Frame,
  iconName: "landmark",
  titleRule: "name",
  body: "optional",
  linkable: { subtitle: (d) => `Exhibition · ${STATE_LABELS[(d as { state?: string }).state as keyof typeof STATE_LABELS] ?? "In preparation"}` },
  href: (d: Document) => exhibitionHref(d.id),
  order: 56,
  builtIn: true,
  fields: [
    { key: "state", label: "State", kind: "select", options: EXHIBITION_STATES.map((s) => ({ value: s, label: STATE_LABELS[s] })), guarded: true, column: true },
    { key: "hungOn", label: "Hung on", kind: "date", guarded: true, column: true },
    { key: "archivedOn", label: "Archived on", kind: "date", guarded: true },
  ],
};

/** Rooms exist only in service of their Exhibition (internal, ADR 0019). */
export const roomTypeDef: DocumentTypeDef = {
  id: ROOM,
  label: "Rooms",
  internal: true,
  titleRule: "name",
  body: "none",
  href: (d: Document) => exhibitionHref((d as { exhibitionId?: string }).exhibitionId ?? ""),
  indexes: ["exhibitionId"],
  order: 57,
  builtIn: true,
  fields: [
    { key: "exhibitionId", label: "Exhibition", kind: "link", linkType: EXHIBITION, guarded: true, column: true },
    { key: "order", label: "Order", kind: "number", guarded: true, column: true },
    { key: "artworkIds", label: "Artworks", kind: "json", guarded: true },
  ],
};

export const museumTypeDefs: DocumentTypeDef[] = [...artworkTypeDefs, artistTypeDef, exhibitionTypeDef, roomTypeDef];
