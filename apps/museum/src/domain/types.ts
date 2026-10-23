import type { DateStr, Document } from "@lifeline/core";
import type { ArtFormId } from "./artForms";

/**
 * An Artwork (CONTEXT.md): a work of classical art in the Holdings. Each art
 * form is its own Document type (`painting`, `drawing`, `photography`,
 * `sculpture`, `architecture` — one Base each), all owned by the one Museum
 * App. `year` is free text because art history says "c. 1503" and
 * "1501–1504"; the optional body is my own commentary — why it is in my
 * museum.
 */
export interface Artwork extends Document {
  /** The Document type IS the art form. */
  type: ArtFormId;
  /** Link to the `artist` Document. "" = unknown. */
  artistId: string;
  /** Free text — "c. 1503", "1501–1504", "12th century". */
  year: string;
  /** The image IS the exhibit; URL-only (ADR 0022 — no file storage). */
  imageUrl: string;
  /** Where the work physically is, in words — "Musée Rodin, Paris". */
  location: string;
  /** Object forms only: "oil on canvas", "marble". */
  materials: string;
  /** Object forms only: "77 × 53 cm". */
  dimensions: string;
  /** I have stood before the real thing. A fact, not a visit log. */
  seen: boolean;
  /** Architecture only: [lat, lon] — the Locatable coordinates. */
  geo?: [number, number] | null;
  /** External identity for lookups/dedupe, e.g. "wikidata:Q12418". "" = none. */
  externalKey: string;
  addedOn: DateStr;
}

/**
 * An Artist (CONTEXT.md): who made an Artwork — person, workshop or firm.
 * A Linkable Reference; "works by" is always backlinks, never a stored list.
 */
export interface Artist extends Document {
  aliases: string[];
  /** Free text — "1840–1917". */
  years: string;
  /** A portrait. */
  imageUrl: string;
  externalKey: string;
}

/**
 * An Exhibition (CONTEXT.md): a named, curated selection of Artworks from
 * the Holdings, arranged into ordered Rooms. Lifecycle PREP → HANGING →
 * ARCHIVED; hang / take down are the only verbs and taking down always
 * archives. Several may hang at once. The optional body is the curator's
 * essay.
 */
export const EXHIBITION_STATES = ["PREP", "HANGING", "ARCHIVED"] as const;
export type ExhibitionState = (typeof EXHIBITION_STATES)[number];

export interface Exhibition extends Document {
  state: ExhibitionState;
  hungOn: DateStr;
  archivedOn: DateStr;
}

/**
 * A Room (CONTEXT.md): an internal Document type — a named, ordered section
 * of exactly one Exhibition holding its hung Artworks in order. Free-form:
 * it may mix art forms; no life outside its Exhibition. The artwork order
 * lives in an opaque json list (no field kind holds an ordered list of
 * links).
 */
export interface Room extends Document {
  exhibitionId: string;
  order: number;
  artworkIds: string[];
}

export const ARTIST = "artist";
export const EXHIBITION = "exhibition";
export const ROOM = "room";
