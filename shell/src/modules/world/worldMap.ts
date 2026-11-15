import { PLACE_TYPE, type Document, type SurfacePin } from "@lifeline/core";

/** The World map's filter: Apps whose Pins are off, and one Kind of Place. */
export interface WorldFilter {
  /** App ids whose Pins are hidden ("contacts", "atlas"). */
  hidden?: readonly string[];
  /** A Place Kind's value: only Places of that Kind; the Addresses stay. "" or absent for every Kind. */
  kind?: string;
}

/**
 * The World home's Pins (ADR 0119): every Place's and every current Address's,
 * as Core reads them, less the Apps turned off and the Places of another Kind.
 * The Kind is read from the Place itself: a Pin carries none.
 */
export function worldPins(pins: readonly SurfacePin[], places: readonly Document[], filter: WorldFilter): SurfacePin[] {
  const hidden = new Set(filter.hidden ?? []);
  const kinds = new Map(places.map((p) => [p.id, typeof p.kind === "string" ? p.kind : ""]));
  return pins.filter((p) => !hidden.has(p.appId) && (!filter.kind || p.type !== PLACE_TYPE || kinds.get(p.itemId) === filter.kind));
}
