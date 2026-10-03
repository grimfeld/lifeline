import type { WorkTypeId } from "../domain/workTypes";
import type { LookupSettings } from "../domain/types";
import { isEmptyQuery, searchOpenLibrary, type LookupQuery, type WorkHit } from "./openlibrary";
import { googleBooksSearch } from "./providers/googlebooks";
import { comicVineSearch } from "./providers/comicvine";

export type SearchFn = (q: LookupQuery, signal?: AbortSignal) => Promise<WorkHit[]>;

/** One provider in a chain: the id its hits' external keys start with, and its search. */
interface Provider {
  id: string;
  search: SearchFn;
}

/** Keys only — what the composition needs; the full settings record satisfies it. */
export type LookupKeys = Partial<Pick<LookupSettings, "comicvineKey" | "googleBooksKey">>;

/** The provider a hit came from: the prefix of its external key ("openlibrary", "googlebooks", "comicvine"). */
export const providerOf = (hit: Pick<WorkHit, "externalKey">) => hit.externalKey.split(":")[0] ?? "";

/**
 * Run providers in order; the first one that returns anything wins. Errors in
 * one fall through to the next. A query that names a `provider` (a "More"
 * page) runs that one alone — the chain never restarts on page two.
 */
function chain(...providers: Provider[]): SearchFn {
  return async (q, signal) => {
    if (isEmptyQuery(q)) return [];
    const run = q.provider ? providers.filter((p) => p.id === q.provider) : providers;
    let lastErr: unknown = null;
    for (const p of run) {
      try {
        const hits = await p.search(q, signal);
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
  const ol: Provider = { id: "openlibrary", search: searchOpenLibrary };
  const gb: Provider = { id: "googlebooks", search: googleBooksSearch(settings.googleBooksKey || undefined) };
  switch (type) {
    case "book":
      return chain(ol, gb);
    case "comic":
      return chain(ol, ...(settings.comicvineKey ? [{ id: "comicvine", search: comicVineSearch(settings.comicvineKey) }] : []), gb);
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

/** How long a pick waits on a hit's lazy enrichment before adding the plain hit. */
export const RESOLVE_TIMEOUT_MS = 8000;

/** Merge a hit's lazy enrichment in (on pick). Failures, and a provider that hangs past the timeout, keep the plain hit. */
export async function resolveHit(hit: WorkHit, signal: AbortSignal = AbortSignal.timeout(RESOLVE_TIMEOUT_MS)): Promise<WorkHit> {
  if (!hit.resolve) return hit;
  try {
    const extra = await hit.resolve(signal);
    const { resolve: _r, ...plain } = hit;
    return { ...plain, ...Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== undefined && v !== "" && v !== 0 && !(Array.isArray(v) && v.length === 0))) } as WorkHit;
  } catch {
    return hit;
  }
}
