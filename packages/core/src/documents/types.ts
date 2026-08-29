import type * as React from "react";
import type { SyncedRecord } from "../data/db";

/**
 * The Document (ADR 0018): the one basic block. Every user-facing record is
 * a Document of exactly one Document type. Locally a Document is a flat row
 * — the common keys below plus the type's own fields; the sync layer packs
 * the type fields into PocketBase's `fields` JSON column and spreads them
 * back on pull, so App code reads `task.date`, never `task.fields.date`.
 */
export interface Document extends SyncedRecord {
  type: string;
  /** Free, dated or derived title (see DocumentTypeDef.titleRule). Stored even when derived, so Bases sort on it. */
  title: string;
  /** Markdown body; only when the type allows a body. */
  body?: string;
  /** Normalised Tags (ADR 0014): the explicit ones ∪ `#tags` found in the body. */
  tags: string[];
  /** Folder path (ADR 0013); "" = root. Every Document has one; only the Vault tree cares. */
  folder: string;
  /** "YYYY-MM-DD" day the Document was created. */
  createdAt: string;
  /** Type-specific fields, flat. */
  [field: string]: unknown;
}

/** Keys every Document has; everything else on a row is a type field. */
export const DOCUMENT_COMMON_KEYS = ["id", "type", "title", "body", "tags", "folder", "createdAt", "updatedAt", "deleted"] as const;
export type DocumentCommonKey = (typeof DOCUMENT_COMMON_KEYS)[number];

export function isCommonKey(k: string): k is DocumentCommonKey {
  return (DOCUMENT_COMMON_KEYS as readonly string[]).includes(k);
}

/** A Document's type fields only (no common keys). */
export function typeFieldsOf(doc: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(doc)) if (!isCommonKey(k)) out[k] = v;
  return out;
}

export type FieldKind =
  | "text"
  | "longtext"
  | "number"
  | "boolean"
  | "date"
  | "datetime"
  | "select"
  | "multiselect"
  | "url"
  | "geo"
  | "list"
  | "link"
  /** An opaque structured value (a Chore's schedule): shown as JSON, never edited generically. */
  | "json";

export interface FieldOption {
  value: string;
  label: string;
}

/**
 * A Field of a Document type (CONTEXT.md "Field"): typed, edited as a form,
 * shown as a Base column, read/written as frontmatter in text mode.
 */
export interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  /** select / multiselect. */
  options?: FieldOption[];
  /** link: restrict to one Document type or a family of them (undefined = any linkable type). */
  linkType?: string | string[];
  /** Only the owning App's operations may write it (ADR 0019): Bases and text mode show it read-only. */
  guarded?: boolean;
  required?: boolean;
  /** Hidden from Bases/forms by default (internal bookkeeping such as ids). */
  hidden?: boolean;
  /** Shown in the Base table by default. Defaults to true for the first few visible fields. */
  column?: boolean;
}

/** Value shapes per field kind, as stored on the row. */
export type FieldValue = string | number | boolean | string[] | [number, number] | null | undefined;

export type BodyPolicy = "required" | "optional" | "none";
export type TitleRule = "name" | "date" | "derived";

/**
 * A Document type (ADR 0019). Built-in types are defined in code inside the
 * owning App and registered through its manifest; user-defined types are
 * rows of Core's `document_types` collection. Both land in one registry.
 */
export interface DocumentTypeDef {
  /** Slug, immutable. */
  id: string;
  /** The type's one display name — plural, since Documents mostly appear in numbers ("Tasks", "Recipes"). */
  label: string;
  /** Only for the rare case where stripping the trailing "s" gives the wrong singular ("Series", "Entries" → "Entry"); everything else derives (see singularOf). */
  singular?: string;
  icon?: React.ComponentType<{ className?: string }>;
  /** Icon name (curated set) — what user-defined types store. */
  iconName?: string;
  /** Owning App id for built-in types; undefined for user-defined. */
  appId?: string;
  /** Exists only in service of another Document (a Writing's Versions): hidden from the tree, link completion and sidebar; still has a Base. */
  internal?: boolean;
  /** Shown in the Vault tree even without a body (body-first types). Defaults to body === "required". */
  vault?: boolean;
  titleRule: TitleRule;
  /** Derived title, for titleRule "derived" (and as a display fallback when `title` is empty). */
  titleOf?: (doc: Document) => string;
  body: BodyPolicy;
  fields: FieldDef[];
  /** Default folder for new Documents ("" = root). */
  folder?: string;
  /** Body template for a new Document. */
  template?: string;
  /**
   * Extra Dexie indexes for hot queries. A bare field name becomes the
   * compound index `[type+field]`; a bracketed compound is used verbatim.
   */
  indexes?: string[];
  /**
   * Linkable (data-declarable Contract): Documents are wikilink targets by
   * title and by the `aliases` list field (or the named field). `expand`
   * (ADR 0032) lets a type read a written name its own way and say which of
   * its titles it stands for — a scripture range `John 3:16–18` → three
   * Verse titles — or null when the name is not its business. `mentions:
   * false` keeps the type's Documents out of Unlinked mentions (CONTEXT.md):
   * still wikilink targets, never offered from plain prose.
   */
  linkable?: boolean | { aliasesField?: string; subtitle?: (doc: Document) => string | undefined; expand?: (name: string) => string[] | null; mentions?: boolean };
  /** Locatable (data-declarable Contract): the geo field holding `[lat, lon]`, or a reader. */
  locatable?: string | ((doc: Document) => { lat: number; lon: number } | null);
  /** Route that opens one Document. Default: the Vault's generic page `/vault/d/<id>`. */
  href?: (doc: Document) => string;
  /** Sync conflict hook (ADR 0010): may rescue a losing local edit. Absent = plain LWW. */
  onConflict?: (local: Document, server: Document) => Promise<void>;
  /** Sort order in pickers / the Bases list. */
  order?: number;
  /** Built-in (code) vs user-defined (data). */
  builtIn: boolean;
  /** A built-in whose label/icon/fields were customised by a user record. */
  overridden?: boolean;
}

/** A Document of a known shape: `Document` narrowed by an App's own interface. */
export type Typed<T> = T & Document;

/** Read a `[lat, lon]` geo field value (tolerates a legacy "lat,lon" string). */
export function readGeo(v: unknown): { lat: number; lon: number } | null {
  const parts = Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : [];
  if (parts.length !== 2) return null;
  const lat = Number(String(parts[0]).trim());
  const lon = Number(String(parts[1]).trim());
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

/** Geo field value for coordinates; null clears. */
export function writeGeo(c: { lat: number; lon: number } | null): [number, number] | null {
  return c ? [c.lat, c.lon] : null;
}

/** Display title of a Document: stored title, else the type's derived title, else "(untitled)". */
export function displayTitle(doc: Document, def?: Pick<DocumentTypeDef, "titleOf"> | null): string {
  if (doc.title) return doc.title;
  const t = def?.titleOf?.(doc);
  return t || "(untitled)";
}

/** Aliases of a Document for link resolution (the `aliases` list field by default). */
export function aliasesOf(doc: Document, def?: Pick<DocumentTypeDef, "linkable"> | null): string[] {
  const l = def?.linkable;
  const key = typeof l === "object" && l?.aliasesField ? l.aliasesField : "aliases";
  const v = doc[key];
  return Array.isArray(v) ? v.map(String).filter(Boolean) : typeof v === "string" && v ? [v] : [];
}

/** Coordinates of a Document per its type's Locatable declaration. */
export function geoOf(doc: Document, def?: Pick<DocumentTypeDef, "locatable"> | null): { lat: number; lon: number } | null {
  const l = def?.locatable;
  if (!l) return null;
  if (typeof l === "function") return l(doc);
  return readGeo(doc[l]);
}

/** Singular of a Document type: the rare code-side override, else the label minus its trailing "s". */
export function singularOf(def: Pick<DocumentTypeDef, "label" | "singular">): string {
  if (def.singular) return def.singular;
  return /[a-rt-z]s$/i.test(def.label) ? def.label.slice(0, -1) : def.label;
}

/** Slug for a user-defined type id from its label: "Recipe idea" → "recipe-idea". */
export function slugify(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
