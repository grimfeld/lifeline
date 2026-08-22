import { fetchExternal } from "@lifeline/core";
import type { WorkHit } from "../openlibrary";

/**
 * ComicVine volumes — comics, when a key is set (comicvine.gamespot.com/api).
 * The API refuses browser calls (no CORS), so it goes through Core's
 * `fetchExternal` (Tauri natively, else the PocketBase proxy).
 */
export interface CvVolume {
  id: number;
  name: string;
  start_year?: string | null;
  count_of_issues?: number | null;
  publisher?: { name?: string } | null;
  image?: { medium_url?: string } | null;
}

export function mapCvVolume(v: CvVolume): WorkHit {
  return {
    externalKey: `comicvine:volume/${v.id}`,
    title: v.name,
    creator: v.publisher?.name ?? "",
    year: Number(v.start_year) || 0,
    size: v.count_of_issues ?? 0,
    coverUrl: v.image?.medium_url ?? "",
  };
}

export function comicVineSearch(key: string) {
  return async (q: string, _signal?: AbortSignal): Promise<WorkHit[]> => {
    const url = new URL("https://comicvine.gamespot.com/api/search/");
    url.searchParams.set("api_key", key);
    url.searchParams.set("format", "json");
    url.searchParams.set("resources", "volume");
    url.searchParams.set("limit", "8");
    url.searchParams.set("query", q);
    const res = await fetchExternal(url.toString());
    if (!res.ok) throw new Error(`ComicVine ${res.status}`);
    const data = JSON.parse(res.body) as { results?: CvVolume[] };
    return (data.results ?? []).map(mapCvVolume);
  };
}
