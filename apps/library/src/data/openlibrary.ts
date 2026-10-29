import type { AuthorHit, BibliographyRow } from "../domain/authors";

/** One author on a lookup hit: a name, and Open Library's key when the provider knows it. */
export interface AuthorRef {
  name: string;
  /** "openlibrary:/authors/OL…A", or undefined when the provider only has a name (Google Books). */
  externalKey?: string;
}

/** A lookup hit: one work from a provider, as much as the Add step needs. */
export interface WorkHit {
  externalKey: string;
  title: string;
  authors: AuthorRef[];
  year: number;
  size: number;
  coverUrl: string;
  /**
   * Lazy "on pick" enrichment for providers whose search results lack a field
   * (TMDB director/runtime, RAWG developers): one more request, merged into
   * the hit before it is applied. Never called while listing candidates.
   */
  resolve?: (signal?: AbortSignal) => Promise<Partial<WorkHit>>;
}

/** The byline of a hit: its authors' names, joined. */
export const hitByline = (h: Pick<WorkHit, "authors">) => h.authors.map((a) => a.name).join(", ");

/**
 * What a lookup is asked (ADR 0052): free text, or a Title and an Author
 * apart — either alone searches. `authorKey` (an Open Library author key)
 * is exact where the provider understands it; `author` is the name for the
 * ones that don't. `page` is 1-based; `provider` pins the chain to the one
 * that answered page 1.
 */
export interface LookupQuery {
  text?: string;
  title?: string;
  author?: string;
  authorKey?: string;
  /** A validated ISBN (see `isbnOf`): finds the work its edition belongs to. Never stored. */
  isbn?: string;
  page?: number;
  provider?: string;
}

export const PAGE_SIZE = 20;

export const isEmptyQuery = (q: LookupQuery) => !(q.isbn || q.text?.trim() || q.title?.trim() || q.author?.trim() || q.authorKey);

interface OLDoc {
  key: string;
  title: string;
  author_name?: string[];
  author_key?: string[];
  first_publish_year?: number;
  number_of_pages_median?: number;
  cover_i?: number;
}

export const OL_AUTHOR_PREFIX = "openlibrary:/authors/";
/** "OL23919A" → "openlibrary:/authors/OL23919A"; already-prefixed keys pass through. */
export const olAuthorKey = (olid: string) => (olid.startsWith(OL_AUTHOR_PREFIX) ? olid : `${OL_AUTHOR_PREFIX}${olid.replace(/^\/authors\//, "")}`);
/** The bare OLID of an Open Library author key, or "" for another provider's. */
export const olAuthorId = (externalKey: string) => (externalKey.startsWith(OL_AUTHOR_PREFIX) ? externalKey.slice(OL_AUTHOR_PREFIX.length) : "");

export function mapOlDoc(d: OLDoc): WorkHit {
  const names = d.author_name ?? [];
  const keys = d.author_key ?? [];
  return {
    externalKey: `openlibrary:${d.key}`,
    title: d.title,
    authors: names.map((name, i) => ({ name, ...(keys[i] ? { externalKey: olAuthorKey(keys[i]) } : {}) })),
    year: d.first_publish_year ?? 0,
    size: d.number_of_pages_median ?? 0,
    coverUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : "",
  };
}

/** The search URL for a query: `q` for free text, `title`/`author` apart otherwise; an author key beats a name. */
export function openLibrarySearchUrl(q: LookupQuery): URL {
  const url = new URL("https://openlibrary.org/search.json");
  if (q.text?.trim()) url.searchParams.set("q", q.text.trim());
  if (q.title?.trim()) url.searchParams.set("title", q.title.trim());
  const olid = q.authorKey ? olAuthorId(q.authorKey) : "";
  if (olid) url.searchParams.set("author", olid);
  else if (q.author?.trim()) url.searchParams.set("author", q.author.trim());
  url.searchParams.set("limit", String(PAGE_SIZE));
  url.searchParams.set("page", String(q.page ?? 1));
  url.searchParams.set("fields", "key,title,author_name,author_key,first_publish_year,number_of_pages_median,cover_i");
  return url;
}

/** The edition record for an ISBN. */
export const olIsbnUrl = (isbn: string) => new URL(`https://openlibrary.org/isbn/${isbn}.json`);

/** The work an edition record belongs to ("/works/OL…W"), or "". */
export const olIsbnWorkKey = (edition: { works?: { key: string }[] }) => edition.works?.[0]?.key ?? "";

/** Search narrowed to one work, so it maps exactly like any other work hit. */
export function openLibraryWorkUrl(workKey: string): URL {
  const url = openLibrarySearchUrl({ text: `key:${workKey}` });
  url.searchParams.set("limit", "1");
  return url;
}

/** Open Library ISBN lookup: edition → its work. Empty when Open Library does not know the ISBN. */
async function searchOpenLibraryIsbn(isbn: string, signal?: AbortSignal): Promise<WorkHit[]> {
  const res = await fetch(olIsbnUrl(isbn), { signal });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Open Library ${res.status}`);
  const workKey = olIsbnWorkKey((await res.json()) as { works?: { key: string }[] });
  if (!workKey) return [];
  const wres = await fetch(openLibraryWorkUrl(workKey), { signal });
  if (!wres.ok) throw new Error(`Open Library ${wres.status}`);
  return ((await wres.json()) as { docs: OLDoc[] }).docs.map(mapOlDoc);
}

/** Open Library work search — the first lookup source for books and comics. */
export async function searchOpenLibrary(q: LookupQuery, signal?: AbortSignal): Promise<WorkHit[]> {
  if (isEmptyQuery(q)) return [];
  if (q.isbn) return (q.page ?? 1) > 1 ? [] : searchOpenLibraryIsbn(q.isbn, signal);
  const res = await fetch(openLibrarySearchUrl(q), { signal });
  if (!res.ok) throw new Error(`Open Library ${res.status}`);
  const data = (await res.json()) as { docs: OLDoc[] };
  return data.docs.map(mapOlDoc);
}

// --- authors (ADR 0052) -----------------------------------------------------

interface OLAuthorDoc {
  key: string;
  name: string;
  alternate_names?: string[];
  birth_date?: string;
  death_date?: string;
  top_work?: string;
  work_count?: number;
}

export function mapOlAuthorDoc(d: OLAuthorDoc): AuthorHit {
  return {
    externalKey: olAuthorKey(d.key),
    name: d.name,
    alternateNames: d.alternate_names ?? [],
    born: d.birth_date ?? "",
    died: d.death_date ?? "",
    topWork: d.top_work ?? "",
    workCount: d.work_count ?? 0,
  };
}

/** Open Library author search: name, alternate names, years, top work and work count — what a picker needs to tell two John Williamses apart. */
export async function searchOpenLibraryAuthors(name: string, signal?: AbortSignal): Promise<AuthorHit[]> {
  const q = name.trim();
  if (!q) return [];
  const url = new URL("https://openlibrary.org/search/authors.json");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "10");
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Open Library ${res.status}`);
  const data = (await res.json()) as { docs: OLAuthorDoc[] };
  return data.docs.map(mapOlAuthorDoc);
}

export interface AuthorDetails {
  externalKey: string;
  name: string;
  alternateNames: string[];
  born: string;
  died: string;
  photoUrl: string;
}

interface OLAuthor {
  key: string;
  name: string;
  alternate_names?: string[];
  birth_date?: string;
  death_date?: string;
  photos?: number[];
}

export function mapOlAuthor(a: OLAuthor): AuthorDetails {
  const photo = (a.photos ?? []).find((p) => p > 0);
  return {
    externalKey: olAuthorKey(a.key),
    name: a.name,
    alternateNames: a.alternate_names ?? [],
    born: a.birth_date ?? "",
    died: a.death_date ?? "",
    photoUrl: photo ? `https://covers.openlibrary.org/a/id/${photo}-M.jpg` : "",
  };
}

/** One Open Library author record: the photo and years a search hit lacks. */
export async function fetchOpenLibraryAuthor(externalKey: string, signal?: AbortSignal): Promise<AuthorDetails> {
  const olid = olAuthorId(externalKey);
  if (!olid) throw new Error("Not an Open Library author");
  const res = await fetch(`https://openlibrary.org/authors/${olid}.json`, { signal });
  if (!res.ok) throw new Error(`Open Library ${res.status}`);
  return mapOlAuthor((await res.json()) as OLAuthor);
}

interface OLWorkEntry {
  key: string;
  title: string;
  covers?: number[];
  first_publish_date?: string;
}

export function mapOlWorkEntry(e: OLWorkEntry): BibliographyRow {
  const cover = (e.covers ?? []).find((c) => c > 0);
  const year = /\b(1[0-9]{3}|20[0-9]{2})\b/.exec(e.first_publish_date ?? "");
  return {
    externalKey: `openlibrary:${e.key}`,
    title: e.title ?? "",
    year: year ? Number(year[1]) : 0,
    coverUrl: cover ? `https://covers.openlibrary.org/b/id/${cover}-M.jpg` : "",
  };
}

const WORKS_PAGE = 100;
const WORKS_CAP = 1000;

/** Everything Open Library lists under an author (the Bibliography, CONTEXT.md) — paged until the end or the cap, never stored. */
export async function fetchOpenLibraryAuthorWorks(externalKey: string, signal?: AbortSignal): Promise<BibliographyRow[]> {
  const olid = olAuthorId(externalKey);
  if (!olid) return [];
  const out: BibliographyRow[] = [];
  for (let offset = 0; offset < WORKS_CAP; offset += WORKS_PAGE) {
    const res = await fetch(`https://openlibrary.org/authors/${olid}/works.json?limit=${WORKS_PAGE}&offset=${offset}`, { signal });
    if (!res.ok) throw new Error(`Open Library ${res.status}`);
    const data = (await res.json()) as { entries?: OLWorkEntry[] };
    const rows = (data.entries ?? []).map(mapOlWorkEntry).filter((r) => r.title);
    out.push(...rows);
    if ((data.entries ?? []).length < WORKS_PAGE) break;
  }
  return out;
}
