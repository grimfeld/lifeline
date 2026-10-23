import { useEffect } from "react";
import { db, fetchExternal, useLiveQuery } from "@lifeline/core";
import { DEFAULT_REFRESH, SOURCE_CACHE, type Source, type SourceCacheEntry } from "../domain/types";

/**
 * Local-only cache of each Source's last fetched body (ADR 0017): rendered
 * instantly and offline; refreshed on the Source's period while something
 * that shows it is mounted. Fetches are de-duplicated per Source.
 */
const inFlight = new Map<string, Promise<void>>();

function table() {
  return db().collection<SourceCacheEntry>(SOURCE_CACHE);
}

export function periodMs(s: Source): number {
  const min = s.refreshMinutes ?? DEFAULT_REFRESH[s.kind] ?? 30;
  return Math.max(1, min) * 60_000;
}

export function isStale(entry: SourceCacheEntry | undefined, s: Source): boolean {
  if (!entry) return true;
  return Date.now() - Date.parse(entry.fetchedAt) > periodMs(s);
}

/** Fetch now (deduped) and store the result — success or failure — in the cache. */
export function refreshSource(s: Source): Promise<void> {
  const running = inFlight.get(s.id);
  if (running) return running;
  const p = (async () => {
    const fetchedAt = new Date().toISOString();
    try {
      const res = await fetchExternal(s.url, { headers: s.headers });
      const prev = await table().get(s.id);
      await table().put({
        id: s.id,
        updatedAt: fetchedAt,
        deleted: 0,
        fetchedAt,
        ok: res.ok,
        status: res.status,
        contentType: res.contentType,
        // Keep the last good body when the fetch fails, so surfaces don't go blank.
        body: res.ok ? res.body : (prev?.body ?? ""),
        error: res.ok ? undefined : `HTTP ${res.status}${res.body ? `: ${res.body.slice(0, 200)}` : ""}`,
      });
    } catch (err) {
      const prev = await table().get(s.id);
      await table().put({
        id: s.id,
        updatedAt: fetchedAt,
        deleted: 0,
        fetchedAt,
        ok: false,
        status: 0,
        contentType: prev?.contentType ?? "",
        body: prev?.body ?? "",
        error: (err as Error).message,
      });
    } finally {
      inFlight.delete(s.id);
    }
  })();
  inFlight.set(s.id, p);
  return p;
}

/**
 * Store a body as if it had just been fetched — what a successful refresh
 * writes. For a Source whose URL this device cannot reach (the Demo has no
 * fetch proxy, ADR 0077): it then shows this body until a fetch succeeds.
 */
export async function primeSourceCache(sourceId: string, res: { contentType: string; body: string }): Promise<void> {
  const fetchedAt = new Date().toISOString();
  await table().put({ id: sourceId, updatedAt: fetchedAt, deleted: 0, fetchedAt, ok: true, status: 200, ...res });
}

/** Live cache entry for a Source; triggers a fetch when missing/stale and re-checks on the period. */
export function useSourceCache(s: Source | undefined): SourceCacheEntry | undefined {
  const entry = useLiveQuery(async () => (s ? await table().get(s.id) : undefined), [s?.id]);
  const stale = s ? isStale(entry, s) : false;
  useEffect(() => {
    if (!s) return;
    if (stale) void refreshSource(s);
    const t = setInterval(() => void refreshSource(s), periodMs(s));
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-arm when the source's url/headers/period change or it becomes stale
  }, [s?.id, s?.url, s?.refreshMinutes, JSON.stringify(s?.headers ?? null), stale]);
  return entry;
}

/** The cached entries of many Sources, read once (no fetch): what Push reads (ADR 0054). */
export async function cachedEntries(ids: string[]): Promise<Map<string, SourceCacheEntry>> {
  const entries = ids.length ? await table().where("id").anyOf(ids).toArray() : [];
  return new Map(entries.map((e) => [e.id, e]));
}

/** Same for many Sources at once (the Timed provider): one entry per source id. */
export function useSourceCaches(sources: Source[]): Map<string, SourceCacheEntry> {
  const ids = sources.map((s) => s.id);
  const key = ids.join(",");
  const entries = useLiveQuery(
    async () => (ids.length ? await table().where("id").anyOf(ids).toArray() : []),
    [key],
    [] as SourceCacheEntry[],
  );
  const map = new Map(entries.map((e) => [e.id, e]));
  const staleKey = sources.filter((s) => isStale(map.get(s.id), s)).map((s) => s.id).join(",");
  useEffect(() => {
    for (const s of sources) if (isStale(map.get(s.id), s)) void refreshSource(s);
    const timers = sources.map((s) => setInterval(() => void refreshSource(s), periodMs(s)));
    return () => timers.forEach(clearInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the ids and the stale ones: `sources` and `map` are new on every render
  }, [key, staleKey]);
  return map;
}

/** Drop a source's cached body (after edit) so the next read refetches. */
export async function invalidateSource(id: string): Promise<void> {
  await table().delete(id);
}

export function ago(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}
