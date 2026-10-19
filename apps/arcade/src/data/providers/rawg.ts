/** A lookup candidate (the shape the old Open Library module defined). */
export interface WorkHit {
  externalKey: string;
  title: string;
  creator: string;
  year: number;
  size: number;
  coverUrl: string;
  /** Lazy "on pick" enrichment: one more request, merged into the hit before it is applied. */
  resolve?: (signal?: AbortSignal) => Promise<Partial<WorkHit>>;
}

/**
 * RAWG — games. Needs a personal key (rawg.io/apidocs); browser-callable.
 * Search gives name/year/cover/playtime; developers take `games/{id}`,
 * done lazily on pick via `resolve`.
 */
const API = "https://api.rawg.io/api";

export interface RawgGame {
  id: number;
  name: string;
  released?: string | null;
  background_image?: string | null;
  playtime?: number | null;
}
export interface RawgGameDetail {
  developers?: { name: string }[];
}

export function mapRawgGame(g: RawgGame): WorkHit {
  return {
    externalKey: `rawg:${g.id}`,
    title: g.name,
    creator: "",
    year: Number((g.released ?? "").slice(0, 4)) || 0,
    size: g.playtime ?? 0,
    coverUrl: g.background_image ?? "",
  };
}

export function mapRawgGameDetail(d: RawgGameDetail): Partial<WorkHit> {
  return { creator: (d.developers ?? []).map((x) => x.name).join(", ") };
}

async function getJson<T>(path: string, key: string, params: Record<string, string>, signal?: AbortSignal): Promise<T> {
  const url = new URL(`${API}/${path}`);
  url.searchParams.set("key", key);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`RAWG ${res.status}`);
  return (await res.json()) as T;
}

export function rawgSearch(key: string) {
  return async (q: string, signal?: AbortSignal): Promise<WorkHit[]> => {
    const data = await getJson<{ results: RawgGame[] }>("games", key, { search: q, page_size: "8" }, signal);
    return (data.results ?? []).map((g) => {
      const hit = mapRawgGame(g);
      hit.resolve = async (signal) => mapRawgGameDetail(await getJson<RawgGameDetail>(`games/${g.id}`, key, {}, signal));
      return hit;
    });
  };
}
