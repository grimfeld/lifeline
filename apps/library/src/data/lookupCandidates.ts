import { fetchExternal } from "@lifeline/core";
import type { Work } from "../domain/types";
import type { WorkTypeId } from "../domain/workTypes";
import { shelfLabel } from "../domain/cardQueries";
import { lookupFor, providerOf, type LookupKeys } from "./lookup";
import { searchOpenLibrary, type LookupQuery, type WorkHit } from "./openlibrary";
import { mapGbVolume, type GbVolume } from "./providers/googlebooks";
import { mapCvVolume, type CvVolume } from "./providers/comicvine";
import { findTwin } from "./repo";

/** Candidates a lookup hands back at most: the chain's first page is plenty to choose from. */
export const MAX_CANDIDATES = 10;

/** A lookup hit as the outside sees it: plain data, with the shelf's Work when it is already there. */
export interface Candidate {
  externalKey: string;
  title: string;
  authors: string[];
  year: number;
  size: number;
  coverUrl: string;
  synopsis?: string;
  series?: string;
  seriesNumber?: number;
  originalTitle?: string;
  originalLanguage?: string;
  /** The Work already on the shelf that this candidate is (same outside identity, else same title in the medium). */
  onShelf?: { id: string; shelf: string };
}

/** The Work on the shelf a hit would twin — what `library.add` refuses on, and what a lookup marks. */
export function shelfTwinOf(works: Work[], medium: WorkTypeId, hit: Pick<WorkHit, "externalKey" | "title">): Work | undefined {
  return findTwin(works, { medium, title: hit.title, externalKey: hit.externalKey });
}

/** A hit as a candidate, marked with the Work (id and Shelf) it already is. */
export function candidateOf(hit: WorkHit, works: Work[], medium: WorkTypeId): Candidate {
  const twin = shelfTwinOf(works, medium, hit);
  const { externalKey, title, authors, year, size, coverUrl, synopsis, series, seriesNumber, originalTitle, originalLanguage } = hit;
  const optional = { synopsis, series, seriesNumber, originalTitle, originalLanguage };
  return {
    externalKey,
    title,
    authors: authors.map((a) => a.name),
    year,
    size,
    coverUrl,
    ...Object.fromEntries(Object.entries(optional).filter(([, v]) => v !== undefined && v !== "" && v !== 0)),
    ...(twin ? { onShelf: { id: twin.id, shelf: shelfLabel(twin.engagement, twin.type as WorkTypeId) } } : {}),
  };
}

/** The medium's lookup chain, run for a query; at most `MAX_CANDIDATES` hits. Throws when every provider fails. */
export async function lookupHits(medium: WorkTypeId, q: LookupQuery, keys: LookupKeys = {}, signal?: AbortSignal): Promise<WorkHit[]> {
  const search = lookupFor(medium, keys);
  if (!search) return [];
  return (await search(q, signal)).slice(0, MAX_CANDIDATES);
}

/**
 * The hit a provider holds under an external key ("openlibrary:/works/OL1W",
 * "googlebooks:<id>", "comicvine:volume/<id>") — what a lookup returned earlier,
 * fetched again by that key alone. Undefined when the provider no longer has it,
 * the key names no provider of ours, or ComicVine has no key set.
 */
export async function fetchHitByKey(externalKey: string, keys: LookupKeys = {}, signal?: AbortSignal): Promise<WorkHit | undefined> {
  const rest = externalKey.slice(externalKey.indexOf(":") + 1);
  switch (providerOf({ externalKey })) {
    case "openlibrary":
      return (await searchOpenLibrary({ text: `key:${rest}` }, signal)).find((h) => h.externalKey === externalKey);
    case "googlebooks": {
      const url = new URL(`https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(rest)}`);
      if (keys.googleBooksKey) url.searchParams.set("key", keys.googleBooksKey);
      const res = await fetch(url, { signal });
      if (res.status === 404) return undefined;
      if (!res.ok) throw new Error(`Google Books ${res.status}`);
      const hit = mapGbVolume((await res.json()) as GbVolume);
      return hit.title ? hit : undefined;
    }
    case "comicvine": {
      if (!keys.comicvineKey) return undefined;
      const url = new URL(`https://comicvine.gamespot.com/api/volume/4050-${encodeURIComponent(rest.replace(/^volume\//, ""))}/`);
      url.searchParams.set("api_key", keys.comicvineKey);
      url.searchParams.set("format", "json");
      const res = await fetchExternal(url.toString());
      if (!res.ok) throw new Error(`ComicVine ${res.status}`);
      const volume = (JSON.parse(res.body) as { results?: CvVolume }).results;
      return volume?.name ? mapCvVolume(volume) : undefined;
    }
    default:
      return undefined;
  }
}
