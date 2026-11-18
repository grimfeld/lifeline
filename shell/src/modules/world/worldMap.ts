import { EVENT_AT_FIELD, EVENT_TYPE, PLACE_TYPE, type Document, type SurfacePin } from "@lifeline/core";

/** The World map's filter: Apps whose Pins are off, one Kind of Place, and To try. */
export interface WorldFilter {
  /** App ids whose Pins are hidden ("contacts", "atlas", "calendar"). */
  hidden?: readonly string[];
  /** A Place Kind's value: only Places of that Kind; the Addresses stay. "" or absent for every Kind. */
  kind?: string;
  /** Only the Places marked To try; the Addresses stay. Combines with the Kind. */
  toTry?: boolean;
}

/**
 * The World home's Pins (ADR 0128): every Place's and every current Address's,
 * as Core reads them (a closed Place has none), less the Apps turned off and
 * the Places of another Kind or not To try. Both are read from the Place
 * itself: a Pin carries neither. An Event At a Place (#505) stands at its Pin
 * and follows its Place through both; one At a Person follows the Events chip
 * alone. `docs` holds the Places, and the Events whose At is read.
 */
export function worldPins(pins: readonly SurfacePin[], docs: readonly Document[], filter: WorldFilter): SurfacePin[] {
  const hidden = new Set(filter.hidden ?? []);
  const byId = new Map(docs.map((d) => [d.id, d]));
  const placeKept = (place: Document | undefined) => (!filter.kind || place?.kind === filter.kind) && (!filter.toTry || place?.toTry === true);
  const keeps = (p: SurfacePin) => {
    if (p.type === PLACE_TYPE) return placeKept(byId.get(p.itemId));
    if (p.type !== EVENT_TYPE) return true;
    const at = byId.get(p.itemId)?.[EVENT_AT_FIELD];
    const target = typeof at === "string" ? byId.get(at) : undefined;
    return target?.type !== PLACE_TYPE || placeKept(target);
  };
  return pins.filter((p) => !hidden.has(p.appId) && keeps(p));
}
