import { applyHit, confidentMatch, refreshFromHit } from "../domain/enrich";
import type { Patch } from "../domain/rules";
import type { Work, LookupSettings } from "../domain/types";
import { lookupFor, lookupGapMs, resolveHit, type LookupKeys } from "./lookup";
import type { WorkHit } from "./lookup";
import { patchWork } from "./repo";

/** Lookup-driven writes: find candidates for an item, apply a pick, refresh, enrich all. */

export async function findCandidates(item: Work, settings: LookupKeys, signal?: AbortSignal): Promise<WorkHit[]> {
  const search = lookupFor(item.type, settings);
  if (!search) return [];
  return search(item.title, signal);
}

/** Apply a chosen hit (after lazy resolve) to the item — empty fields only. Returns the patch (may be {}). */
export async function applyPick(item: Work, hit: WorkHit): Promise<Patch> {
  const full = await resolveHit(hit);
  const patch = applyHit(item, full);
  if (Object.keys(patch).length) await patchWork(item, patch);
  return patch;
}

/**
 * Re-search by title, take the hit with the item's external key (else the
 * single confident match), overwrite cover/size/year. Null when nothing matched.
 */
export async function refreshFromSource(item: Work, settings: LookupKeys): Promise<Patch | null> {
  const hits = await findCandidates(item, settings);
  const raw = hits.find((h) => h.externalKey === item.externalKey) ?? confidentMatch(item.title, item.year, hits);
  if (!raw) return null;
  const hit = await resolveHit(raw);
  const patch = refreshFromHit(item, hit);
  if (Object.keys(patch).length) await patchWork(item, patch);
  return patch;
}

export interface NeedsPick {
  item: Work;
  hits: WorkHit[];
}
export interface EnrichProgress {
  done: number;
  total: number;
  applied: number;
  failed: number;
}
export interface EnrichResult extends EnrichProgress {
  needsPick: NeedsPick[];
}

/** Items "Enrich all" will walk: no external key or no cover, on a medium with a provider. */
export function enrichable(items: Work[], settings: Partial<LookupSettings>): Work[] {
  return items.filter((m) => (!m.externalKey || !m.coverUrl) && lookupFor(m.type, settings) !== null);
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      resolve();
    });
  });

/**
 * Walk the enrichable items sequentially (300 ms apart, 1100 ms for
 * MusicBrainz): auto-apply the single confident title(+year) match, collect
 * the rest for a manual pick. Stops early when `signal` aborts.
 */
export async function enrichAll(items: Work[], settings: Partial<LookupSettings>, onProgress?: (p: EnrichProgress) => void, signal?: AbortSignal): Promise<EnrichResult> {
  const todo = enrichable(items, settings);
  const res: EnrichResult = { done: 0, total: todo.length, applied: 0, failed: 0, needsPick: [] };
  for (const item of todo) {
    if (signal?.aborted) break;
    try {
      const hits = await findCandidates(item, settings, signal);
      const sure = confidentMatch(item.title, item.year, hits);
      if (sure) {
        await applyPick(item, sure);
        res.applied++;
      } else if (hits.length) {
        res.needsPick.push({ item, hits });
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") break;
      res.failed++;
    }
    res.done++;
    onProgress?.({ ...res });
    if (res.done < res.total) await sleep(lookupGapMs(item.type), signal);
  }
  return res;
}
