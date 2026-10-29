import { isEmptyQuery, PAGE_SIZE, type LookupQuery, type WorkHit } from "../openlibrary";

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
    authors: (info.authors ?? []).map((name) => ({ name })),
    year: Number((info.publishedDate ?? "").slice(0, 4)) || 0,
    size: info.pageCount ?? 0,
    coverUrl: thumb.replace(/^http:\/\//, "https://"),
  };
}

/** Google's query string: free text, then `intitle:` / `inauthor:` for the split fields (an author key means nothing here — the name is used). */
export function googleBooksQuery(q: LookupQuery): string {
  if (q.isbn) return `isbn:${q.isbn}`;
  const parts: string[] = [];
  if (q.text?.trim()) parts.push(q.text.trim());
  if (q.title?.trim()) parts.push(`intitle:"${q.title.trim().replace(/"/g, "")}"`);
  if (q.author?.trim()) parts.push(`inauthor:"${q.author.trim().replace(/"/g, "")}"`);
  return parts.join(" ");
}

export function googleBooksSearch(key?: string) {
  return async (q: LookupQuery, signal?: AbortSignal): Promise<WorkHit[]> => {
    const query = googleBooksQuery(q);
    if (!query || isEmptyQuery(q)) return [];
    const url = new URL("https://www.googleapis.com/books/v1/volumes");
    url.searchParams.set("q", query);
    url.searchParams.set("maxResults", String(PAGE_SIZE));
    url.searchParams.set("startIndex", String(((q.page ?? 1) - 1) * PAGE_SIZE));
    if (key) url.searchParams.set("key", key);
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`Google Books ${res.status}`);
    const data = (await res.json()) as { items?: GbVolume[] };
    return (data.items ?? []).map(mapGbVolume).filter((h) => h.title);
  };
}
