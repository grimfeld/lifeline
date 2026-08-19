import type { MediaTypeId } from "../domain/mediaTypes";
import type { MediaSettings } from "../domain/types";
import { searchOpenLibrary, type WorkHit } from "./openlibrary";
import { searchMusicBrainz } from "./musicbrainz";
import { tmdbSearch } from "./providers/tmdb";
import { rawgSearch } from "./providers/rawg";
import { googleBooksSearch } from "./providers/googlebooks";
import { comicVineSearch } from "./providers/comicvine";

export type SearchFn = (q: string, signal?: AbortSignal) => Promise<WorkHit[]>;

/** Keys only — what the composition needs; the full settings record satisfies it. */
export type LookupKeys = Partial<Pick<MediaSettings, "tmdbKey" | "rawgKey" | "comicvineKey" | "googleBooksKey">>;

/** Run providers in order; the first one that returns anything wins. Errors in one fall through to the next. */
function chain(...fns: SearchFn[]): SearchFn {
  return async (q, signal) => {
    let lastErr: unknown = null;
    for (const fn of fns) {
      try {
        const hits = await fn(q, signal);
        if (hits.length > 0) return hits;
      } catch (e) {
        if ((e as Error)?.name === "AbortError") throw e;
        lastErr = e;
      }
    }
    if (lastErr) throw lastErr;
    return [];
  };
}

/**
 * The lookup for a medium given the provider keys, or null when none applies
 * (ADR 0006 amendment, metadata lookups):
 *   book   → Open Library, then Google Books
 *   comic  → Open Library, then ComicVine (key), then Google Books
 *   movie/series → TMDB (key)
 *   music  → MusicBrainz
 *   game   → RAWG (key)
 */
export function lookupFor(type: MediaTypeId, settings: LookupKeys = {}): SearchFn | null {
  const gb = googleBooksSearch(settings.googleBooksKey || undefined);
  switch (type) {
    case "book":
      return chain(searchOpenLibrary, gb);
    case "comic":
      return chain(searchOpenLibrary, ...(settings.comicvineKey ? [comicVineSearch(settings.comicvineKey)] : []), gb);
    case "movie":
      return settings.tmdbKey ? tmdbSearch("movie", settings.tmdbKey) : null;
    case "series":
      return settings.tmdbKey ? tmdbSearch("tv", settings.tmdbKey) : null;
    case "music":
      return searchMusicBrainz;
    case "game":
      return settings.rawgKey ? rawgSearch(settings.rawgKey) : null;
    default:
      return null;
  }
}

/** Human description of the providers behind `lookupFor` for the same inputs, e.g. "TMDB (key needed)". */
export function describeLookup(type: MediaTypeId, settings: LookupKeys = {}): string {
  switch (type) {
    case "book":
      return "Open Library, then Google Books";
    case "comic":
      return settings.comicvineKey ? "Open Library, then ComicVine, then Google Books" : "Open Library, then Google Books (ComicVine: key needed)";
    case "movie":
    case "series":
      return settings.tmdbKey ? "TMDB" : "TMDB (key needed)";
    case "music":
      return "MusicBrainz";
    case "game":
      return settings.rawgKey ? "RAWG" : "RAWG (key needed)";
    default:
      return "—";
  }
}

/** Minimum gap between consecutive lookups for a medium (Enrich all walks items sequentially). */
export function lookupGapMs(type: MediaTypeId): number {
  return type === "music" ? 1100 : 300;
}

/** Merge a hit's lazy enrichment in (on pick). Failures keep the plain hit. */
export async function resolveHit(hit: WorkHit): Promise<WorkHit> {
  if (!hit.resolve) return hit;
  try {
    const extra = await hit.resolve();
    const { resolve: _r, ...plain } = hit;
    return { ...plain, ...Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== undefined && v !== "" && v !== 0)) } as WorkHit;
  } catch {
    return hit;
  }
}
