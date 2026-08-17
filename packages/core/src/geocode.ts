/**
 * Address → coordinates through OSM's Nominatim (ADR 0011). One client for
 * every App: identifies itself as their usage policy requires, never fires
 * more than one request per second, and remembers answers for the session.
 * Always called from an explicit user action, never on render or on save.
 */

export interface GeocodeHit {
  lat: number;
  lon: number;
  /** Nominatim's display name. */
  label: string;
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

// ---- typeahead: Photon (komoot's open geocoder over OSM data; free, no key, fair use) ----
// Nominatim's policy rules out autocomplete-style querying, so suggestions go
// through Photon; the explicit "Locate" action stays on Nominatim.

const PHOTON = "https://photon.komoot.io/api/";
const suggestCache = new Map<string, GeocodeHit[]>();
let suggestAbort: AbortController | null = null;

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: { name?: string; housenumber?: string; street?: string; postcode?: string; city?: string; state?: string; country?: string; osm_value?: string };
}

function photonLabel(p: PhotonFeature["properties"]): string {
  const line1 = [p.housenumber, p.street ?? (p.name && p.name !== p.city ? p.name : undefined)].filter(Boolean).join(" ");
  const line2 = [p.postcode, p.city].filter(Boolean).join(" ");
  const parts = [line1 || p.name, line2, p.state && p.state !== p.city ? p.state : undefined, p.country].filter(Boolean);
  return Array.from(new Set(parts)).join(", ");
}

/**
 * Address suggestions while typing (debounce on the caller's side, ≥3 chars
 * recommended). Cancels the previous in-flight request; cached per query.
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
    .map((f) => ({ lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], label: photonLabel(f.properties) }))
    .filter((h) => Number.isFinite(h.lat) && Number.isFinite(h.lon) && h.label);
  suggestCache.set(key, out);
  return out;
}
