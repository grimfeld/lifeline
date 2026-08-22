import type { WorkTypeId } from "../domain/workTypes";
import type { LookupSettings } from "../domain/types";
import { searchOpenLibrary, type WorkHit } from "./openlibrary";
import { googleBooksSearch } from "./providers/googlebooks";
import { comicVineSearch } from "./providers/comicvine";

export type SearchFn = (q: string, signal?: AbortSignal) => Promise<WorkHit[]>;

/** Keys only — what the composition needs; the full settings record satisfies it. */
export type LookupKeys = Partial<Pick<LookupSettings, "comicvineKey" | "googleBooksKey">>;

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
 * The lookup for a medium (ADR 0024, Library's slice of the old chain):
 *   book  → Open Library, then Google Books
 *   comic → Open Library, then ComicVine (key), then Google Books
 */
export function lookupFor(type: WorkTypeId, settings: LookupKeys = {}): SearchFn | null {
  const gb = googleBooksSearch(settings.googleBooksKey || undefined);
  switch (type) {
    case "book":
      return chain(searchOpenLibrary, gb);
    case "comic":
      return chain(searchOpenLibrary, ...(settings.comicvineKey ? [comicVineSearch(settings.comicvineKey)] : []), gb);
    default:
      return null;
  }
}

/** Human description of the providers behind `lookupFor` for the same inputs. */
export function describeLookup(type: WorkTypeId, settings: LookupKeys = {}): string {
  if (type === "comic") return settings.comicvineKey ? "Open Library, then ComicVine, then Google Books" : "Open Library, then Google Books (ComicVine: key needed)";
  return "Open Library, then Google Books";
}

/** Minimum gap between consecutive lookups (Enrich all walks items sequentially). */
export function lookupGapMs(_type: WorkTypeId): number {
  return 300;
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
