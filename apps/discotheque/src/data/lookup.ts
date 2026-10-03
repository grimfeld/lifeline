import type { WorkTypeId } from "../domain/workTypes";
import { searchMusicBrainz, type WorkHit } from "./musicbrainz";

export type SearchFn = (q: string, signal?: AbortSignal) => Promise<WorkHit[]>;
export type { WorkHit };

/** Keyless (ADR 0024): MusicBrainz asks for identification, never a key. */
export type LookupKeys = Record<string, never>;

/** The lookup for albums: MusicBrainz, always available. */
export function lookupFor(_type: WorkTypeId, _settings: LookupKeys = {}): SearchFn | null {
  return searchMusicBrainz;
}

export function describeLookup(_type: WorkTypeId, _settings: LookupKeys = {}): string {
  return "MusicBrainz";
}

/** MusicBrainz asks for one request per second; Enrich all obeys. */
export function lookupGapMs(_type: WorkTypeId): number {
  return 1100;
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
