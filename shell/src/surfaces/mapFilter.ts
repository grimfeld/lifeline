import { EVENT_AT_FIELD, EVENT_TYPE, PLACE_TYPE, type Document, type SurfacePin } from "@lifeline/core";

/** The Map's filter: Document types whose Pins are off, one Place Kind, and To try. */
export interface MapFilter {
  /** Document types whose Pins are hidden. */
  hidden?: readonly string[];
  /** A Place Kind's value: only Places of that Kind; the other Pins stay. "" or absent for every Kind. Ignored while the Place type is hidden. */
  kind?: string;
  /** Only the Places marked To try; the other Pins stay. Combines with the Kind. Ignored while the Place type is hidden. */
  toTry?: boolean;
}

/**
 * The Map Surface's Pins (ADR 0011, ADR 0135): every Pin, less the types turned
 * off and, while Places are shown, the Places of another Kind or not To try.
 * Both are read from the Place itself: a Pin carries neither. An Event At a
 * Place (#505) stands at its Pin and follows its Place through both; one At a
 * Person follows the Events chip alone. `docs` holds the Places, and the
 * Events whose At is read. Kind and To try are not applied while the Place
 * type is hidden, so the choice can be kept and restored.
 */
export function mapPins(pins: readonly SurfacePin[], docs: readonly Document[], filter: MapFilter): SurfacePin[] {
  const hidden = new Set(filter.hidden ?? []);
  const byId = new Map(docs.map((d) => [d.id, d]));
  const narrowing = !hidden.has(PLACE_TYPE);
  const placeKept = (place: Document | undefined) => !narrowing || ((!filter.kind || place?.kind === filter.kind) && (!filter.toTry || place?.toTry === true));
  const keeps = (p: SurfacePin) => {
    if (p.type === PLACE_TYPE) return placeKept(byId.get(p.itemId));
    if (p.type !== EVENT_TYPE) return true;
    const at = byId.get(p.itemId)?.[EVENT_AT_FIELD];
    const target = typeof at === "string" ? byId.get(at) : undefined;
    return target?.type !== PLACE_TYPE || placeKept(target);
  };
  return pins.filter((p) => !hidden.has(p.type) && keeps(p));
}
