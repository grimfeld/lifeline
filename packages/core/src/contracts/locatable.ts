import { appById, locatableProviders } from "../registry";

/**
 * The Locatable Contract (ADR 0011): an App exposes entities that sit at a
 * geographic point, so any map Surface can draw them. Pins carry resolved
 * coordinates only — geocoding is the owning App's job at edit time, never
 * the Surface's at render time.
 */
export interface Pin {
  appId: string;
  itemId: string;
  name: string;
  subtitle?: string;
  lat: number;
  lon: number;
  /** Route to open the entity, e.g. "/app/notes/abc". */
  href?: string;
}

export interface LocatableProvider {
  appId: string;
  /** React hook. Every live entity that has coordinates. */
  usePins(): Pin[];
}

export interface SurfacePin extends Pin {
  /** `${appId}/${itemId}` — unique across Apps. */
  key: string;
  color?: string;
}

/** Read side: every provider's pins, coloured per App; optionally only some Apps. */
export function useLocatablePins(apps?: string[]): SurfacePin[] {
  const providers = locatableProviders();
  // Hook order is stable: the provider list is fixed at compile time (ADR 0003).
  const per = providers.map((p) => ({
    provider: p,
    // eslint-disable-next-line react-hooks/rules-of-hooks
    pins: p.usePins(),
  }));
  const out: SurfacePin[] = [];
  for (const { provider, pins } of per) {
    if (apps && apps.length > 0 && !apps.includes(provider.appId)) continue;
    const color = appById(provider.appId)?.color;
    for (const p of pins) out.push({ ...p, key: `${p.appId}/${p.itemId}`, color });
  }
  return out;
}

/** True when the pair is a plausible WGS84 coordinate. */
export function isValidCoord(lat: unknown, lon: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lon === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180
  );
}
