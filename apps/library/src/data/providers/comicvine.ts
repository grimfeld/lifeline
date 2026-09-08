import { fetchExternal } from "@lifeline/core";
import { PAGE_SIZE, type LookupQuery, type WorkHit } from "../openlibrary";

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
    authors: [],
    year: Number(v.start_year) || 0,
    size: v.count_of_issues ?? 0,
    coverUrl: v.image?.medium_url ?? "",
  };
}

export function comicVineSearch(key: string) {
  return async (q: LookupQuery, _signal?: AbortSignal): Promise<WorkHit[]> => {
    // Volumes are searched by name only; an author narrows nothing here.
    const query = [q.text, q.title, q.author].map((s) => s?.trim() ?? "").filter(Boolean).join(" ");
    if (!query) return [];
    const url = new URL("https://comicvine.gamespot.com/api/search/");
    url.searchParams.set("api_key", key);
    url.searchParams.set("format", "json");
    url.searchParams.set("resources", "volume");
    url.searchParams.set("limit", String(PAGE_SIZE));
    url.searchParams.set("offset", String(((q.page ?? 1) - 1) * PAGE_SIZE));
    url.searchParams.set("query", query);
    const res = await fetchExternal(url.toString());
    if (!res.ok) throw new Error(`ComicVine ${res.status}`);
    const data = JSON.parse(res.body) as { results?: CvVolume[] };
    return (data.results ?? []).map(mapCvVolume);
  };
}
