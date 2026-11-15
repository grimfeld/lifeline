import { PLACE_TYPE, type Document, type SurfacePin } from "@lifeline/core";

/** The World map's filter: Apps whose Pins are off, one Kind of Place, and To try. */
export interface WorldFilter {
  /** App ids whose Pins are hidden ("contacts", "atlas"). */
  hidden?: readonly string[];
  /** A Place Kind's value: only Places of that Kind; the Addresses stay. "" or absent for every Kind. */
  kind?: string;
  /** Only the Places marked To try; the Addresses stay. Combines with the Kind. */
  toTry?: boolean;
}

/**
 * The World home's Pins (ADR 0119): every Place's and every current Address's,
 * as Core reads them (a closed Place has none), less the Apps turned off and
 * the Places of another Kind or not To try. Both are read from the Place
 * itself: a Pin carries neither.
 */
export function worldPins(pins: readonly SurfacePin[], places: readonly Document[], filter: WorldFilter): SurfacePin[] {
  const hidden = new Set(filter.hidden ?? []);
  const byId = new Map(places.map((p) => [p.id, p]));
  const keeps = (p: SurfacePin) => {
    if (p.type !== PLACE_TYPE) return true;
    const place = byId.get(p.itemId);
    return (!filter.kind || place?.kind === filter.kind) && (!filter.toTry || place?.toTry === true);
  };
  return pins.filter((p) => !hidden.has(p.appId) && keeps(p));
}
