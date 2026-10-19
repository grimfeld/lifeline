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
 * TMDB — movies and series. Needs a personal API key (themoviedb.org/settings/api);
 * browser-callable. Search gives title/year/poster; director, runtime and
 * episode count take a second request, done lazily on pick via `resolve`.
 */
const API = "https://api.themoviedb.org/3";
export const TMDB_IMG = "https://image.tmdb.org/t/p/w342";

export interface TmdbMovie {
  id: number;
  title: string;
  release_date?: string;
  poster_path?: string | null;
}
export interface TmdbTv {
  id: number;
  name: string;
  first_air_date?: string;
  poster_path?: string | null;
}
export interface TmdbMovieDetail {
  runtime?: number | null;
}
export interface TmdbTvDetail {
  number_of_episodes?: number | null;
}
export interface TmdbCredits {
  crew?: { job?: string; name?: string }[];
}

const year = (d?: string) => Number((d ?? "").slice(0, 4)) || 0;
const poster = (p?: string | null) => (p ? `${TMDB_IMG}${p}` : "");

export function mapTmdbMovie(m: TmdbMovie): WorkHit {
  return { externalKey: `tmdb:movie/${m.id}`, title: m.title, creator: "", year: year(m.release_date), size: 0, coverUrl: poster(m.poster_path) };
}

export function mapTmdbTv(t: TmdbTv): WorkHit {
  return { externalKey: `tmdb:tv/${t.id}`, title: t.name, creator: "", year: year(t.first_air_date), size: 0, coverUrl: poster(t.poster_path) };
}

/** Director (first crew member with job "Director") and runtime, from the detail + credits payloads. */
export function mapTmdbMovieDetail(detail: TmdbMovieDetail, credits: TmdbCredits): Partial<WorkHit> {
  const director = (credits.crew ?? []).find((c) => c.job === "Director")?.name ?? "";
  return { creator: director, size: detail.runtime ?? 0 };
}

export function mapTmdbTvDetail(detail: TmdbTvDetail): Partial<WorkHit> {
  return { size: detail.number_of_episodes ?? 0 };
}

async function getJson<T>(path: string, key: string, params: Record<string, string>, signal?: AbortSignal): Promise<T> {
  const url = new URL(`${API}/${path}`);
  url.searchParams.set("api_key", key);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return (await res.json()) as T;
}

export function tmdbSearch(kind: "movie" | "tv", key: string) {
  return async (q: string, signal?: AbortSignal): Promise<WorkHit[]> => {
    const data = await getJson<{ results: (TmdbMovie & TmdbTv)[] }>(`search/${kind}`, key, { query: q, include_adult: "false" }, signal);
    return (data.results ?? []).slice(0, 8).map((r) => {
      const hit = kind === "movie" ? mapTmdbMovie(r) : mapTmdbTv(r);
      hit.resolve =
        kind === "movie"
          ? async (signal) => {
              const [detail, credits] = await Promise.all([getJson<TmdbMovieDetail>(`movie/${r.id}`, key, {}, signal), getJson<TmdbCredits>(`movie/${r.id}/credits`, key, {}, signal)]);
              return mapTmdbMovieDetail(detail, credits);
            }
          : async (signal) => mapTmdbTvDetail(await getJson<TmdbTvDetail>(`tv/${r.id}`, key, {}, signal));
      return hit;
    });
  };
}
