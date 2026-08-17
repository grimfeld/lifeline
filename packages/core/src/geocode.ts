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
