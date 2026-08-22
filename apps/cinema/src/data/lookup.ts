import type { WorkTypeId } from "../domain/workTypes";
import type { LookupSettings } from "../domain/types";
import { tmdbSearch, type WorkHit } from "./providers/tmdb";

export type SearchFn = (q: string, signal?: AbortSignal) => Promise<WorkHit[]>;
export type { WorkHit };

/** Keys only — what the composition needs; the full settings record satisfies it. */
export type LookupKeys = Partial<Pick<LookupSettings, "tmdbKey">>;

/** The lookup (ADR 0024, the Cinema's slice of the old chain): TMDB, key required. */
export function lookupFor(type: WorkTypeId, settings: LookupKeys = {}): SearchFn | null {
  if (!settings.tmdbKey) return null;
  return tmdbSearch(type === "movie" ? "movie" : "tv", settings.tmdbKey);
}

export function describeLookup(_type: WorkTypeId, settings: LookupKeys = {}): string {
  return settings.tmdbKey ? "TMDB" : "TMDB (key needed)";
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
