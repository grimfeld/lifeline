import type { ArtworkHit } from "../data/wikidata";
import type { Artwork } from "./types";
import type { Patch } from "./rules";

/**
 * How lookup results touch an Artwork (ADR 0022, Media's semantics): a
 * lookup fills *empty* fields only and never overwrites what the user
 * typed; a refresh re-pulls the image for a work that already has an
 * external identity. The artist link is handled by the caller (ensureArtist).
 */

type Fillable = Pick<Artwork, "year" | "imageUrl" | "location" | "materials" | "dimensions" | "externalKey">;

/** Fill only the empty fields from the hit; externalKey is set whenever the work has none. */
export function applyHit(work: Fillable, hit: ArtworkHit): Patch {
  const patch: Patch = {};
  if (!work.year && hit.year) patch.year = hit.year;
  if (!work.imageUrl && hit.imageUrl) patch.imageUrl = hit.imageUrl;
  if (!work.location && hit.location) patch.location = hit.location;
  if (!work.materials && hit.materials) patch.materials = hit.materials;
  if (!work.dimensions && hit.dimensions) patch.dimensions = hit.dimensions;
  if (!work.externalKey && hit.externalKey) patch.externalKey = hit.externalKey;
  return patch;
}

/** Overwrite the image from the source (never the user's words). Empty hit values leave the field alone. */
export function refreshFromHit(work: Fillable, hit: ArtworkHit): Patch {
  const patch: Patch = {};
  if (hit.imageUrl && hit.imageUrl !== work.imageUrl) patch.imageUrl = hit.imageUrl;
  if (!work.externalKey && hit.externalKey) patch.externalKey = hit.externalKey;
  return patch;
}

/** Case/punctuation/diacritic-insensitive title key. */
export function normalizeTitle(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** The one hit whose title matches exactly (normalized) — null if none or several. */
export function confidentMatch(title: string, hits: ArtworkHit[]): ArtworkHit | null {
  const key = normalizeTitle(title);
  if (!key) return null;
  const matching = hits.filter((h) => normalizeTitle(h.title) === key);
  return matching.length === 1 ? matching[0]! : null;
}
