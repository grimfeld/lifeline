import type { WorkHit } from "../openlibrary";

/**
 * Google Books volumes — the fallback when Open Library returns nothing for
 * a book or comic. Keyless works; a key (optional) lifts the quota.
 */
export interface GbVolume {
  id: string;
  volumeInfo?: {
    title?: string;
    authors?: string[];
    publishedDate?: string;
    pageCount?: number;
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
  };
}

export function mapGbVolume(v: GbVolume): WorkHit {
  const info = v.volumeInfo ?? {};
  const thumb = info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail ?? "";
  return {
    externalKey: `googlebooks:${v.id}`,
    title: info.title ?? "",
    creator: info.authors?.[0] ?? "",
    year: Number((info.publishedDate ?? "").slice(0, 4)) || 0,
    size: info.pageCount ?? 0,
    coverUrl: thumb.replace(/^http:\/\//, "https://"),
  };
}

export function googleBooksSearch(key?: string) {
  return async (q: string, signal?: AbortSignal): Promise<WorkHit[]> => {
    const url = new URL("https://www.googleapis.com/books/v1/volumes");
    url.searchParams.set("q", q);
    url.searchParams.set("maxResults", "8");
    if (key) url.searchParams.set("key", key);
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`Google Books ${res.status}`);
    const data = (await res.json()) as { items?: GbVolume[] };
    return (data.items ?? []).map(mapGbVolume).filter((h) => h.title);
  };
}
