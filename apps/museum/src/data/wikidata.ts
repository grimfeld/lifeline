import type { ArtFormId } from "../domain/artForms";
import { artForm } from "../domain/artForms";

/**
 * Wikidata — the Museum's one lookup source (ADR 0022): keyless, CORS-open
 * (`origin=*`), covers every art form, and its P18 image is a Wikimedia
 * Commons URL — exactly the rot-resistant kind the URL-only image decision
 * counts on. Search lists label + description; the claims (artist, year,
 * image, materials, dimensions, location, coordinates) are pulled lazily on
 * pick, Media's `resolve` pattern.
 */
export interface ArtworkHit {
  /** "wikidata:Q12418". */
  externalKey: string;
  title: string;
  /** Search-result description ("painting by Leonardo da Vinci"). */
  description: string;
  artistName: string;
  /** "wikidata:Q762" — identity for auto-creating the artist. */
  artistKey: string;
  /** Free text, matching the Artwork field ("1503", "16th century"). */
  year: string;
  imageUrl: string;
  materials: string;
  dimensions: string;
  location: string;
  lat?: number;
  lon?: number;
  /** Lazy claim fetch, merged into the hit on pick — never while listing. */
  resolve?: () => Promise<Partial<ArtworkHit>>;
}

export type SearchFn = (q: string, signal?: AbortSignal) => Promise<ArtworkHit[]>;

const API = "https://www.wikidata.org/w/api.php";

async function wd(params: Record<string, string>, signal?: AbortSignal): Promise<Record<string, unknown>> {
  const url = new URL(API);
  for (const [k, v] of Object.entries({ ...params, format: "json", origin: "*" })) url.searchParams.set(k, v);
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Wikidata ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

/** Commons image URL for a P18 filename, sized for a wall. */
export function commonsUrl(filename: string, width = 1200): string {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename.replace(/ /g, "_"))}?width=${width}`;
}

// --- claim plumbing (exported for tests) -----------------------------------

type Claims = Record<string, unknown[]>;

function snakValue(claim: unknown): unknown {
  return (claim as { mainsnak?: { datavalue?: { value?: unknown } } })?.mainsnak?.datavalue?.value;
}

export function itemIds(claims: Claims, pid: string, max = 3): string[] {
  return (claims[pid] ?? [])
    .map((c) => (snakValue(c) as { id?: string })?.id)
    .filter((id): id is string => !!id)
    .slice(0, max);
}

export function stringValue(claims: Claims, pid: string): string {
  const v = snakValue((claims[pid] ?? [])[0]);
  return typeof v === "string" ? v : "";
}

/** "+1503-00-00T…" at Wikidata precision → art history's words. */
export function formatYear(time: string | undefined, precision: number | undefined): string {
  const m = /^([+-])(\d{1,6})/.exec(time ?? "");
  if (!m) return "";
  const year = Number(m[2]);
  const bc = m[1] === "-";
  if (bc) return `${year} BC`;
  if (precision === undefined || precision >= 9) return String(year);
  if (precision === 8) return `${Math.floor(year / 10) * 10}s`;
  if (precision === 7) {
    const c = Math.ceil(year / 100);
    const suffix = c % 10 === 1 && c % 100 !== 11 ? "st" : c % 10 === 2 && c % 100 !== 12 ? "nd" : c % 10 === 3 && c % 100 !== 13 ? "rd" : "th";
    return `${c}${suffix} century`;
  }
  return String(year);
}

export function yearOf(claims: Claims): string {
  const v = snakValue((claims["P571"] ?? [])[0]) as { time?: string; precision?: number } | undefined;
  return formatYear(v?.time, v?.precision);
}

const UNIT_LABELS: Record<string, string> = { Q174728: "cm", Q11573: "m", Q174789: "mm", Q218593: "in" };

function quantity(claims: Claims, pid: string): { amount: number; unit: string } | null {
  const v = snakValue((claims[pid] ?? [])[0]) as { amount?: string; unit?: string } | undefined;
  if (!v?.amount) return null;
  const amount = Number(v.amount);
  if (!Number.isFinite(amount)) return null;
  const qid = (v.unit ?? "").split("/").pop() ?? "";
  return { amount, unit: UNIT_LABELS[qid] ?? "" };
}

/** "77 × 53 cm" from height (P2048) and width (P2049); height alone when width is missing. */
export function dimensionsOf(claims: Claims): string {
  const h = quantity(claims, "P2048");
  const w = quantity(claims, "P2049");
  const fmt = (n: number) => String(Math.round(n * 10) / 10);
  if (h && w && h.unit === w.unit) return `${fmt(h.amount)} × ${fmt(w.amount)}${h.unit ? " " + h.unit : ""}`;
  if (h) return `${fmt(h.amount)}${h.unit ? " " + h.unit : ""}`;
  if (w) return `${fmt(w.amount)}${w.unit ? " " + w.unit : ""}`;
  return "";
}

export function coordsOf(claims: Claims): { lat: number; lon: number } | null {
  const v = snakValue((claims["P625"] ?? [])[0]) as { latitude?: number; longitude?: number } | undefined;
  if (typeof v?.latitude !== "number" || typeof v?.longitude !== "number") return null;
  return { lat: v.latitude, lon: v.longitude };
}

/**
 * Map an entity's claims (+ a qid → English label map) to hit fields.
 * Architecture credits the architect (P84); everything else the creator
 * (P170). Location prefers "located in" (P276) over the owning collection
 * (P195).
 */
export function parseClaims(claims: Claims, labels: Record<string, string>, form: ArtFormId): Partial<ArtworkHit> {
  const creatorId = itemIds(claims, form === "architecture" ? "P84" : "P170", 1)[0] ?? "";
  const locationId = itemIds(claims, "P276", 1)[0] ?? itemIds(claims, "P195", 1)[0] ?? "";
  const materials = itemIds(claims, "P186", 2)
    .map((id) => labels[id])
    .filter(Boolean)
    .join(", ");
  const image = stringValue(claims, "P18");
  const coords = form === "architecture" ? coordsOf(claims) : null;
  return {
    artistName: labels[creatorId] ?? "",
    artistKey: creatorId ? `wikidata:${creatorId}` : "",
    year: yearOf(claims),
    imageUrl: image ? commonsUrl(image) : "",
    materials: artForm(form).hasMaterials ? materials : "",
    dimensions: artForm(form).hasMaterials ? dimensionsOf(claims) : "",
    location: labels[locationId] ?? "",
    ...(coords ?? {}),
  };
}

/** Ids parseClaims will want labels for. */
export function referencedIds(claims: Claims, form: ArtFormId): string[] {
  return [
    ...itemIds(claims, form === "architecture" ? "P84" : "P170", 1),
    ...itemIds(claims, "P276", 1),
    ...itemIds(claims, "P195", 1),
    ...itemIds(claims, "P186", 2),
  ];
}

// --- the provider -----------------------------------------------------------

async function resolveEntity(qid: string, form: ArtFormId): Promise<Partial<ArtworkHit>> {
  const data = (await wd({ action: "wbgetentities", ids: qid, props: "claims" })) as {
    entities?: Record<string, { claims?: Claims }>;
  };
  const claims = data.entities?.[qid]?.claims ?? {};
  const ids = [...new Set(referencedIds(claims, form))];
  let labels: Record<string, string> = {};
  if (ids.length > 0) {
    const ldata = (await wd({ action: "wbgetentities", ids: ids.join("|"), props: "labels", languages: "en" })) as {
      entities?: Record<string, { labels?: { en?: { value?: string } } }>;
    };
    labels = Object.fromEntries(ids.map((id) => [id, ldata.entities?.[id]?.labels?.en?.value ?? ""]));
  }
  return parseClaims(claims, labels, form);
}

/** Search Wikidata items by name; claims come lazily per pick. */
export function searchWikidata(form: ArtFormId): SearchFn {
  return async (q, signal) => {
    const data = (await wd({ action: "wbsearchentities", search: q, language: "en", uselang: "en", type: "item", limit: "8" }, signal)) as {
      search?: { id: string; label?: string; description?: string }[];
    };
    return (data.search ?? []).map((s) => ({
      externalKey: `wikidata:${s.id}`,
      title: s.label ?? s.id,
      description: s.description ?? "",
      artistName: "",
      artistKey: "",
      year: "",
      imageUrl: "",
      materials: "",
      dimensions: "",
      location: "",
      resolve: () => resolveEntity(s.id, form),
    }));
  };
}

/** Merge a hit's lazy claims in (on pick). Failures keep the plain hit. */
export async function resolveHit(hit: ArtworkHit): Promise<ArtworkHit> {
  if (!hit.resolve) return hit;
  try {
    const extra = await hit.resolve();
    const { resolve: _r, ...plain } = hit;
    return { ...plain, ...Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== undefined && v !== "")) } as ArtworkHit;
  } catch {
    return hit;
  }
}
