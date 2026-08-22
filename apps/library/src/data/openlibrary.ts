/** Open Library work search — the lookup source for books and comics. */
export interface WorkHit {
  externalKey: string;
  title: string;
  creator: string;
  year: number;
  size: number;
  coverUrl: string;
  /**
   * Lazy "on pick" enrichment for providers whose search results lack a field
   * (TMDB director/runtime, RAWG developers): one more request, merged into
   * the hit before it is applied. Never called while listing candidates.
   */
  resolve?: () => Promise<Partial<WorkHit>>;
}

interface OLDoc {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  number_of_pages_median?: number;
  cover_i?: number;
}

export async function searchOpenLibrary(q: string, signal?: AbortSignal): Promise<WorkHit[]> {
  const url = new URL("https://openlibrary.org/search.json");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "8");
  url.searchParams.set("fields", "key,title,author_name,first_publish_year,number_of_pages_median,cover_i");
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Open Library ${res.status}`);
  const data = (await res.json()) as { docs: OLDoc[] };
  return data.docs.map((d) => ({
    externalKey: `openlibrary:${d.key}`,
    title: d.title,
    creator: d.author_name?.[0] ?? "",
    year: d.first_publish_year ?? 0,
    size: d.number_of_pages_median ?? 0,
    coverUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : "",
  }));
}
