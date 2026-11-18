/**
 * Address → coordinates through OSM's Nominatim (ADR 0011). One client for
 * every App: identifies itself as their usage policy requires, never fires
 * more than one request per second, and remembers answers for the session.
 * Always called from an explicit user action: a "Locate" click, or saving a
 * Person's Address whose text changed (ADR 0113), which looks it up once.
 * Never on render, in bulk, or from a sync. A failure throws, with the HTTP
 * status: a caller tells it apart from finding nothing.
 */

export interface GeocodeHit {
  lat: number;
  lon: number;
  /** The postal address: Nominatim's display name, or Photon's address line. */
  label: string;
  /**
   * A point of interest's own name ("Chez Janou"), which the address line
   * leaves out; Photon's only, and none for a plain address, street or town.
   */
  name?: string;
}

const ENDPOINT = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "Lifeline personal dashboard (github.com/grimfeld/lifeline)";
const MIN_INTERVAL_MS = 1100;

const cache = new Map<string, GeocodeHit[]>();
let lastCall = 0;
let queue: Promise<unknown> = Promise.resolve();

function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = async () => {
    const wait = lastCall + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    return fn();
  };
  const p = queue.then(run, run);
  queue = p.catch(() => undefined);
  return p;
}

export async function geocode(query: string, limit = 5): Promise<GeocodeHit[]> {
  const q = query.trim();
  if (!q) return [];
  const key = `${q} ${limit}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const url = `${ENDPOINT}?format=jsonv2&limit=${limit}&q=${encodeURIComponent(q)}`;
  const lang = typeof navigator !== "undefined" ? navigator.language : "en";
  const res = await throttled(() =>
    fetch(url, { headers: { Accept: "application/json", "User-Agent": USER_AGENT, "Accept-Language": lang || "en" } }),
  );
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
  const data = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  const out = data
    .map((d) => ({ lat: Number(d.lat), lon: Number(d.lon), label: d.display_name }))
    .filter((h) => Number.isFinite(h.lat) && Number.isFinite(h.lon));
  cache.set(key, out);
  return out;
}

// ---- one lookup on save: Contacts' Addresses and Atlas's Places alike ----

/** A spot on the map, in degrees: what a lookup finds, a Place keeps and a Pin stands at. */
export interface Coords {
  lat: number;
  lon: number;
}

/**
 * What a lookup came to: a place, no place for these words, or no answer at
 * all (offline, or the geocoder refused or failed: `reason` says how). The
 * last two are told apart, so a page never blames the text for an outage.
 */
export type Located = { kind: "found"; at: Coords } | { kind: "none" } | { kind: "failed"; reason: string };

/** How an address is looked up on save: the text to what was found (`locateAddress` by default; a stand-in in tests). */
export type Lookup = (text: string) => Promise<Located>;

/**
 * Look an address up once, as a save does (ADR 0011): the first Nominatim
 * hit's coordinates, none when there is no hit, or failed when the lookup
 * itself fails. A failure is logged with its reason, never the text: an
 * address stays on the device and with the geocoder.
 */
export async function locateAddress(text: string, find: (query: string, limit: number) => Promise<GeocodeHit[]> = geocode): Promise<Located> {
  try {
    const hit = (await find(text, 1))[0];
    return hit ? { kind: "found", at: { lat: hit.lat, lon: hit.lon } } : { kind: "none" };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn("[geocode] address lookup failed", { reason });
    return { kind: "failed", reason };
  }
}

// ---- typeahead: Photon (komoot's open geocoder over OSM data; free, no key, fair use) ----
// Nominatim's policy rules out autocomplete-style querying, so suggestions go
// through Photon; the explicit "Locate" action stays on Nominatim.

const PHOTON = "https://photon.komoot.io/api/";
const suggestCache = new Map<string, GeocodeHit[]>();
let suggestAbort: AbortController | null = null;

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: { osm_key?: string; name?: string; housenumber?: string; street?: string; postcode?: string; city?: string; state?: string; country?: string; osm_value?: string };
}

function photonLabel(p: PhotonFeature["properties"]): string {
  const line1 = [p.housenumber, p.street ?? (p.name && p.name !== p.city ? p.name : undefined)].filter(Boolean).join(" ");
  const line2 = [p.postcode, p.city].filter(Boolean).join(" ");
  const parts = [line1 || p.name, line2, p.state && p.state !== p.city ? p.state : undefined, p.country].filter(Boolean);
  return Array.from(new Set(parts)).join(", ");
}

/** Features whose name is the address itself, not a place's: a street, a town, a border. */
const ADDRESS_KEYS = new Set(["highway", "place", "boundary"]);

/** A point of interest's own name: a named feature that is no street, town or border. */
const poiName = (p: PhotonFeature["properties"]): string | undefined => (p.name?.trim() && p.osm_key && !ADDRESS_KEYS.has(p.osm_key) ? p.name.trim() : undefined);

/**
 * Address suggestions while typing (debounce on the caller's side, ≥3 chars
 * recommended). A point of interest keeps its `name` beside its address, so
 * a pick can fill a Place's name, address and coordinates at once (ADR 0128). Cancels the previous in-flight request; cached per query.
 */
export async function suggestAddresses(query: string, limit = 6): Promise<GeocodeHit[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const lang = (typeof navigator !== "undefined" ? navigator.language : "en").slice(0, 2);
  const key = `${lang}:${q}:${limit}`;
  const cached = suggestCache.get(key);
  if (cached) return cached;
  suggestAbort?.abort();
  suggestAbort = new AbortController();
  const url = `${PHOTON}?q=${encodeURIComponent(q)}&limit=${limit}&lang=${["en", "de", "fr", "it"].includes(lang) ? lang : "en"}`;
  const res = await fetch(url, { signal: suggestAbort.signal, headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Address search failed (${res.status})`);
  const data = (await res.json()) as { features: PhotonFeature[] };
  const out = data.features
    .map((f) => {
      const name = poiName(f.properties);
      return { lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], label: photonLabel(f.properties), ...(name ? { name } : {}) };
    })
    .filter((h) => Number.isFinite(h.lat) && Number.isFinite(h.lon) && h.label);
  suggestCache.set(key, out);
  return out;
}

// ---- Here: the places around a position (Photon's reverse lookup) ----

const PHOTON_REVERSE = "https://photon.komoot.io/reverse";

/**
 * The points of interest around a position, nearest first, for Here on the
 * Place form (ADR 0128). Asked once per tap, never in the background. The
 * position goes to Photon only: it is never cached, stored or logged, and a
 * failure names the status alone. A street, a town or an unnamed feature is
 * left out: "Just here" covers a spot no lookup knows.
 */
export async function placesNearby(at: Coords, limit = 10): Promise<GeocodeHit[]> {
  const lang = (typeof navigator !== "undefined" ? navigator.language : "en").slice(0, 2);
  const params = new URLSearchParams({ lat: String(at.lat), lon: String(at.lon), limit: String(limit), radius: "0.2", lang: ["en", "de", "fr", "it"].includes(lang) ? lang : "en" });
  const res = await fetch(`${PHOTON_REVERSE}?${params}`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Nearby search failed (${res.status})`);
  const data = (await res.json()) as { features: PhotonFeature[] };
  return data.features.flatMap((f) => {
    const name = poiName(f.properties);
    const hit = { lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], label: photonLabel(f.properties) };
    return name && Number.isFinite(hit.lat) && Number.isFinite(hit.lon) ? [{ ...hit, name }] : [];
  });
}
