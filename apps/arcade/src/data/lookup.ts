import type { WorkTypeId } from "../domain/workTypes";
import type { LookupSettings } from "../domain/types";
import type { WorkHit } from "./providers/rawg";
import { rawgSearch } from "./providers/rawg";

export type SearchFn = (q: string, signal?: AbortSignal) => Promise<WorkHit[]>;
export type { WorkHit };

/** Keys only — what the composition needs; the full settings record satisfies it. */
export type LookupKeys = Partial<Pick<LookupSettings, "rawgKey">>;

/** The lookup for games (ADR 0024, the Arcade's slice of the old chain): RAWG, key required. */
export function lookupFor(_type: WorkTypeId, settings: LookupKeys = {}): SearchFn | null {
  return settings.rawgKey ? rawgSearch(settings.rawgKey) : null;
}

export function describeLookup(_type: WorkTypeId, settings: LookupKeys = {}): string {
  return settings.rawgKey ? "RAWG" : "RAWG (key needed)";
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
    return { ...plain, ...Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== undefined && v !== "" && v !== 0)) } as WorkHit;
  } catch {
    return hit;
  }
}
