/** What a media App's lookup (TMDB, MusicBrainz, RAWG, Open Library…) hands back, as the QuickAdd lists it. */
export interface LookupHit {
  externalKey: string;
  title: string;
  year?: number;
  coverUrl?: string;
}

/** A hit as a Combobox row: its title, with the byline and year under it. */
export interface LookupRow<H extends LookupHit> {
  value: string;
  label: string;
  description: string;
  hit: H;
}

/** At most this many hits are listed under the QuickAdd. */
export const LOOKUP_ROWS = 5;

export function lookupRows<H extends LookupHit>(hits: readonly H[], byline: (hit: H) => string | undefined): LookupRow<H>[] {
  return hits.slice(0, LOOKUP_ROWS).map((hit) => ({
    value: hit.externalKey,
    label: hit.title,
    description: [byline(hit), hit.year || ""].filter(Boolean).join(" · "),
    hit,
  }));
}
